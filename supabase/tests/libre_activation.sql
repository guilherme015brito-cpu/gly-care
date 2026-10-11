-- Synthetic fixtures only. The rollback removes users, patients and readings.
begin;
do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  patient_a uuid := gen_random_uuid();
  patient_b uuid := gen_random_uuid();
  draft_id uuid := gen_random_uuid();
  revision_id uuid;
  payload jsonb := jsonb_build_array(jsonb_build_object(
    'value', 180, 'measured_at', now(), 'received_at', now(),
    'external_id', 'activation-test', 'trend', 'stable', 'quality', 'valid', 'notes', null
  ));
  actual integer;
  denied boolean;
begin
  insert into auth.users (id) values (user_a), (user_b);
  insert into public.patients (id, nickname, created_by)
    values (patient_a, 'Temporary Libre test A', user_a), (patient_b, 'Temporary Libre test B', user_b);
  insert into public.patient_members (patient_id, user_id, role)
    values (patient_a, user_b, 'professional_readonly');
  insert into public.libre_drafts (id, user_id, patient_id, sealed_ticket, expires_at)
    values (draft_id, user_a, patient_a, 'test-only', now() + interval '5 minutes');

  set local role service_role;
  if not public.claim_libre_login(user_a) then raise exception 'First login claim failed'; end if;
  if public.claim_libre_login(user_a) then raise exception 'Login cooldown failed'; end if;
  actual := public.activate_libre(patient_a, user_a, draft_id, 'test-person', 'Test',
    'test-only', now() + interval '1 hour', payload);
  if actual <> 1 then raise exception 'Activation did not import one reading'; end if;
  select revision into revision_id from public.libre_connections where patient_id = patient_a;
  actual := public.ingest_libre_readings(patient_a, revision_id, payload);
  if actual <> 0 then raise exception 'Duplicate reading imported'; end if;
  insert into public.glucose_readings (patient_id, value, unit, value_mgdl, measured_at, source)
    values (patient_b, 140, 'mg/dL', 140, now(), 'manual');
  reset role;
  select count(*) into actual from public.audit_logs
    where patient_id = patient_a and table_name = 'glucose_readings' and action = 'INSERT';
  if actual <> 1 then raise exception 'Glucose audit failed'; end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into actual from public.glucose_readings where patient_id = patient_a;
  if actual <> 1 then raise exception 'Own reading not visible'; end if;
  select count(*) into actual from public.glucose_readings where patient_id = patient_b;
  if actual <> 0 then raise exception 'Foreign reading visible'; end if;
  denied := false;
  begin
    insert into public.glucose_readings (patient_id, value, unit, value_mgdl, measured_at, source)
      values (patient_b, 141, 'mg/dL', 141, now() + interval '1 minute', 'manual');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Foreign write allowed'; end if;
  denied := false;
  begin
    perform 1 from public.libre_connections where patient_id = patient_a;
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Private ticket readable'; end if;
  reset role;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', user_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into actual from public.glucose_readings where patient_id = patient_a;
  if actual <> 1 then raise exception 'Readonly member cannot read'; end if;
  denied := false;
  begin
    insert into public.glucose_readings (patient_id, value, unit, value_mgdl, measured_at, source)
      values (patient_a, 181, 'mg/dL', 181, now() + interval '1 minute', 'manual');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Readonly member can write'; end if;
  reset role;

  set local role anon;
  denied := false;
  begin
    perform 1 from public.glucose_readings where patient_id = patient_a;
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Anonymous glucose access allowed'; end if;
  reset role;
end $$;
select 'Libre activation, cooldown, deduplication, audit and RLS passed' as result;
rollback;
