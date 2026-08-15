-- Invites, joined-only messaging, reactions, shareable invite tokens

alter table public.conversation_members
  add column if not exists status text not null default 'joined';

alter table public.conversation_members
  drop constraint if exists conversation_members_status_check;

alter table public.conversation_members
  add constraint conversation_members_status_check
  check (status in ('pending', 'joined'));

alter table public.conversations
  add column if not exists invite_token uuid not null default gen_random_uuid();

create unique index if not exists conversations_invite_token_idx
  on public.conversations (invite_token);

create or replace function private.is_joined_member(_conversation_id uuid)
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
      and status = 'joined'
  );
$$;

revoke all on function private.is_joined_member(uuid) from public;
grant execute on function private.is_joined_member(uuid) to authenticated;

drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_joined"
  on public.messages for select to authenticated
  using (private.is_joined_member(conversation_id));

drop policy if exists "messages_insert_self_if_member" on public.messages;
create policy "messages_insert_self_if_joined"
  on public.messages for insert to authenticated
  with check (
    private.is_joined_member(conversation_id)
    and (select auth.uid()) = sender_id
  );

drop policy if exists "members_insert_bootstrap_or_member" on public.conversation_members;
create policy "members_insert_bootstrap_or_joined"
  on public.conversation_members for insert to authenticated
  with check (
    (
      (select auth.uid()) = user_id
      and not private.conversation_has_members(conversation_id)
    )
    or private.is_joined_member(conversation_id)
  );

drop policy if exists "conversations_update_member" on public.conversations;
create policy "conversations_update_joined"
  on public.conversations for update to authenticated
  using (private.is_joined_member(id))
  with check (private.is_joined_member(id));

drop policy if exists "conversations_delete_member" on public.conversations;
create policy "conversations_delete_joined"
  on public.conversations for delete to authenticated
  using (private.is_joined_member(id));

drop policy if exists "chat_media_select_member" on storage.objects;
create policy "chat_media_select_joined"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-media'
    and private.is_joined_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "chat_media_insert_member" on storage.objects;
create policy "chat_media_insert_joined"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and private.is_joined_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "chat_media_update_member" on storage.objects;
create policy "chat_media_update_joined"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'chat-media'
    and private.is_joined_member((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'chat-media'
    and private.is_joined_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "chat_media_delete_member" on storage.objects;
create policy "chat_media_delete_joined"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-media'
    and private.is_joined_member((storage.foldername(name))[1]::uuid)
  );

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

alter table public.message_reactions enable row level security;

create index if not exists message_reactions_message_id_idx
  on public.message_reactions (message_id);

create policy "reactions_select_joined"
  on public.message_reactions for select to authenticated
  using (
    exists (
      select 1
      from public.messages m
      where m.id = message_id
        and private.is_joined_member(m.conversation_id)
    )
  );

create policy "reactions_insert_own_joined"
  on public.message_reactions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.messages m
      where m.id = message_id
        and private.is_joined_member(m.conversation_id)
    )
  );

create policy "reactions_delete_own"
  on public.message_reactions for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.message_reactions from anon, public;
grant select, insert, delete on table public.message_reactions to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.message_reactions;
  exception when duplicate_object then null;
  end;
end;
$$;

create or replace function private.join_by_invite_token(_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv_id uuid;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  select id into conv_id
  from public.conversations
  where invite_token = _token;
  if conv_id is null then
    raise exception 'Invite not found';
  end if;
  insert into public.conversation_members (conversation_id, user_id, status, role)
  values (conv_id, uid, 'joined', 'member')
  on conflict (conversation_id, user_id) do update
    set status = 'joined';
  return conv_id;
end;
$$;

revoke all on function private.join_by_invite_token(uuid) from public;
grant execute on function private.join_by_invite_token(uuid) to authenticated;

create or replace function public.join_by_invite_token(_token uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.join_by_invite_token(_token);
$$;

grant execute on function public.join_by_invite_token(uuid) to authenticated;
revoke all on function public.join_by_invite_token(uuid) from public, anon;

create or replace function private.preview_invite(_token uuid)
returns table (id uuid, type text, name text, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.type, c.name, c.avatar_path
  from public.conversations c
  where c.invite_token = _token;
$$;

revoke all on function private.preview_invite(uuid) from public;
grant execute on function private.preview_invite(uuid) to authenticated;

create or replace function public.preview_invite(_token uuid)
returns table (id uuid, type text, name text, avatar_path text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.preview_invite(_token);
$$;

grant execute on function public.preview_invite(uuid) to authenticated;
revoke all on function public.preview_invite(uuid) from public, anon;
