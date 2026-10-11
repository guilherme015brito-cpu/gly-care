begin;

create table public.food_catalog (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  preparation text check (char_length(preparation) <= 80),
  state text not null default 'not_applicable' check (state in ('raw','cooked','not_applicable')),
  source text not null check (source in ('manual','recipe','TACO','TBCA')),
  source_reference text check (char_length(source_reference) <= 300),
  carbs_per_100g numeric(6,2) check (carbs_per_100g between 0 and 100),
  protein_per_100g numeric(6,2) check (protein_per_100g between 0 and 100),
  fat_per_100g numeric(6,2) check (fat_per_100g between 0 and 100),
  kcal_per_100g numeric(7,2) check (kcal_per_100g between 0 and 1000),
  edible_portion_pct numeric(5,2) not null default 100 check (edible_portion_pct > 0 and edible_portion_pct <= 100),
  recipe_items jsonb,
  is_favorite boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index food_catalog_patient on public.food_catalog(patient_id);
alter table public.food_catalog enable row level security;
revoke all on public.food_catalog from anon, authenticated;
grant select, insert, update on public.food_catalog to authenticated;
grant all on public.food_catalog to service_role;
create policy "members read foods" on public.food_catalog for select to authenticated
  using (patient_id is null or public.is_patient_member(patient_id));
create policy "writers insert foods" on public.food_catalog for insert to authenticated
  with check (patient_id is not null and public.can_write_patient(patient_id));
create policy "writers update foods" on public.food_catalog for update to authenticated
  using (patient_id is not null and public.can_write_patient(patient_id))
  with check (patient_id is not null and public.can_write_patient(patient_id));

create type public.ketone_method as enum ('blood','urine');
create table public.ketone_readings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  method public.ketone_method not null,
  value numeric(6,2),
  unit text not null,
  qualitative text check (qualitative in ('negative','trace','small','moderate','large')),
  measured_at timestamptz not null,
  notes text check (char_length(notes) <= 500),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  check ((method = 'blood' and unit = 'mmol/L' and value between 0 and 15 and value is not null)
    or (method = 'urine' and ((unit = 'qualitative' and qualitative is not null)
      or (unit = 'mg/dL' and value between 0 and 200 and value is not null))))
);
create index ketone_readings_patient_time on public.ketone_readings(patient_id, measured_at desc);
alter table public.ketone_readings enable row level security;
revoke all on public.ketone_readings from anon, authenticated;
grant select, insert, update on public.ketone_readings to authenticated;
grant all on public.ketone_readings to service_role;
create policy "members read ketones" on public.ketone_readings for select to authenticated
  using (public.is_patient_member(patient_id));
create policy "writers insert ketones" on public.ketone_readings for insert to authenticated
  with check (public.can_write_patient(patient_id));
create policy "writers update ketones" on public.ketone_readings for update to authenticated
  using (public.can_write_patient(patient_id)) with check (public.can_write_patient(patient_id));
create trigger audit_ketone_readings after insert or update or delete on public.ketone_readings
  for each row execute function public.audit_insulin_changes();

alter table public.insulin_administrations add column meal_id uuid references public.meal_entries(id);
create index insulin_administrations_meal on public.insulin_administrations(meal_id) where meal_id is not null;
alter table public.meal_entries add column client_request_id uuid;
create unique index meal_entries_client_request on public.meal_entries(patient_id, client_request_id)
  where client_request_id is not null;

-- Only manual records: the RPC never receives a sensor reading or calculates a dose.
create function public.save_meal_with_administration(
  p_patient_id uuid, p_meal jsonb, p_items jsonb, p_administration jsonb, p_request_id uuid
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  meal_id uuid;
  patient_insulin uuid;
  insulin uuid;
  dose numeric;
  application_time timestamptz;
  application_status public.administration_status;
  application_purpose public.administration_purpose;
  confirmed boolean;
begin
  if auth.uid() is null or not public.can_write_patient(p_patient_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_request_id is null then raise exception 'missing_request' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select id into meal_id from public.meal_entries
    where patient_id = p_patient_id and client_request_id = p_request_id and created_by = auth.uid();
  if found then return meal_id; end if;
  if p_administration is null or jsonb_typeof(p_administration) <> 'object' then
    raise exception 'invalid_application' using errcode = '22023';
  end if;
  insulin := (p_administration->>'insulin_id')::uuid;
  dose := (p_administration->>'dose')::numeric;
  application_time := (p_administration->>'administered_at')::timestamptz;
  application_status := (p_administration->>'status')::public.administration_status;
  application_purpose := (p_administration->>'purpose')::public.administration_purpose;
  confirmed := (p_administration->>'confirmed')::boolean;
  if dose is null or dose < 0.5 or dose > 300 or dose <> round(dose, 1)
    or application_time is null or application_status is null or confirmed is null
    or application_purpose is null or application_purpose not in ('meal','combined')
    or (application_status = 'performed' and (not confirmed or application_time > now() + interval '5 minutes'))
    or (application_status = 'planned' and confirmed) then
    raise exception 'invalid_application' using errcode = '22023';
  end if;
  select id into patient_insulin from public.patient_insulins
    where patient_id = p_patient_id and insulin_id = insulin and active and role = 'rapid'
    order by started_on desc limit 1;
  if not found then raise exception 'insulin_not_in_use' using errcode = '22023'; end if;

  meal_id := public.save_meal_atomic(p_patient_id, p_meal, p_items);
  update public.meal_entries set client_request_id = p_request_id where id = meal_id;
  insert into public.insulin_administrations (
    patient_id, patient_insulin_id, insulin_id, dose_units, administered_at, purpose,
    status, confirmed_by_user, glucose_before_mgdl, injection_site, notes, recorded_by_name, meal_id
  ) values (
    p_patient_id, patient_insulin, insulin, dose, application_time, application_purpose,
    application_status, confirmed, null, nullif(p_administration->>'injection_site',''),
    nullif(p_administration->>'notes',''), nullif(p_administration->>'recorded_by_name',''), meal_id
  );
  return meal_id;
end $$;
revoke all on function public.save_meal_with_administration(uuid,jsonb,jsonb,jsonb,uuid) from public, anon;
grant execute on function public.save_meal_with_administration(uuid,jsonb,jsonb,jsonb,uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
