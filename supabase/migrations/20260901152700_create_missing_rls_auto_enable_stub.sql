-- D3-TI-01 historical compatibility stub
-- PROVENANCE: public.rls_auto_enable() is a Supabase platform-owned object,
-- created by the Supabase platform bootstrap on 1 Sep 2026 outside this
-- repository's migration chain. Reconciled/documented on 12 Sep 2026 under
-- Emanuel Rendas Decision 2.
-- This historical stub mirrors the factual production return type only.
-- No remote Supabase application is authorized by this migration edit.

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
as $$
begin
  -- Historical compatibility stub. The real platform definition is reconciled
  -- later by 20260912082700_reconcile_rls_auto_enable_event_trigger.sql.
  -- This file exists so the historical migration chain is type-compatible
  -- with the platform-created production function.
end;
$$;