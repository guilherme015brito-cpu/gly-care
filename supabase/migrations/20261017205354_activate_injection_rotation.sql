begin;
create trigger enforce_injection_rotation
before insert or update on public.insulin_administrations
for each row execute function public.enforce_injection_rotation();
notify pgrst,'reload schema';
commit;
