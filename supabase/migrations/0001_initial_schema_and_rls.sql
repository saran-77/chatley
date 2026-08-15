-- Chatley Phase 1: schema, private membership helpers, RLS, indexes

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to postgres, service_role;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  status text,
  created_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  identity_pub_key text not null,
  signed_prekey text not null,
  signed_prekey_sig text not null,
  registration_id int not null,
  created_at timestamptz not null default now()
);

create table public.one_time_prekeys (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  public_key text not null,
  used boolean not null default false
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('dm', 'group')),
  name text,
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id),
  ciphertext text not null,
  sent_at timestamptz not null default now()
);

create index devices_user_id_idx on public.devices (user_id);
create index one_time_prekeys_device_id_idx on public.one_time_prekeys (device_id);
create index conversation_members_user_id_idx on public.conversation_members (user_id);
create index messages_conversation_id_sent_at_idx on public.messages (conversation_id, sent_at);
create index messages_sender_id_idx on public.messages (sender_id);

create or replace function private.is_conversation_member(_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members
    where conversation_id = _conversation_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function private.conversation_has_members(_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members
    where conversation_id = _conversation_id
  );
$$;

create or replace function private.is_device_owner(_device_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.devices
    where id = _device_id
      and user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_conversation_member(uuid) from public;
revoke all on function private.conversation_has_members(uuid) from public;
revoke all on function private.is_device_owner(uuid) from public;

grant execute on function private.is_conversation_member(uuid) to authenticated;
grant execute on function private.conversation_has_members(uuid) to authenticated;
grant execute on function private.is_device_owner(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.one_time_prekeys enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "devices_select_authenticated"
  on public.devices for select to authenticated
  using (true);

create policy "devices_insert_own"
  on public.devices for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "devices_update_own"
  on public.devices for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "devices_delete_own"
  on public.devices for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "prekeys_select_authenticated"
  on public.one_time_prekeys for select to authenticated
  using (true);

create policy "prekeys_insert_own_device"
  on public.one_time_prekeys for insert to authenticated
  with check (private.is_device_owner(device_id));

create policy "prekeys_delete_own_device"
  on public.one_time_prekeys for delete to authenticated
  using (private.is_device_owner(device_id));

create policy "conversations_select_member"
  on public.conversations for select to authenticated
  using (private.is_conversation_member(id));

create policy "conversations_insert_authenticated"
  on public.conversations for insert to authenticated
  with check (true);

create policy "conversations_update_member"
  on public.conversations for update to authenticated
  using (private.is_conversation_member(id))
  with check (private.is_conversation_member(id));

create policy "conversations_delete_member"
  on public.conversations for delete to authenticated
  using (private.is_conversation_member(id));

create policy "members_select_if_member"
  on public.conversation_members for select to authenticated
  using (private.is_conversation_member(conversation_id));

create policy "members_insert_bootstrap_or_member"
  on public.conversation_members for insert to authenticated
  with check (
    (
      (select auth.uid()) = user_id
      and not private.conversation_has_members(conversation_id)
    )
    or private.is_conversation_member(conversation_id)
  );

create policy "messages_select_member"
  on public.messages for select to authenticated
  using (private.is_conversation_member(conversation_id));

create policy "messages_insert_self_if_member"
  on public.messages for insert to authenticated
  with check (
    private.is_conversation_member(conversation_id)
    and (select auth.uid()) = sender_id
  );

revoke all on table public.profiles from anon, public;
revoke all on table public.devices from anon, public;
revoke all on table public.one_time_prekeys from anon, public;
revoke all on table public.conversations from anon, public;
revoke all on table public.conversation_members from anon, public;
revoke all on table public.messages from anon, public;

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.devices to authenticated;
grant select, insert, delete on table public.one_time_prekeys to authenticated;
grant select, insert, update, delete on table public.conversations to authenticated;
grant select, insert on table public.conversation_members to authenticated;
grant select, insert on table public.messages to authenticated;
