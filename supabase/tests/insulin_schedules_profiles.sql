begin;
do $$
declare u uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); ins uuid:=gen_random_uuid(); plan uuid:=gen_random_uuid(); a uuid; b uuid; denied boolean;
begin
  insert into auth.users(id) values(u),(outsider);
  insert into public.patients(id,nickname,created_by) values(p,'Temporary schedule test',u);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  insert into public.insulin_catalog(id,brand_name,created_by) values(ins,'Temporary basal',u);
  insert into public.patient_insulins(id,patient_id,insulin_id,role,daily_schedule,schedule_timezone) values(plan,p,ins,'basal','[{"time":"00:00","dose":1},{"time":"23:59","dose":2}]','UTC');
  set local role authenticated;
  a:=public.confirm_scheduled_basal(plan,'00:00',now());
  b:=public.confirm_scheduled_basal(plan,'00:00',now());
  if a<>b then raise exception 'Duplicate confirmation'; end if;
  if not exists(select 1 from public.insulin_administrations where id=a and confirmed_by_user and status='performed' and dose_units=1 and administered_at=now()) then raise exception 'Wrong confirmation'; end if;
  denied:=false;
  begin
    update public.patient_insulins set daily_schedule='[{"time":"07:00","dose":1},{"time":"07:00","dose":2}]' where id=plan;
  exception when check_violation then denied:=true; end;
  if not denied then raise exception 'Duplicate slots accepted'; end if;
  if public.valid_visual_insulin_profile('{"role":"basal","onsetMinutes":60,"durationMinutes":1440}') then raise exception 'Missing peak marker accepted'; end if;
  if public.valid_visual_insulin_profile('{"role":"rapid","onsetMinutes":17,"peakMinutes":500,"durationMinutes":300}') then raise exception 'Invalid peak accepted'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
  denied:=false;
  begin perform public.confirm_scheduled_basal(plan,'00:00',now()); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Foreign confirmation allowed'; end if;
  reset role;
end $$;
select 'Schedule validation, actual timestamp, deduplication and patient isolation passed' as result;
rollback;
