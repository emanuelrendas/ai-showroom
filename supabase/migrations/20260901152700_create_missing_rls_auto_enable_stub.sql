create or replace function public.rls_auto_enable()
returns void
language plpgsql
as $$
begin
  -- Stub histórico. Sem implementação comitada conhecida em nenhuma
  -- migração. Existe só para que 20260901152756_lock_down_auto_rls_function.sql
  -- consiga revogar permissões sem erro de objeto inexistente.
  -- Nenhum papel recebe execute depois dessa migração, logo esta
  -- função fica permanentemente inacessível assim que a cadeia corre.
end;
$$;
