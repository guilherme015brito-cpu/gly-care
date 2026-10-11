begin;

-- Persist the retry key during INSERT; meals deliberately have no UPDATE policy.
create or replace function public.save_meal_atomic(p_patient_id uuid, p_meal jsonb, p_items jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
  v_count integer;
  v_carbs numeric;
  v_protein numeric;
  v_fat numeric;
  v_kcal numeric;
  v_missing boolean;
begin
  if (select auth.uid()) is null or not public.can_write_patient(p_patient_id) then
    raise exception 'Sem permissao para registrar refeicao desta paciente' using errcode = '42501';
  end if;
  if p_meal is null or jsonb_typeof(p_meal) <> 'object'
    or p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Refeicao deve conter entre 1 e 50 alimentos' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_items) as i(
      food_id text, food_name text, food_source text, grams numeric,
      carbs_g numeric, protein_g numeric, fat_g numeric, kcal numeric
    ) where i.food_name is null or length(trim(i.food_name)) = 0 or length(i.food_name) > 160
      or i.food_source is null or length(trim(i.food_source)) = 0
      or i.grams is null or i.grams <= 0 or i.grams > 5000
      or i.carbs_g is null or i.carbs_g < 0
      or (i.protein_g is not null and i.protein_g < 0)
      or (i.fat_g is not null and i.fat_g < 0)
      or (i.kcal is not null and i.kcal < 0)
  ) then
    raise exception 'Itens invalidos ou carboidratos incompletos' using errcode = '22023';
  end if;
  select count(*)::integer, sum(i.carbs_g),
    case when count(*) = count(i.protein_g) then sum(i.protein_g) end,
    case when count(*) = count(i.fat_g) then sum(i.fat_g) end,
    case when count(*) = count(i.kcal) then sum(i.kcal) end,
    (count(*) <> count(i.protein_g) or count(*) <> count(i.fat_g) or count(*) <> count(i.kcal))
  into v_count, v_carbs, v_protein, v_fat, v_kcal, v_missing
  from jsonb_to_recordset(p_items) as i(
    food_id text, food_name text, food_source text, grams numeric,
    carbs_g numeric, protein_g numeric, fat_g numeric, kcal numeric
  );
  if v_count <> jsonb_array_length(p_items) or v_carbs is null then
    raise exception 'Lista de alimentos invalida' using errcode = '22023';
  end if;
  insert into public.meal_entries (
    patient_id, meal_type, eaten_at, total_carbs_g, total_protein_g, total_fat_g,
    total_kcal, has_missing_values, notes, is_favorite, favorite_name, client_request_id
  ) values (
    p_patient_id, (p_meal->>'meal_type')::public.meal_type, (p_meal->>'eaten_at')::timestamptz,
    v_carbs, v_protein, v_fat, v_kcal, v_missing, nullif(p_meal->>'notes',''),
    coalesce((p_meal->>'is_favorite')::boolean, false), nullif(p_meal->>'favorite_name',''),
    nullif(p_meal->>'client_request_id','')::uuid
  ) returning id into v_id;
  insert into public.meal_items (
    meal_id, patient_id, food_id, food_name, food_source, grams, carbs_g, protein_g, fat_g, kcal
  ) select v_id, p_patient_id, i.food_id, i.food_name, i.food_source,
    i.grams, i.carbs_g, i.protein_g, i.fat_g, i.kcal
  from jsonb_to_recordset(p_items) as i(
    food_id text, food_name text, food_source text, grams numeric,
    carbs_g numeric, protein_g numeric, fat_g numeric, kcal numeric
  );
  return v_id;
end $$;

create or replace function public.save_meal_with_administration(
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
  meal_id := public.save_meal_atomic(p_patient_id,
    p_meal || jsonb_build_object('client_request_id',p_request_id), p_items);
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
revoke all on function public.save_meal_atomic(uuid,jsonb,jsonb) from public, anon;
grant execute on function public.save_meal_atomic(uuid,jsonb,jsonb) to authenticated;
revoke all on function public.save_meal_with_administration(uuid,jsonb,jsonb,jsonb,uuid) from public, anon;
grant execute on function public.save_meal_with_administration(uuid,jsonb,jsonb,jsonb,uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
