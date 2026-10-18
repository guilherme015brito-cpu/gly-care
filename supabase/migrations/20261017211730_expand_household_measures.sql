-- Additive unit support; preserves existing portions, policies and function grants.
begin;
alter table public.food_catalog drop constraint food_catalog_portion_unit_check;
alter table public.food_catalog add constraint food_catalog_portion_unit_check
check (portion_unit in ('g','ml','un','fatia','colher','colher_sopa','colher_cha','concha','copo','xicara','pote'));

create or replace function public.valid_meal_plan(p jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
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
     or coalesce(i->>'measure','') not in ('g','portion','ml','spoon','ladle','serving','full-ladle','registered-unit','unit','small-unit','large-unit','slice','large-slice','half-unit','cup','pot','teaspoon')
     or jsonb_typeof(i->'food') is distinct from 'object' then return false; end if;
     seen:=array_append(seen,i->>'id'); f:=i->'food';
     if coalesce(length(f->>'id'),0) not between 1 and 150 or coalesce(length(trim(f->>'name')),0) not between 1 and 500
     or coalesce(f->>'source','') not in ('TACO','TBCA','manual','recipe','fictional_example') then return false; end if;
     if i->>'measure' in ('portion','ml','registered-unit') then
       if jsonb_typeof(f->'portion_amount') is distinct from 'number'
       or jsonb_typeof(f->'portion_grams') is distinct from 'number'
       or (f->>'portion_amount')::numeric<=0 or (f->>'portion_amount')::numeric>5000
       or (f->>'portion_grams')::numeric<=0 or (f->>'portion_grams')::numeric>5000
       or coalesce(f->>'portion_unit','') not in ('g','ml','un','fatia','colher','colher_sopa','colher_cha','concha','copo','xicara','pote') then return false; end if;
       if i->>'measure'='ml' and f->>'portion_unit'<>'ml' then return false; end if;
       if i->>'measure'='registered-unit' and f->>'portion_unit' in ('g','ml') then return false; end if;
     end if;
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

notify pgrst,'reload schema';
commit;
