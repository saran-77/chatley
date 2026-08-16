-- Encrypted read watermark. last_read_at stays as a fallback for older clients.

alter table public.conversation_members
  add column if not exists read_mark text;
