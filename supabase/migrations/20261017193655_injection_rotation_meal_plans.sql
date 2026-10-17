begin;

create function public.injection_region(p text) returns text language sql immutable security invoker set search_path='' as $$
 select case
 when translate(lower(trim(p)),'áãâéêíóôõúç','aaaeeiooouc') ~ '^braco( |$)' then 'Braço'
 when translate(lower(trim(p)),'áãâéêíóôõúç','aaaeeiooouc') ~ '^(perna|coxa)( |$)' then 'Perna (coxa)'
 when translate(lower(trim(p)),'áãâéêíóôõúç','aaaeeiooouc') ~ '^(abdomen|abdome|barriga)( |$)' then 'Abdômen'
 when translate(lower(trim(p)),'áãâéêíóôõúç','aaaeeiooouc') ~ '^(nadega|gluteo)( |$)' then 'Nádega'
 else null end
$$;
create index if not exists insulin_rotation_history on public.insulin_administrations(patient_id, administered_at desc, created_at desc, id desc)
where status='performed' and confirmed_by_user and not is_superseded and deleted_at is null;

create function public.get_injection_context(p_patient uuid,p_at timestamptz,p_exclude uuid default null,p_other uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare prev jsonb; following jsonb;
begin
 if auth.uid() is null or not public.is_patient_member(p_patient) then raise exception 'not_allowed' using errcode='42501'; end if;
 if p_at is null or not isfinite(p_at) then raise exception 'invalid_time' using errcode='22023'; end if;
 select coalesce(jsonb_agg(injection_site order by administered_at desc,created_at desc,id desc),'[]') into prev from
 (select injection_site,administered_at,created_at,id from public.insulin_administrations where patient_id=p_patient
 and id is distinct from p_exclude and id is distinct from p_other and deleted_at is null and not is_superseded and status='performed' and confirmed_by_user
 and administered_at<=p_at order by administered_at desc,created_at desc,id desc limit 3) r;
 select coalesce(jsonb_agg(injection_site order by administered_at,created_at,id),'[]') into following from
 (select injection_site,administered_at,created_at,id from public.insulin_administrations where patient_id=p_patient
 and id is distinct from p_exclude and id is distinct from p_other and deleted_at is null and not is_superseded and status='performed' and confirmed_by_user
 and administered_at>p_at order by administered_at,created_at,id limit 3) r;
 return jsonb_build_object('previous',prev,'following',following);
end $$;

create function public.enforce_injection_rotation() returns trigger language plpgsql security invoker set search_path='' as $$
declare ctx jsonb; item jsonb; side text; count_same integer:=0;
begin
 if tg_op='UPDATE' then
   if new.patient_id<>old.patient_id then raise exception 'not_allowed' using errcode='42501'; end if;
   if (new.injection_site,new.administered_at,new.status,new.confirmed_by_user) is not distinct from
      (old.injection_site,old.administered_at,old.status,old.confirmed_by_user) then return new; end if;
 end if;
 if new.deleted_at is not null or new.is_superseded then return new; end if;
 if new.injection_site is null or new.injection_site not in ('Braço','Perna (coxa)','Abdômen','Nádega') then
   raise exception 'injection_site_required' using errcode='22023';
 end if;
 if new.supersedes_id is not null and not exists(select 1 from public.insulin_administrations where id=new.supersedes_id and patient_id=new.patient_id) then
   raise exception 'not_allowed' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('injection:'||new.patient_id::text,0));
 ctx:=public.get_injection_context(new.patient_id,new.administered_at,new.id,new.supersedes_id);
 foreach side in array array['previous','following'] loop
   for item in select value from jsonb_array_elements(ctx->side) loop
     exit when public.injection_region(item#>>'{}') is distinct from new.injection_site;
     count_same:=count_same+1;
   end loop;
 end loop;
 if count_same>=3 then raise exception 'injection_rotation_blocked' using errcode='22023'; end if;
 return new;
end $$;
-- Activate the trigger in the following migration, after the compatible UI is deployed.

create function public.confirm_scheduled_basal(p_insulin uuid,p_time text,p_administered_at timestamptz,p_injection_site text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare p public.patient_insulins; slot jsonb; k text; result_id uuid; local_at timestamp;
begin
 select * into p from public.patient_insulins where id=p_insulin;
 if not found or auth.uid() is null or not public.can_write_patient(p.patient_id) then raise exception 'not_allowed' using errcode='42501'; end if;
 if not p.active or p.role<>'basal' then raise exception 'inactive_schedule' using errcode='22023'; end if;
 local_at:=p_administered_at at time zone p.schedule_timezone;
 if p_administered_at is null or not isfinite(p_administered_at) or p_administered_at>now()+interval '5 minutes'
 or local_at::date<>(now() at time zone p.schedule_timezone)::date or p_time is null
 or p_time!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or local_at::time<p_time::time
 or (p.started_on is not null and p.started_on>local_at::date) then raise exception 'invalid_confirmation_time' using errcode='22023'; end if;
 select value into slot from jsonb_array_elements(p.daily_schedule) where value->>'time'=p_time;
 if not found then raise exception 'missing_slot' using errcode='22023'; end if;
 k:='schedule:'||p_insulin||':'||local_at::date||':'||p_time;
 perform pg_advisory_xact_lock(hashtextextended(k,0));
 select id into result_id from public.insulin_administrations where patient_id=p.patient_id and scheduled_key=k;
 if found then return result_id; end if;
 insert into public.insulin_administrations(patient_id,patient_insulin_id,insulin_id,dose_units,administered_at,purpose,status,confirmed_by_user,scheduled_key,injection_site)
 values(p.patient_id,p.id,p.insulin_id,(slot->>'dose')::numeric,p_administered_at,'basal','performed',true,k,p_injection_site) returning id into result_id;
 return result_id;
end $$;

create function public.valid_meal_plan(p jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare m jsonb; i jsonb; f jsonb; field text; seen text[]:='{}';
begin
 if jsonb_typeof(p) is distinct from 'array' then return false; end if;
 if jsonb_array_length(p)<1 or jsonb_array_length(p)>24 then return false; end if;
 for m in select value from jsonb_array_elements(p) loop
   if jsonb_typeof(m) is distinct from 'object' or coalesce(length(trim(m->>'name')),0) not between 1 and 80
   or coalesce(m->>'id','')!~'^[0-9a-f-]{36}$' or m->>'id'=any(seen)
   or coalesce(m->>'time','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$'
   or coalesce(m->>'meal_type','') not in ('breakfast','lunch','snack','dinner','supper','other')
   or jsonb_typeof(m->'items') is distinct from 'array' then return false; end if;
   seen:=array_append(seen,m->>'id');
   if jsonb_array_length(m->'items')<1 or jsonb_array_length(m->'items')>50 then return false; end if;
   for i in select value from jsonb_array_elements(m->'items') loop
     if jsonb_typeof(i) is distinct from 'object' or coalesce(i->>'id','')!~'^[0-9a-f-]{36}$' or i->>'id'=any(seen)
     or jsonb_typeof(i->'selected') is distinct from 'boolean'
     or coalesce(i->>'quantity','')!~'^[0-9]{1,4}([.,][0-9]{1,2})?$'
     or replace(i->>'quantity',',','.')::numeric<=0
     or coalesce(i->>'measure','') not in ('g','portion','ml','spoon','ladle','serving','full-ladle')
     or jsonb_typeof(i->'food') is distinct from 'object' then return false; end if;
     seen:=array_append(seen,i->>'id'); f:=i->'food';
     if coalesce(length(f->>'id'),0) not between 1 and 150 or coalesce(length(trim(f->>'name')),0) not between 1 and 500
     or coalesce(f->>'source','') not in ('TACO','TBCA','manual','recipe','fictional_example') then return false; end if;
     foreach field in array array['carbs_per_100g','protein_per_100g','fat_per_100g','kcal_per_100g'] loop
       if not (f ? field) then return false; end if;
       if jsonb_typeof(f->field)='null' then continue; end if;
       if jsonb_typeof(f->field) is distinct from 'number' then return false; end if;
       if (f->>field)::numeric<0 or (f->>field)::numeric>10000 then return false; end if;
     end loop;
   end loop;
 end loop;
 return true;
exception when others then return false;
end $$;

create table public.meal_plans (
 id uuid primary key, patient_id uuid not null references public.patients(id),
 name text not null check(length(trim(name)) between 1 and 100),
 meals jsonb not null check(public.valid_meal_plan(meals)),
 version integer not null default 1 check(version>0), updated_at timestamptz not null default now()
);
create index meal_plans_patient on public.meal_plans(patient_id);
alter table public.meal_plans enable row level security;
create policy meal_plans_read on public.meal_plans for select to authenticated using(public.is_patient_member(patient_id));
create policy meal_plans_insert on public.meal_plans for insert to authenticated with check(public.can_write_patient(patient_id));
create policy meal_plans_update on public.meal_plans for update to authenticated using(public.can_write_patient(patient_id)) with check(public.can_write_patient(patient_id));
create policy meal_plans_delete on public.meal_plans for delete to authenticated using(public.can_write_patient(patient_id));
grant select,insert,update,delete on public.meal_plans to authenticated;
revoke all on public.meal_plans from anon;
create function public.protect_meal_plan_owner() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.patient_id<>old.patient_id or new.id<>old.id then raise exception 'not_allowed' using errcode='42501'; end if;
 new.version:=old.version+1; new.updated_at:=now(); return new;
end $$;
create trigger protect_meal_plan_owner before update on public.meal_plans for each row execute function public.protect_meal_plan_owner();
create trigger audit_meal_plans after insert or update or delete on public.meal_plans for each row execute function public.audit_insulin_changes();

create function public.list_meal_plans(p_patient uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(p) order by p.updated_at desc),'[]') from public.meal_plans p where p.patient_id=p_patient
$$;
create function public.save_meal_plan(p_patient uuid,p_id uuid,p_plan jsonb,p_version integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result public.meal_plans;
begin
 if auth.uid() is null or not public.can_write_patient(p_patient) then raise exception 'not_allowed' using errcode='42501'; end if;
 if p_version=0 then
   insert into public.meal_plans(id,patient_id,name,meals) values(p_id,p_patient,p_plan->>'name',p_plan->'meals') returning * into result;
 else
   update public.meal_plans set name=p_plan->>'name',meals=p_plan->'meals' where id=p_id and patient_id=p_patient and version=p_version returning * into result;
   if not found then raise exception 'meal_plan_conflict' using errcode='40001'; end if;
 end if;
 return to_jsonb(result);
end $$;
create function public.delete_meal_plan(p_patient uuid,p_id uuid,p_version integer) returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not public.can_write_patient(p_patient) then raise exception 'not_allowed' using errcode='42501'; end if;
 delete from public.meal_plans where id=p_id and patient_id=p_patient and version=p_version;
 if not found then raise exception 'meal_plan_conflict' using errcode='40001'; end if;
end $$;

revoke all on function public.injection_region(text),public.get_injection_context(uuid,timestamptz,uuid,uuid),public.enforce_injection_rotation(),public.confirm_scheduled_basal(uuid,text,timestamptz,text),public.valid_meal_plan(jsonb),public.protect_meal_plan_owner(),public.list_meal_plans(uuid),public.save_meal_plan(uuid,uuid,jsonb,integer),public.delete_meal_plan(uuid,uuid,integer) from public,anon;
grant execute on function public.injection_region(text),public.get_injection_context(uuid,timestamptz,uuid,uuid),public.confirm_scheduled_basal(uuid,text,timestamptz,text),public.valid_meal_plan(jsonb),public.list_meal_plans(uuid),public.save_meal_plan(uuid,uuid,jsonb,integer),public.delete_meal_plan(uuid,uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
