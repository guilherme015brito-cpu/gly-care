
-- ============ ENUMS ============
create type public.member_role as enum ('caregiver','patient','professional_readonly');
create type public.glucose_source as enum ('simulation','manual','external');
create type public.glucose_trend as enum ('rising_fast','rising','stable','falling','falling_fast','unknown');
create type public.administration_status as enum ('performed','planned');
create type public.administration_purpose as enum ('basal','meal','correction','combined');
create type public.ketone_method as enum ('blood','urine');
create type public.meal_type as enum ('breakfast','lunch','snack','dinner','supper','other');
create type public.validation_status as enum ('not_validated','under_review','validated');

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),100))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ PATIENTS & MEMBERS ============
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 1 and 80),
  birth_date date,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.patient_members (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  user_id uuid not null,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  unique (patient_id, user_id)
);
create index on public.patient_members (user_id);

create or replace function public.is_patient_member(_patient uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.patient_members where patient_id = _patient and user_id = auth.uid())
$$;
create or replace function public.can_write_patient(_patient uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.patient_members where patient_id = _patient and user_id = auth.uid()
                 and role in ('caregiver','patient'))
$$;
create or replace function public.is_patient_caregiver(_patient uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.patient_members where patient_id = _patient and user_id = auth.uid()
                 and role = 'caregiver')
$$;

grant select, insert, update, delete on public.patients to authenticated;
grant all on public.patients to service_role;
alter table public.patients enable row level security;
create policy "members read patient" on public.patients for select to authenticated
  using (public.is_patient_member(id) or created_by = auth.uid());
create policy "auth create patient" on public.patients for insert to authenticated with check (created_by = auth.uid());
create policy "writers update patient" on public.patients for update to authenticated using (public.can_write_patient(id));
create policy "caregiver delete patient" on public.patients for delete to authenticated using (public.is_patient_caregiver(id));

create or replace function public.add_creator_as_caregiver() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.patient_members (patient_id, user_id, role) values (new.id, new.created_by, 'caregiver');
  return new;
end $$;
create trigger patients_add_creator after insert on public.patients
for each row execute function public.add_creator_as_caregiver();

grant select, insert, update, delete on public.patient_members to authenticated;
grant all on public.patient_members to service_role;
alter table public.patient_members enable row level security;
create policy "members read members" on public.patient_members for select to authenticated using (public.is_patient_member(patient_id));
create policy "caregiver manage members ins" on public.patient_members for insert to authenticated with check (public.is_patient_caregiver(patient_id));
create policy "caregiver manage members upd" on public.patient_members for update to authenticated using (public.is_patient_caregiver(patient_id));
create policy "caregiver manage members del" on public.patient_members for delete to authenticated using (public.is_patient_caregiver(patient_id) and user_id <> auth.uid());

-- invite by email (caregiver only); never exposes emails
create or replace function public.add_patient_member_by_email(_patient uuid, _email text, _role public.member_role)
returns text language plpgsql security definer set search_path = public as $$
declare _uid uuid;
begin
  if not public.is_patient_caregiver(_patient) then raise exception 'not_allowed'; end if;
  select id into _uid from auth.users where lower(email) = lower(trim(_email)) limit 1;
  if _uid is null then return 'user_not_found'; end if;
  insert into public.patient_members (patient_id, user_id, role) values (_patient, _uid, _role)
  on conflict (patient_id, user_id) do update set role = excluded.role;
  return 'ok';
end $$;
revoke all on function public.add_patient_member_by_email(uuid,text,public.member_role) from public, anon;
grant execute on function public.add_patient_member_by_email(uuid,text,public.member_role) to authenticated;

-- ============ INSULIN CATALOG (shared, authenticated read; writes by creator) ============
create table public.insulin_catalog (
  id uuid primary key default gen_random_uuid(),
  brand_name text not null check (char_length(brand_name) between 1 and 120),
  active_ingredient text check (char_length(active_ingredient) <= 120),
  manufacturer text check (char_length(manufacturer) <= 120),
  pharmacological_class text check (char_length(pharmacological_class) <= 120),
  concentration text check (char_length(concentration) <= 30),
  route text check (char_length(route) <= 60),
  presentation text check (char_length(presentation) <= 120),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.insulin_catalog to authenticated;
grant all on public.insulin_catalog to service_role;
alter table public.insulin_catalog enable row level security;
create policy "auth read catalog" on public.insulin_catalog for select to authenticated using (true);
create policy "auth insert catalog" on public.insulin_catalog for insert to authenticated with check (created_by = auth.uid());
create policy "creator update catalog" on public.insulin_catalog for update to authenticated using (created_by = auth.uid());
create policy "creator delete catalog" on public.insulin_catalog for delete to authenticated using (created_by = auth.uid());

create table public.insulin_action_profiles (
  id uuid primary key default gen_random_uuid(),
  insulin_id uuid not null references public.insulin_catalog(id) on delete cascade,
  onset_text text check (char_length(onset_text) <= 300),
  onset_min_minutes int check (onset_min_minutes >= 0),
  onset_max_minutes int check (onset_max_minutes >= 0),
  peak_text text check (char_length(peak_text) <= 300),
  peak_min_minutes int check (peak_min_minutes >= 0),
  peak_max_minutes int check (peak_max_minutes >= 0),
  effective_duration_text text check (char_length(effective_duration_text) <= 300),
  effective_duration_min_minutes int check (effective_duration_min_minutes >= 0),
  effective_duration_max_minutes int check (effective_duration_max_minutes >= 0),
  max_duration_text text check (char_length(max_duration_text) <= 300),
  max_duration_minutes int check (max_duration_minutes >= 0),
  source_reference text check (char_length(source_reference) <= 500),
  source_review_date date,
  validation_status public.validation_status not null default 'not_validated',
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  check (onset_min_minutes is null or onset_max_minutes is null or onset_min_minutes <= onset_max_minutes),
  check (peak_min_minutes is null or peak_max_minutes is null or peak_min_minutes <= peak_max_minutes),
  check (effective_duration_min_minutes is null or effective_duration_max_minutes is null or effective_duration_min_minutes <= effective_duration_max_minutes)
);
create index on public.insulin_action_profiles (insulin_id);
grant select, insert, update, delete on public.insulin_action_profiles to authenticated;
grant all on public.insulin_action_profiles to service_role;
alter table public.insulin_action_profiles enable row level security;
create policy "auth read profiles" on public.insulin_action_profiles for select to authenticated using (true);
create policy "auth insert profiles" on public.insulin_action_profiles for insert to authenticated with check (created_by = auth.uid());
create policy "creator update profiles" on public.insulin_action_profiles for update to authenticated using (created_by = auth.uid());
create policy "creator delete profiles" on public.insulin_action_profiles for delete to authenticated using (created_by = auth.uid());

-- ============ PATIENT INSULINS ============
create table public.patient_insulins (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  insulin_id uuid not null references public.insulin_catalog(id) on delete restrict,
  role text not null check (role in ('rapid','basal','other')),
  prescribed_dose_text text check (char_length(prescribed_dose_text) <= 200),
  prescribed_times text check (char_length(prescribed_times) <= 200),
  notes text check (char_length(notes) <= 1000),
  active boolean not null default true,
  started_on date,
  ended_on date,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.patient_insulins (patient_id, active);

-- ============ ADMINISTRATIONS ============
create table public.insulin_administrations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  patient_insulin_id uuid references public.patient_insulins(id) on delete set null,
  insulin_id uuid not null references public.insulin_catalog(id) on delete restrict,
  dose_units numeric(6,2) not null check (dose_units > 0 and dose_units <= 300),
  administered_at timestamptz not null,
  purpose public.administration_purpose not null,
  status public.administration_status not null default 'performed',
  confirmed_by_user boolean not null default false,
  glucose_before_mgdl int check (glucose_before_mgdl between 10 and 1000),
  injection_site text check (char_length(injection_site) <= 60),
  notes text check (char_length(notes) <= 1000),
  recorded_by_name text check (char_length(recorded_by_name) <= 100),
  supersedes_id uuid references public.insulin_administrations(id),
  is_superseded boolean not null default false,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  check (status = 'planned' or confirmed_by_user = true)
);
create index on public.insulin_administrations (patient_id, administered_at desc);

-- ============ GLUCOSE ============
create table public.glucose_readings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  value numeric(7,2) not null check (value > 0),
  unit text not null check (unit in ('mg/dL','mmol/L')),
  value_mgdl numeric(7,2) not null check (value_mgdl between 10 and 1000),
  measured_at timestamptz not null,
  received_at timestamptz not null default now(),
  source public.glucose_source not null,
  provider_id text not null default 'manual' check (char_length(provider_id) <= 60),
  external_id text check (char_length(external_id) <= 200),
  trend public.glucose_trend not null default 'unknown',
  quality text not null default 'valid' check (quality in ('valid','questionable','invalid')),
  raw_payload jsonb,
  notes text check (char_length(notes) <= 500),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.glucose_readings (patient_id, measured_at desc);
create unique index glucose_dedupe_external on public.glucose_readings (patient_id, provider_id, external_id) where external_id is not null;
create unique index glucose_dedupe_time on public.glucose_readings (patient_id, provider_id, measured_at);

-- ============ FOOD ============
create table public.food_catalog (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  preparation text check (char_length(preparation) <= 80),
  state text not null default 'not_applicable' check (state in ('raw','cooked','not_applicable')),
  source text not null check (source in ('fictional_example','manual','recipe','TACO','TBCA')),
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
create index on public.food_catalog (patient_id);
create index on public.food_catalog (lower(name));

create table public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  meal_type public.meal_type not null,
  eaten_at timestamptz not null,
  total_carbs_g numeric(7,2) not null default 0 check (total_carbs_g >= 0),
  total_protein_g numeric(7,2) check (total_protein_g >= 0),
  total_fat_g numeric(7,2) check (total_fat_g >= 0),
  total_kcal numeric(8,2) check (total_kcal >= 0),
  has_missing_values boolean not null default false,
  notes text check (char_length(notes) <= 1000),
  is_favorite boolean not null default false,
  favorite_name text check (char_length(favorite_name) <= 80),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.meal_entries (patient_id, eaten_at desc);

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meal_entries(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  food_id uuid references public.food_catalog(id) on delete set null,
  food_name text not null check (char_length(food_name) <= 160),
  food_source text not null,
  grams numeric(7,2) not null check (grams > 0 and grams <= 5000),
  carbs_g numeric(7,2),
  protein_g numeric(7,2),
  fat_g numeric(7,2),
  kcal numeric(8,2)
);
create index on public.meal_items (meal_id);

-- ============ KETONES ============
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
  check ((method = 'blood' and unit = 'mmol/L' and value is not null and value >= 0 and value <= 15)
      or (method = 'urine' and ((unit = 'qualitative' and qualitative is not null)
                               or (unit = 'mg/dL' and value is not null and value >= 0 and value <= 200))))
);
create index on public.ketone_readings (patient_id, measured_at desc);

-- ============ CLINICAL SETTINGS ============
create table public.clinical_settings (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  target_glucose_text text check (char_length(target_glucose_text) <= 100),
  target_low_mgdl int not null default 70 check (target_low_mgdl between 40 and 200),
  target_high_mgdl int not null default 180 check (target_high_mgdl between 80 and 400),
  very_low_mgdl int not null default 54 check (very_low_mgdl between 30 and 100),
  very_high_mgdl int not null default 250 check (very_high_mgdl between 150 and 500),
  sensitivity_factor_text text check (char_length(sensitivity_factor_text) <= 200),
  carb_ratios jsonb not null default '[]'::jsonb,
  rapid_insulin_text text check (char_length(rapid_insulin_text) <= 120),
  basal_insulin_text text check (char_length(basal_insulin_text) <= 120),
  administration_times text check (char_length(administration_times) <= 300),
  clinical_instructions text check (char_length(clinical_instructions) <= 4000),
  emergency_contact_name text check (char_length(emergency_contact_name) <= 100),
  emergency_contact_phone text check (char_length(emergency_contact_phone) <= 30),
  last_review_date date,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  check (very_low_mgdl < target_low_mgdl and target_low_mgdl < target_high_mgdl and target_high_mgdl < very_high_mgdl)
);

-- ============ AUDIT ============
create table public.audit_logs (
  id bigint generated always as identity primary key,
  patient_id uuid,
  table_name text not null,
  record_id text not null,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index on public.audit_logs (patient_id, changed_at desc);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "members read audit" on public.audit_logs for select to authenticated using (public.is_patient_member(patient_id));

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare _pid uuid; _rid text;
begin
  if tg_op = 'DELETE' then
    _pid := (to_jsonb(old)->>'patient_id')::uuid; _rid := to_jsonb(old)->>'id';
  else
    _pid := (to_jsonb(new)->>'patient_id')::uuid; _rid := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'patient_id');
  end if;
  insert into public.audit_logs (patient_id, table_name, record_id, action, old_data, new_data, changed_by)
  values (_pid, tg_table_name, coalesce(_rid, '?'), tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end, auth.uid());
  return coalesce(new, old);
end $$;

-- ============ generic RLS for patient-scoped tables ============
do $$
declare t text;
begin
  foreach t in array array['patient_insulins','insulin_administrations','glucose_readings','meal_entries','meal_items','ketone_readings','clinical_settings']
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "members read" on public.%I for select to authenticated using (public.is_patient_member(patient_id))', t);
    execute format('create policy "writers insert" on public.%I for insert to authenticated with check (public.can_write_patient(patient_id))', t);
    execute format('create policy "writers update" on public.%I for update to authenticated using (public.can_write_patient(patient_id)) with check (public.can_write_patient(patient_id))', t);
    execute format('create policy "caregiver delete" on public.%I for delete to authenticated using (public.is_patient_caregiver(patient_id))', t);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_trigger()', t, t);
  end loop;
end $$;

-- administrations are never deleted (corrections supersede)
drop policy "caregiver delete" on public.insulin_administrations;

-- food catalog: shared fictional examples (patient_id null) readable by authenticated; patient foods by members
grant select, insert, update, delete on public.food_catalog to authenticated;
grant all on public.food_catalog to service_role;
alter table public.food_catalog enable row level security;
create policy "read foods" on public.food_catalog for select to authenticated
  using (patient_id is null or public.is_patient_member(patient_id));
create policy "insert foods" on public.food_catalog for insert to authenticated
  with check (patient_id is not null and public.can_write_patient(patient_id));
create policy "update foods" on public.food_catalog for update to authenticated
  using (patient_id is not null and public.can_write_patient(patient_id));
create policy "delete foods" on public.food_catalog for delete to authenticated
  using (patient_id is not null and public.can_write_patient(patient_id));

-- fictional example foods (clearly marked)
insert into public.food_catalog (patient_id, name, preparation, state, source, source_reference, carbs_per_100g, protein_per_100g, fat_per_100g, kcal_per_100g, created_by) values
 (null,'Arroz exemplo (FICTÍCIO)','cozido','cooked','fictional_example','Valores fictícios para demonstração — não usar clinicamente',30,2.5,0.3,135,null),
 (null,'Feijão exemplo (FICTÍCIO)','cozido','cooked','fictional_example','Valores fictícios para demonstração — não usar clinicamente',14,5,0.5,80,null),
 (null,'Pão exemplo (FICTÍCIO)','assado','not_applicable','fictional_example','Valores fictícios para demonstração — não usar clinicamente',55,8,3,290,null),
 (null,'Banana exemplo (FICTÍCIO)','in natura','raw','fictional_example','Valores fictícios para demonstração — não usar clinicamente',22,1.2,0.2,95,null),
 (null,'Leite exemplo (FICTÍCIO)','líquido','not_applicable','fictional_example','Valores fictícios — sem dado de gordura',5,3.2,null,null,null);
