-- Manual RLS isolation check. Run inside a transaction as two different users.
begin;
-- user A sees only own patients
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select count(*) as visible_patients_for_A from public.patients; -- expect only A's
select count(*) as foreign_glucose from public.glucose_readings
 where not public.is_patient_member(patient_id); -- expect 0
rollback;
