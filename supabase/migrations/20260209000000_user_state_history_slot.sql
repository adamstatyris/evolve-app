-- Existing projects: run once. New projects can rely on schema.sql only.
alter table public.user_state_history add column if not exists slot text;

create unique index if not exists user_state_history_user_slot_t1_t2_uidx
  on public.user_state_history (user_id, slot)
  where (slot is not null and slot in ('T-1', 'T-2'));

drop policy if exists "user_state_history_update_own" on public.user_state_history;
create policy "user_state_history_update_own"
  on public.user_state_history for update
  using (auth.uid() = user_id);
