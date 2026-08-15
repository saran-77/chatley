alter table public.conversations
  add column if not exists avatar_path text;

alter table public.conversation_members
  add column if not exists pinned_at timestamptz;

create policy "members_delete_own"
  on public.conversation_members for delete to authenticated
  using ((select auth.uid()) = user_id);

grant delete on table public.conversation_members to authenticated;
