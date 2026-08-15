-- Last seen, hide chat, message edit/delete/reply, and profile avatars

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

alter table public.conversation_members
  add column if not exists hidden_at timestamptz;

alter table public.messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null;

create index if not exists messages_reply_to_id_idx
  on public.messages (reply_to_id);

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
  return new;
end;
$$;

drop trigger if exists protect_message_identity on public.messages;
create trigger protect_message_identity
  before update on public.messages
  for each row
  execute function private.protect_message_identity();

revoke all on function private.protect_message_identity() from public, anon, authenticated;

drop policy if exists "messages_update_own" on public.messages;
create policy "messages_update_own"
  on public.messages for update to authenticated
  using (
    sender_id = (select auth.uid())
    and private.is_joined_member(conversation_id)
    and deleted_at is null
  )
  with check (
    sender_id = (select auth.uid())
    and private.is_joined_member(conversation_id)
  );

grant update on table public.messages to authenticated;

alter table public.messages replica identity full;

insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', true, 10485760)
on conflict (id) do update
  set public = true,
      file_size_limit = 10485760;

drop policy if exists "avatars_select" on storage.objects;
create policy "avatars_select"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
