create or replace function public.create_workspace_with_owner(
  p_name text,
  p_slug text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workspace_id uuid := gen_random_uuid();
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if length(trim(p_name)) < 2 then
    raise exception 'Workspace name must be at least 2 characters';
  end if;

  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Workspace slug is invalid';
  end if;

  insert into public.workspaces (id, name, slug, created_by)
  values (v_workspace_id, trim(p_name), p_slug, (select auth.uid()));

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, (select auth.uid()), 'owner');

  return v_workspace_id;
end;
$$;

revoke all on function public.create_workspace_with_owner(text, text) from public, anon;
grant execute on function public.create_workspace_with_owner(text, text) to authenticated;
