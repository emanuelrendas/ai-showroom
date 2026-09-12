-- D3-TI-01 RLS parity remediation
-- Read-only drift verification: 12 SET 2026, Control Tower (Cowork, Sonnet 5)
-- Reproduces, in repository-built environments, the auto-RLS event trigger
-- mechanism observed live in Supabase project yljvselkecxdfrqwyums (ai-showroom).
-- PROVENANCE OF THE LIVE FUNCTION IS UNVERIFIED: it exists in production
-- outside any migration in this repository's history. This migration mirrors
-- its observed definition for parity; it does not confirm how or when it was
-- created in production.
-- This migration is NOT applied to yljvselkecxdfrqwyums remotely as part of
-- this mission. It exists so fresh/local/branch/staging environments built
-- from this migration chain reproduce the same behavior.

drop event trigger if exists ensure_rls;
drop function if exists public.rls_auto_enable() cascade;

create function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
cmd record;
begin
for cmd in
select *
from pg_event_trigger_ddl_commands()
where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
and object_type in ('table','partitioned table')
loop
if cmd.schema_name is not null and cmd.schema_name in ('public') and cmd.schema_name not in ('pg_catalog','information_schema') and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
begin
execute format('alter table if exists %s enable row level security', cmd.object_identity);
raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
exception
when others then
raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
end;
else
raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
end if;
end loop;
end;
$function$;

create event trigger ensure_rls
on ddl_command_end
when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
execute function public.rls_auto_enable();

revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;

-- KNOWN BEHAVIOR CARRIED OVER FROM PRODUCTION, NOT A NEW DECISION:
-- the EXCEPTION WHEN OTHERS block swallows any failure to enable RLS and only
-- logs it; the CREATE TABLE / CREATE TABLE AS / SELECT INTO statement still
-- succeeds even if RLS could not be enabled. This mirrors the live function
-- exactly, it is not hardened here. Hardening this behavior is a separate
-- decision for Emanuel.
