alter table public.conversations
  add column created_by uuid references public.profiles(id);

update public.conversations
  set created_by = (
    select user_id
    from public.conversation_members m
    where m.conversation_id = conversations.id
    order by joined_at
    limit 1
  )
  where created_by is null;

alter table public.conversations
  alter column created_by set default auth.uid();

drop policy if exists "conversations_select_member" on public.conversations;
drop policy if exists "conversations_insert_authenticated" on public.conversations;
drop policy if exists "conversations_update_member" on public.conversations;
drop policy if exists "conversations_delete_member" on public.conversations;

create policy "conversations_select_member"
  on public.conversations for select to authenticated
  using (
    private.is_conversation_member(id)
    or (
      created_by = (select auth.uid())
      and not private.conversation_has_members(id)
    )
  );

create policy "conversations_insert_authenticated"
  on public.conversations for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "conversations_update_member"
  on public.conversations for update to authenticated
  using (private.is_conversation_member(id))
  with check (private.is_conversation_member(id));

create policy "conversations_delete_member"
  on public.conversations for delete to authenticated
  using (
    private.is_conversation_member(id)
    or (
      created_by = (select auth.uid())
      and not private.conversation_has_members(id)
    )
  );
