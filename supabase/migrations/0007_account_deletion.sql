-- Allow Auth user deletion to cascade without leftover chat FKs blocking it.

alter table public.messages
  drop constraint messages_sender_id_fkey;

alter table public.messages
  add constraint messages_sender_id_fkey
  foreign key (sender_id) references public.profiles(id) on delete set null;

alter table public.conversations
  drop constraint conversations_created_by_fkey;

alter table public.conversations
  add constraint conversations_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;
