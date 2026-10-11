-- Read-only deployment check. Run in the project's SQL editor, not the browser.
-- Existing database objects are inspected; no patient rows or credentials are read.
select expected.name as object_name,
       to_regclass('public.' || expected.name) is not null as exists,
       coalesce(c.relrowsecurity, false) as rls_enabled,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_can_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_can_select
from (values ('patients'), ('patient_members'), ('glucose_readings'),
             ('libre_connections'), ('libre_drafts'), ('libre_login_limits')) expected(name)
left join pg_class c on c.oid = to_regclass('public.' || expected.name);

select expected.signature as function_signature,
       to_regprocedure('public.' || expected.signature) is not null as exists
from (values ('claim_libre_login(uuid)'),
             ('activate_libre(uuid,uuid,uuid,text,text,text,timestamp with time zone,jsonb)'),
             ('ingest_libre_readings(uuid,uuid,jsonb)')) expected(signature);
