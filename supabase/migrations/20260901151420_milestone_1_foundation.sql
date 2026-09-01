create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'archived')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'blocked', 'done', 'cancelled')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references public.missions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null default 'New conversation',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant', 'tool')),
  content text not null,
  created_at timestamptz not null default now()
);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function private.touch_updated_at();

create trigger workspaces_touch_updated_at
before update on public.workspaces
for each row execute function private.touch_updated_at();

create trigger projects_touch_updated_at
before update on public.projects
for each row execute function private.touch_updated_at();

create trigger missions_touch_updated_at
before update on public.missions
for each row execute function private.touch_updated_at();

create trigger conversations_touch_updated_at
before update on public.conversations
for each row execute function private.touch_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'User'
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.profiles (id, display_name, avatar_url)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'display_name', ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'User'
  ),
  nullif(u.raw_user_meta_data ->> 'avatar_url', '')
from auth.users u
on conflict (id) do nothing;

create or replace function private.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_workspace_role(
  p_workspace_id uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = any(p_roles)
  );
$$;

create or replace function private.is_workspace_creator(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = p_workspace_id
      and w.created_by = (select auth.uid())
  );
$$;

create or replace function private.workspace_has_members(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
  );
$$;

revoke all on function private.is_workspace_member(uuid) from public, anon;
revoke all on function private.has_workspace_role(uuid, text[]) from public, anon;
revoke all on function private.is_workspace_creator(uuid) from public, anon;
revoke all on function private.workspace_has_members(uuid) from public, anon;

grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.has_workspace_role(uuid, text[]) to authenticated;
grant execute on function private.is_workspace_creator(uuid) to authenticated;
grant execute on function private.workspace_has_members(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.missions enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy workspaces_select_member
on public.workspaces
for select
to authenticated
using (private.is_workspace_member(id));

create policy workspaces_insert_authenticated
on public.workspaces
for insert
to authenticated
with check (created_by = (select auth.uid()));

create policy workspaces_update_admin
on public.workspaces
for update
to authenticated
using (private.has_workspace_role(id, array['owner', 'admin']))
with check (private.has_workspace_role(id, array['owner', 'admin']));

create policy workspaces_delete_owner
on public.workspaces
for delete
to authenticated
using (private.has_workspace_role(id, array['owner']));

create policy workspace_members_select_member
on public.workspace_members
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy workspace_members_insert_admin_or_bootstrap
on public.workspace_members
for insert
to authenticated
with check (
  private.has_workspace_role(workspace_id, array['owner', 'admin'])
  or (
    user_id = (select auth.uid())
    and role = 'owner'
    and private.is_workspace_creator(workspace_id)
    and not private.workspace_has_members(workspace_id)
  )
);

create policy workspace_members_update_admin
on public.workspace_members
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']))
with check (private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy workspace_members_delete_admin
on public.workspace_members
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy projects_select_member
on public.projects
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy projects_insert_member
on public.projects
for insert
to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

create policy projects_update_member
on public.projects
for update
to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));

create policy projects_delete_member
on public.projects
for delete
to authenticated
using (private.is_workspace_member(workspace_id));

create policy missions_select_member
on public.missions
for select
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and private.is_workspace_member(p.workspace_id)
  )
);

create policy missions_insert_member
on public.missions
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.projects p
    where p.id = project_id
      and private.is_workspace_member(p.workspace_id)
  )
);

create policy missions_update_member
on public.missions
for update
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and private.is_workspace_member(p.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and private.is_workspace_member(p.workspace_id)
  )
);

create policy missions_delete_member
on public.missions
for delete
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and private.is_workspace_member(p.workspace_id)
  )
);

create policy conversations_select_member
on public.conversations
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy conversations_insert_member
on public.conversations
for insert
to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
  and (
    mission_id is null
    or exists (
      select 1
      from public.missions m
      join public.projects p on p.id = m.project_id
      where m.id = mission_id
        and p.workspace_id = conversations.workspace_id
    )
  )
);

create policy conversations_update_member
on public.conversations
for update
to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));

create policy conversations_delete_member
on public.conversations
for delete
to authenticated
using (private.is_workspace_member(workspace_id));

create policy messages_select_member
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and private.is_workspace_member(c.workspace_id)
  )
);

create policy messages_insert_member
on public.messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and private.is_workspace_member(c.workspace_id)
  )
);

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
  v_workspace_id uuid;
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

  insert into public.workspaces (name, slug, created_by)
  values (trim(p_name), p_slug, (select auth.uid()))
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, (select auth.uid()), 'owner');

  return v_workspace_id;
end;
$$;

revoke all on function public.create_workspace_with_owner(text, text) from public, anon;
grant execute on function public.create_workspace_with_owner(text, text) to authenticated;

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.missions to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;