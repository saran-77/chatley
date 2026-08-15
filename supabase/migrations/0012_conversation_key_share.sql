-- Let joined members share and refresh wrapped conversation keys.

drop policy if exists "conversation_keys_select_own_joined" on public.conversation_keys;
create policy "conversation_keys_select_joined"
  on public.conversation_keys for select to authenticated
  using (private.is_joined_member(conversation_id));

drop policy if exists "conversation_keys_update_joined" on public.conversation_keys;
create policy "conversation_keys_update_joined"
  on public.conversation_keys for update to authenticated
  using (private.is_joined_member(conversation_id))
  with check (
    private.is_joined_member(conversation_id)
    and private.is_joined_user(conversation_id, user_id)
  );

grant update on table public.conversation_keys to authenticated;
