-- Drop Signal Protocol key material and store messages as plaintext JSON.

drop function if exists public.claim_one_time_prekey(uuid);
drop function if exists private.claim_one_time_prekey(uuid);

drop table if exists public.sender_key_distributions;
drop table if exists public.one_time_prekeys;
drop table if exists public.devices;

drop function if exists private.is_device_owner(uuid);

delete from public.messages;

alter table public.messages rename column ciphertext to body;
