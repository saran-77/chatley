-- Core phases: profile trigger, membership updates, key claim, realtime, storage

alter table public.devices
  add column if not exists signed_prekey_id int not null default 1;

alter table public.one_time_prekeys
  add column if not exists key_id int not null default 1;

create unique index if not exists one_time_prekeys_device_key_id_idx
  on public.one_time_prekeys (device_id, key_id);

alter table public.conversation_members
  add column if not exists last_read_at timestamptz;

create policy "members_update_own"
  on public.conversation_members for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant update on table public.conversation_members to authenticated;

create table if not exists public.sender_key_distributions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  ciphertext text not null,
  created_at timestamptz not null default now(),
  unique (conversation_id, sender_id, recipient_id)
);

alter table public.sender_key_distributions enable row level security;

create index sender_key_distributions_recipient_idx
  on public.sender_key_distributions (recipient_id, conversation_id);

create policy "skdm_select_own"
  on public.sender_key_distributions for select to authenticated
  using (
    recipient_id = (select auth.uid())
    or sender_id = (select auth.uid())
  );

create policy "skdm_insert_as_sender"
  on public.sender_key_distributions for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and private.is_conversation_member(conversation_id)
  );

grant select, insert on table public.sender_key_distributions to authenticated;
revoke all on table public.sender_key_distributions from anon, public;

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
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.claim_one_time_prekey(_device_id uuid)
returns table(id uuid, key_id int, public_key text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.one_time_prekeys
  set used = true
  where public.one_time_prekeys.id = (
    select p.id
    from public.one_time_prekeys p
    where p.device_id = _device_id
      and p.used = false
    order by p.key_id
    limit 1
    for update skip locked
  )
  returning public.one_time_prekeys.id, public.one_time_prekeys.key_id, public.one_time_prekeys.public_key;
end;
$$;

revoke all on function private.claim_one_time_prekey(uuid) from public;
grant execute on function private.claim_one_time_prekey(uuid) to authenticated;

create or replace function public.claim_one_time_prekey(_device_id uuid)
returns table(id uuid, key_id int, public_key text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.claim_one_time_prekey(_device_id);
$$;

grant execute on function public.claim_one_time_prekey(uuid) to authenticated;
revoke all on function public.claim_one_time_prekey(uuid) from public, anon;

do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.conversations;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.conversation_members;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.profiles;
  exception when duplicate_object then null;
  end;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-media', 'chat-media', false, 26214400)
on conflict (id) do nothing;

create policy "chat_media_select_member"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-media'
    and private.is_conversation_member((storage.foldername(name))[1]::uuid)
  );

create policy "chat_media_insert_member"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and private.is_conversation_member((storage.foldername(name))[1]::uuid)
  );

create policy "chat_media_update_member"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'chat-media'
    and private.is_conversation_member((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'chat-media'
    and private.is_conversation_member((storage.foldername(name))[1]::uuid)
  );

create policy "chat_media_delete_member"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-media'
    and private.is_conversation_member((storage.foldername(name))[1]::uuid)
  );
