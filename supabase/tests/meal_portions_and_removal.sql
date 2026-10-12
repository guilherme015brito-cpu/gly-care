begin;
do $$
declare
  u uuid := gen_random_uuid(); outsider uuid := gen_random_uuid();
  p uuid := gen_random_uuid(); ins uuid := gen_random_uuid(); a uuid := gen_random_uuid();
  denied boolean;
begin
  insert into auth.users(id) values(u),(outsider);
  insert into public.patients(id,nickname,created_by) values(p,'Temporary portion/removal test',u);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  insert into public.insulin_catalog(id,brand_name,created_by) values(ins,'Temporary test',u);
  insert into public.insulin_administrations(id,patient_id,insulin_id,dose_units,administered_at,purpose,status,confirmed_by_user,created_by)
    values(a,p,ins,1,now(),'meal','performed',true,u);
  set local role authenticated;
  insert into public.food_catalog(patient_id,name,source,portion_amount,portion_unit,portion_grams,carbs_per_100g)
    values(p,'Temporary 200 ml','manual',200,'ml',250,8);
  denied := false;
  begin
    insert into public.food_catalog(patient_id,name,source,portion_amount,portion_unit,portion_grams)
      values(p,'Invalid zero portion','manual',0,'g',0);
  exception when check_violation then denied := true; end;
  if not denied then raise exception 'Zero portion accepted'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
  denied := false;
  begin perform public.remove_insulin_administration(p,a);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Cross-patient removal allowed'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  perform public.remove_insulin_administration(p,a);
  if not exists(select 1 from public.insulin_administrations where id=a and deleted_at is not null) then
    raise exception 'Removal did not retain the original row';
  end if;
  reset role;
  if not exists(select 1 from public.audit_logs where record_id=a and action='UPDATE') then
    raise exception 'Removal not audited';
  end if;
end $$;
select 'Portions, logical removal, audit and patient isolation passed' as result;
rollback;
