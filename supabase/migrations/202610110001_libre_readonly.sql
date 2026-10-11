begin;

-- Some existing deployments have patient/meal tables but no glucose schema.
-- Add only the missing prerequisites; never replay the full application schema.
do $$
begin
  if to_regclass('public.glucose_readings') is null then
    if to_regtype('public.glucose_source') is null then
      create type public.glucose_source as enum ('simulation', 'manual', 'external');
    end if;
    if to_regtype('public.glucose_trend') is null then
      create type public.glucose_trend as enum
        ('rising_fast', 'rising', 'stable', 'falling', 'falling_fast', 'unknown');
    end if;
    create table public.glucose_readings (
      id uuid primary key default gen_random_uuid(),
      patient_id uuid not null references public.patients(id) on delete cascade,
      value numeric(7,2) not null check (value > 0),
      unit text not null check (unit in ('mg/dL', 'mmol/L')),
      value_mgdl numeric(7,2) not null check (value_mgdl between 10 and 1000),
      measured_at timestamptz not null,
      received_at timestamptz not null default now(),
      source public.glucose_source not null,
      provider_id text not null default 'manual' check (char_length(provider_id) <= 60),
      external_id text check (char_length(external_id) <= 200),
      trend public.glucose_trend not null default 'unknown',
      quality text not null default 'valid' check (quality in ('valid', 'questionable', 'invalid')),
      raw_payload jsonb,
      notes text check (char_length(notes) <= 500),
      created_by uuid default auth.uid(),
      created_at timestamptz not null default now()
    );
    create index glucose_readings_patient_time on public.glucose_readings (patient_id, measured_at desc);
    create unique index glucose_dedupe_external on public.glucose_readings
      (patient_id, provider_id, external_id) where external_id is not null;
    create unique index glucose_dedupe_time on public.glucose_readings
      (patient_id, provider_id, measured_at);
    alter table public.glucose_readings enable row level security;
    revoke all on public.glucose_readings from anon, authenticated;
    grant select, insert, update on public.glucose_readings to authenticated;
    grant all on public.glucose_readings to service_role;
    create policy "members read" on public.glucose_readings for select to authenticated
      using (public.is_patient_member(patient_id));
    create policy "writers insert" on public.glucose_readings for insert to authenticated
      with check (public.can_write_patient(patient_id));
    create policy "writers update" on public.glucose_readings for update to authenticated
      using (public.can_write_patient(patient_id)) with check (public.can_write_patient(patient_id));
    if to_regprocedure('public.audit_trigger()') is not null then
      create trigger audit_glucose_readings after insert or update or delete on public.glucose_readings
        for each row execute function public.audit_trigger();
    elsif to_regprocedure('public.audit_insulin_changes()') is not null then
      create trigger audit_glucose_readings after insert or update or delete on public.glucose_readings
        for each row execute function public.audit_insulin_changes();
    end if;
  end if;
end $$;

-- No browser role can read these tables, including encrypted session tickets.
create table public.libre_connections (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  connected_by uuid not null references auth.users(id),
  revision uuid not null default gen_random_uuid(),
  libre_patient_id text not null,
  display_name text not null,
  sealed_ticket text,
  expires_at timestamptz,
  last_sync_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  last_error_code text
);
create table public.libre_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  sealed_ticket text not null,
  expires_at timestamptz not null,
  unique(user_id, patient_id)
);
create table public.libre_login_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempted_at timestamptz not null
);
alter table public.libre_connections enable row level security;
alter table public.libre_drafts enable row level security;
alter table public.libre_login_limits enable row level security;
revoke all on public.libre_connections, public.libre_drafts, public.libre_login_limits from anon, authenticated;
grant all on public.libre_connections, public.libre_drafts, public.libre_login_limits to service_role;

create function public.claim_libre_login(p_user uuid) returns boolean
language plpgsql security invoker set search_path = public as $$
declare claimed uuid;
begin
  insert into public.libre_login_limits(user_id, attempted_at) values(p_user, now())
  on conflict(user_id) do update set attempted_at = now()
  where libre_login_limits.attempted_at < now() - interval '1 minute'
  returning user_id into claimed;
  return claimed is not null;
end $$;

-- Binding is permanent while historical readings exist. Reconnecting must use
-- the same Libre person; a different person needs a separate GlyCare patient.
create function public.activate_libre(p_patient uuid, p_user uuid, p_draft uuid, p_libre text, p_name text, p_ticket text, p_expires timestamptz, p_readings jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare rev uuid; total integer;
begin
  if not exists(select 1 from public.patient_members where patient_id = p_patient and user_id = p_user and role in ('patient','caregiver')) then
    raise exception 'not_allowed';
  end if;
  perform 1 from public.libre_drafts where id = p_draft and patient_id = p_patient and user_id = p_user and expires_at > now() for update;
  if not found then raise exception 'expired_draft'; end if;
  insert into public.libre_connections(patient_id, connected_by, libre_patient_id, display_name, sealed_ticket, expires_at)
  values(p_patient, p_user, p_libre, p_name, p_ticket, p_expires)
  on conflict(patient_id) do update set connected_by = p_user, display_name = p_name, sealed_ticket = p_ticket,
    expires_at = p_expires, revision = gen_random_uuid(), next_attempt_at = now(), last_error_code = null
  where libre_connections.libre_patient_id = p_libre
  returning revision into rev;
  if rev is null then raise exception 'different_person'; end if;
  total := public.ingest_libre_readings(p_patient, rev, p_readings);
  delete from public.libre_drafts where id = p_draft;
  return total;
end $$;

-- Lock the connection while inserting: disconnect/reconnect during a remote
-- fetch cannot import readings from an old session into the current binding.
create function public.ingest_libre_readings(p_patient uuid, p_revision uuid, p_readings jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare total integer; connection public.libre_connections%rowtype;
begin
  select * into connection from public.libre_connections where patient_id = p_patient for update;
  if connection.revision is distinct from p_revision or connection.sealed_ticket is null or connection.expires_at <= now() then
    raise exception 'connection_changed';
  end if;
  if not exists(select 1 from public.patient_members where patient_id = p_patient and user_id = connection.connected_by and role in ('patient','caregiver')) then
    raise exception 'not_allowed';
  end if;
  if jsonb_typeof(p_readings) <> 'array' or jsonb_array_length(p_readings) > 2000 then raise exception 'invalid_readings'; end if;
  insert into public.glucose_readings(patient_id, value, unit, value_mgdl, measured_at, received_at, source, provider_id, external_id, trend, quality, notes, created_by)
  select p_patient, r.value, 'mg/dL', r.value, r.measured_at, r.received_at, 'external', 'librelinkup', r.external_id,
    r.trend::public.glucose_trend, r.quality, r.notes, connection.connected_by
  from jsonb_to_recordset(p_readings) as r(value numeric, measured_at timestamptz, received_at timestamptz, external_id text, trend text, quality text, notes text)
  on conflict do nothing;
  get diagnostics total = row_count;
  update public.libre_connections set last_sync_at = now(), last_error_code = null,
    next_attempt_at = greatest(next_attempt_at, now() + interval '1 minute') where patient_id = p_patient;
  return total;
end $$;

revoke all on function public.claim_libre_login(uuid), public.activate_libre(uuid,uuid,uuid,text,text,text,timestamptz,jsonb), public.ingest_libre_readings(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.claim_libre_login(uuid), public.activate_libre(uuid,uuid,uuid,text,text,text,timestamptz,jsonb), public.ingest_libre_readings(uuid,uuid,jsonb) to service_role;
commit;
