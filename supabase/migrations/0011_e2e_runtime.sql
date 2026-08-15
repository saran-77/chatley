-- Stamp joined_at when membership becomes joined, hide older messages from new members,
-- install conversation key epochs atomically, and freeze message key_epoch on edit.

create or replace function private.stamp_joined_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'joined' then
    if tg_op = 'INSERT' then
      new.joined_at := coalesce(new.joined_at, now());
    elsif old.status is distinct from 'joined' then
      new.joined_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_joined_at on public.conversation_members;
create trigger stamp_joined_at
  before insert or update of status on public.conversation_members
  for each row
  execute function private.stamp_joined_at();

revoke all on function private.stamp_joined_at() from public, anon, authenticated;

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

create or replace function private.member_joined_at(_conversation_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select joined_at
  from public.conversation_members
  where conversation_id = _conversation_id
    and user_id = (select auth.uid())
    and status = 'joined'
$$;

revoke all on function private.member_joined_at(uuid) from public;
grant execute on function private.member_joined_at(uuid) to authenticated;

drop policy if exists "messages_select_joined" on public.messages;
create policy "messages_select_joined"
  on public.messages for select to authenticated
  using (
    private.is_joined_member(conversation_id)
    and sent_at >= private.member_joined_at(conversation_id)
  );

create or replace function private.is_joined_user(_conversation_id uuid, _user_id uuid)
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
      and user_id = _user_id
      and status = 'joined'
  );
$$;

revoke all on function private.is_joined_user(uuid, uuid) from public;
grant execute on function private.is_joined_user(uuid, uuid) to authenticated;

drop policy if exists "conversation_keys_insert_joined" on public.conversation_keys;
create policy "conversation_keys_insert_joined"
  on public.conversation_keys for insert to authenticated
  with check (
    private.is_joined_member(conversation_id)
    and private.is_joined_user(conversation_id, user_id)
  );

create or replace function private.install_conversation_epoch(
  _conversation_id uuid,
  _epoch integer,
  _wraps jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_epoch int;
  wrap jsonb;
  wrap_user uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;
  if not private.is_joined_member(_conversation_id) then
    raise exception 'Not a member';
  end if;
  if _epoch < 1 or jsonb_typeof(_wraps) is distinct from 'array' or jsonb_array_length(_wraps) < 1 then
    raise exception 'Invalid wraps';
  end if;

  select key_epoch into current_epoch
  from public.conversations
  where id = _conversation_id
  for update;

  if current_epoch is null then
    raise exception 'Conversation not found';
  end if;
  if current_epoch <> _epoch - 1 then
    raise exception 'Epoch conflict';
  end if;

  for wrap in select value from jsonb_array_elements(_wraps) as t(value)
  loop
    wrap_user := (wrap->>'user_id')::uuid;
    if wrap->>'wrapped_key' is null or length(wrap->>'wrapped_key') = 0 then
      raise exception 'Invalid wrap';
    end if;
    if not private.is_joined_user(_conversation_id, wrap_user) then
      raise exception 'Wrap target is not joined';
    end if;
    insert into public.conversation_keys (conversation_id, user_id, epoch, wrapped_key)
    values (_conversation_id, wrap_user, _epoch, wrap->>'wrapped_key');
  end loop;

  update public.conversations
  set key_epoch = _epoch
  where id = _conversation_id;

  return _epoch;
end;
$$;

revoke all on function private.install_conversation_epoch(uuid, integer, jsonb) from public;
grant execute on function private.install_conversation_epoch(uuid, integer, jsonb) to authenticated;

create or replace function public.install_conversation_epoch(
  _conversation_id uuid,
  _epoch integer,
  _wraps jsonb
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.install_conversation_epoch(_conversation_id, _epoch, _wraps);
$$;

grant execute on function public.install_conversation_epoch(uuid, integer, jsonb) to authenticated;
revoke all on function public.install_conversation_epoch(uuid, integer, jsonb) from public, anon;

create or replace function private.protect_message_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.conversation_id := old.conversation_id;
  new.sender_id := old.sender_id;
  new.sent_at := old.sent_at;
  new.reply_to_id := old.reply_to_id;
  new.key_epoch := old.key_epoch;
  return new;
end;
$$;
