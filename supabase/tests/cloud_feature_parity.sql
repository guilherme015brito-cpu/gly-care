-- No persistent records: all synthetic users/patients/foods/applications roll back.
begin;
do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  patient_a uuid := gen_random_uuid();
  patient_b uuid := gen_random_uuid();
  insulin uuid := gen_random_uuid();
  request_id uuid := gen_random_uuid();
  first_meal uuid;
  second_meal uuid;
  actual integer;
  denied boolean;
  meal jsonb := jsonb_build_object('meal_type','lunch','eaten_at',now());
  items jsonb := '[{"food_id":"taco-003","food_name":"Test rice","food_source":"TACO","grams":100,"carbs_g":28.1,"protein_g":2.5,"fat_g":0.2,"kcal":128}]';
  application jsonb;
begin
  insert into auth.users(id) values(user_a),(user_b);
  insert into public.patients(id,nickname,created_by)
    values(patient_a,'Temporary parity test A',user_a),(patient_b,'Temporary parity test B',user_b);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',user_a,'role','authenticated')::text, true);
  insert into public.insulin_catalog(id,brand_name) values(insulin,'Temporary test insulin');
  insert into public.patient_insulins(patient_id,insulin_id,role) values(patient_a,insulin,'rapid');
  application := jsonb_build_object('insulin_id',insulin,'dose',1,'administered_at',now(),
    'status','performed','purpose','meal','confirmed',true,'recorded_by_name','Temporary test');

  set local role authenticated;
  insert into public.food_catalog(patient_id,name,source,carbs_per_100g) values(patient_a,'Temporary food','manual',28.1);
  insert into public.ketone_readings(patient_id,method,unit,value,measured_at) values(patient_a,'blood','mmol/L',0.2,now());
  first_meal := public.save_meal_with_administration(patient_a,meal,items,application,request_id);
  second_meal := public.save_meal_with_administration(patient_a,meal,items,application,request_id);
  if first_meal <> second_meal then raise exception 'Retry duplicated meal'; end if;
  select count(*) into actual from public.insulin_administrations where meal_id = first_meal;
  if actual <> 1 then raise exception 'Retry duplicated application'; end if;
  if not exists (select 1 from public.meal_entries where id = first_meal
    and client_request_id = request_id and total_carbs_g = 28.1) then
    raise exception 'Retry key or calculated food totals missing';
  end if;
  denied := false;
  begin
    perform public.save_meal_with_administration(patient_a,meal,items,
      application || '{"confirmed":false}'::jsonb,gen_random_uuid());
  exception when invalid_parameter_value then denied := true;
  end;
  if not denied then raise exception 'Unconfirmed performed application allowed'; end if;
  select count(*) into actual from public.meal_entries where patient_id = patient_a;
  if actual <> 1 then raise exception 'Failed application left a meal'; end if;
  denied := false;
  begin
    perform public.save_meal_with_administration(patient_a,meal,items,
      application || jsonb_build_object('notes',repeat('x',1001)),gen_random_uuid());
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'Invalid application note allowed'; end if;
  select count(*) into actual from public.meal_entries where patient_id = patient_a;
  if actual <> 1 then raise exception 'Application failure left a partial meal'; end if;
  second_meal := public.save_meal_with_administration(patient_a,meal,items,
    application || '{"status":"planned","confirmed":false}'::jsonb,gen_random_uuid());
  if not exists (select 1 from public.insulin_administrations where meal_id = second_meal
    and status = 'planned' and not confirmed_by_user and glucose_before_mgdl is null) then
    raise exception 'Pending manual application was not preserved';
  end if;
  second_meal := public.save_meal_atomic(patient_a,meal,items);
  if not exists (select 1 from public.meal_entries where id = second_meal
    and client_request_id is null and total_carbs_g = 28.1)
    or exists (select 1 from public.insulin_administrations where meal_id = second_meal) then
    raise exception 'Meal-only RPC changed its original behavior';
  end if;
  denied := false;
  begin
    perform public.save_meal_with_administration(patient_b,meal,items,application,gen_random_uuid());
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Foreign meal allowed'; end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub',user_b,'role','authenticated')::text, true);
  select count(*) into actual from public.food_catalog where patient_id = patient_a;
  if actual <> 0 then raise exception 'Foreign custom food visible'; end if;
  select count(*) into actual from public.ketone_readings where patient_id = patient_a;
  if actual <> 0 then raise exception 'Foreign ketone visible'; end if;
  denied := false;
  begin
    insert into public.food_catalog(patient_id,name,source) values(patient_a,'Foreign food','manual');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Foreign custom food write allowed'; end if;
  reset role;
end $$;
select 'Manual meal transaction, retry deduplication and Cloud RLS passed' as result;
rollback;
