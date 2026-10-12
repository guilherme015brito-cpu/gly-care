-- Existing foods keep their original per-100-g basis. New label values are
-- normalized by the entered portion mass before insertion.
alter table public.food_catalog
  add column portion_amount numeric not null default 100 check (portion_amount > 0 and portion_amount <= 5000),
  add column portion_unit text not null default 'g' check (portion_unit in ('g','ml','colher','colher_sopa','concha')),
  add column portion_grams numeric not null default 100 check (portion_grams > 0 and portion_grams <= 5000);

-- Logical removal retains audit/correction/meal references.
alter table public.insulin_administrations add column deleted_at timestamptz;
create or replace function public.remove_insulin_administration(p_patient_id uuid, p_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null or not public.can_write_patient(p_patient_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  update public.insulin_administrations
    set deleted_at = coalesce(deleted_at, now())
    where id = p_id and patient_id = p_patient_id;
  if not found then
    raise exception 'Record unavailable' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.remove_insulin_administration(uuid,uuid) from public, anon;
grant execute on function public.remove_insulin_administration(uuid,uuid) to authenticated;
