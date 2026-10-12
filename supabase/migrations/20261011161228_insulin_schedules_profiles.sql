begin;
create function public.valid_daily_insulin_schedule(p jsonb) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare x jsonb; seen text[] := '{}'; n numeric;
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p)>6 then return false; end if;
  for x in select value from jsonb_array_elements(p) loop
    if jsonb_typeof(x)<>'object' or x->>'time' is null or x->>'time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or jsonb_typeof(x->'dose') is distinct from 'number' or x->>'time'=any(seen) then return false; end if;
    n := (x->>'dose')::numeric;
    if n < 0.5 or n > 300 or n <> round(n,1) then return false; end if;
    seen := array_append(seen,x->>'time');
  end loop;
  return true;
end $$;
create function public.valid_visual_insulin_profile(p jsonb) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare onset numeric; peak numeric; duration numeric;
begin
  if p is null then return true; end if;
  if jsonb_typeof(p)<>'object' or p->>'role' is null or p->>'role' not in ('rapid','basal')
    or jsonb_typeof(p->'onsetMinutes') is distinct from 'number'
    or jsonb_typeof(p->'durationMinutes') is distinct from 'number' then return false; end if;
  onset := (p->>'onsetMinutes')::numeric; duration := (p->>'durationMinutes')::numeric;
  if onset < 0 or onset > 1440 or duration <= onset or duration > 4320 then return false; end if;
  if p->>'role'='basal' then return p->'peakMinutes' is not distinct from 'null'::jsonb; end if;
  if jsonb_typeof(p->'peakMinutes') is distinct from 'number' then return false; end if;
  peak := (p->>'peakMinutes')::numeric;
  return peak > onset and peak < duration;
end $$;
create function public.valid_insulin_timezone(p text) returns boolean
language sql stable security invoker set search_path='' as $$ select exists(select 1 from pg_timezone_names where name=p) $$;
alter table public.insulin_action_profiles add column visual_profile jsonb;
alter table public.insulin_action_profiles add constraint valid_visual_profile check (
  public.valid_visual_insulin_profile(visual_profile) and
  (visual_profile is null or (source_reference is not null and char_length(source_reference)>0))
);
alter table public.patient_insulins add column daily_schedule jsonb not null default '[]';
alter table public.patient_insulins add column schedule_timezone text not null default 'America/Sao_Paulo';
alter table public.patient_insulins add constraint valid_daily_schedule check (public.valid_daily_insulin_schedule(daily_schedule) and (role='basal' or daily_schedule='[]'::jsonb));
alter table public.patient_insulins add constraint valid_schedule_timezone check (public.valid_insulin_timezone(schedule_timezone));
alter table public.insulin_administrations add column scheduled_key text;
create unique index insulin_scheduled_occurrence on public.insulin_administrations(patient_id,scheduled_key) where scheduled_key is not null;

create function public.confirm_scheduled_basal(p_insulin uuid,p_time text,p_administered_at timestamptz)
returns uuid language plpgsql security invoker set search_path='' as $$
declare p public.patient_insulins; slot jsonb; k text; id uuid; local_at timestamp;
begin
  select * into p from public.patient_insulins where patient_insulins.id=p_insulin;
  if not found or auth.uid() is null or not public.can_write_patient(p.patient_id) then raise exception 'not_allowed' using errcode='42501'; end if;
  if not p.active or p.role<>'basal' then raise exception 'inactive_schedule' using errcode='22023'; end if;
  local_at := p_administered_at at time zone p.schedule_timezone;
  if p_administered_at is null or p_administered_at > now()+interval '5 minutes'
    or local_at::date <> (now() at time zone p.schedule_timezone)::date
    or p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or p_time is null
    or local_at::time < p_time::time
    or (p.started_on is not null and p.started_on > local_at::date) then
    raise exception 'invalid_confirmation_time' using errcode='22023';
  end if;
  select value into slot from jsonb_array_elements(p.daily_schedule) where value->>'time'=p_time;
  if not found then raise exception 'missing_slot' using errcode='22023'; end if;
  k := 'schedule:'||p_insulin||':'||local_at::date||':'||p_time;
  perform pg_advisory_xact_lock(hashtextextended(k,0));
  select insulin_administrations.id into id from public.insulin_administrations where patient_id=p.patient_id and scheduled_key=k;
  if found then return id; end if;
  insert into public.insulin_administrations(patient_id,patient_insulin_id,insulin_id,dose_units,administered_at,purpose,status,confirmed_by_user,scheduled_key)
    values(p.patient_id,p.id,p.insulin_id,(slot->>'dose')::numeric,p_administered_at,'basal','performed',true,k) returning insulin_administrations.id into id;
  return id;
end $$;
revoke all on function public.confirm_scheduled_basal(uuid,text,timestamptz) from public,anon;
grant execute on function public.confirm_scheduled_basal(uuid,text,timestamptz) to authenticated;
revoke all on function public.valid_daily_insulin_schedule(jsonb),public.valid_visual_insulin_profile(jsonb),public.valid_insulin_timezone(text) from public,anon;
grant execute on function public.valid_daily_insulin_schedule(jsonb),public.valid_visual_insulin_profile(jsonb),public.valid_insulin_timezone(text) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
