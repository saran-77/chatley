-- Envelope encryption: identity keys, wrapped conversation keys, message nonces

alter table public.profiles
  add column if not exists identity_pub_key text;

alter table public.conversations
  add column if not exists key_epoch int not null default 0;

alter table public.messages
  add column if not exists nonce text;

alter table public.messages
  add column if not exists key_epoch int;

create table if not exists public.identity_backups (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  kdf_salt text not null,
  wrapped_identity_sk text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_keys (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  epoch int not null,
  wrapped_key text not null,
  primary key (conversation_id, user_id, epoch)
);

create index if not exists conversation_keys_user_id_idx
  on public.conversation_keys (user_id);

alter table public.identity_backups enable row level security;
alter table public.conversation_keys enable row level security;

create policy "identity_backups_own_select"
  on public.identity_backups for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "identity_backups_own_insert"
  on public.identity_backups for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "identity_backups_own_update"
  on public.identity_backups for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "identity_backups_own_delete"
  on public.identity_backups for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "conversation_keys_select_own_joined"
  on public.conversation_keys for select to authenticated
  using (
    (select auth.uid()) = user_id
    and private.is_joined_member(conversation_id)
  );

create policy "conversation_keys_insert_joined"
  on public.conversation_keys for insert to authenticated
  with check (private.is_joined_member(conversation_id));

revoke all on table public.identity_backups from anon, public;
revoke all on table public.conversation_keys from anon, public;

grant select, insert, update, delete on table public.identity_backups to authenticated;
grant select, insert on table public.conversation_keys to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.conversation_keys;
  exception when duplicate_object then null;
  end;
end;
$$;
