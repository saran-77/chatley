create table if not exists public.message_hides (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_hides enable row level security;

create index if not exists message_hides_user_id_idx
  on public.message_hides (user_id);

create policy "message_hides_select_own"
  on public.message_hides for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "message_hides_insert_own_joined"
  on public.message_hides for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.messages m
      where m.id = message_id
        and private.is_joined_member(m.conversation_id)
    )
  );

create policy "message_hides_delete_own"
  on public.message_hides for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.message_hides from anon, public;
grant select, insert, delete on table public.message_hides to authenticated;

alter table public.message_hides replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.message_hides;
  exception when duplicate_object then null;
  end;
end;
$$;
