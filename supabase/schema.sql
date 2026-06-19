-- Run in Supabase: Dashboard → SQL → New query. Step-by-step: README "Supabase setup".
-- Stores the full multi-profile ROOT blob as JSON (Phase D sync).

create table if not exists public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists user_state_updated_at_idx on public.user_state (updated_at desc);

alter table public.user_state enable row level security;

create policy "user_state_select_own"
  on public.user_state for select
  using (auth.uid() = user_id);

create policy "user_state_insert_own"
  on public.user_state for insert
  with check (auth.uid() = user_id);

create policy "user_state_update_own"
  on public.user_state for update
  using (auth.uid() = user_id);

create policy "user_state_delete_own"
  on public.user_state for delete
  using (auth.uid() = user_id);

-- Rolling cloud backups: slots T-1 / T-2 (maintained by nightly Edge Function + pre-delete snapshots), plus optional auto-revert audit rows.
create table if not exists public.user_state_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null,
  saved_at timestamptz not null,
  slot text
);

create index if not exists user_state_history_user_saved_idx on public.user_state_history (user_id, saved_at desc);

create unique index if not exists user_state_history_user_slot_t1_t2_uidx
  on public.user_state_history (user_id, slot)
  where (slot is not null and slot in ('T-1', 'T-2'));

alter table public.user_state_history enable row level security;

create policy "user_state_history_select_own"
  on public.user_state_history for select
  using (auth.uid() = user_id);

create policy "user_state_history_insert_own"
  on public.user_state_history for insert
  with check (auth.uid() = user_id);

create policy "user_state_history_delete_own"
  on public.user_state_history for delete
  using (auth.uid() = user_id);

create policy "user_state_history_update_own"
  on public.user_state_history for update
  using (auth.uid() = user_id);

-- Web Push: one row per browser subscription (VAPID). Edge Function uses service role to send.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update
  using (auth.uid() = user_id);

create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- Pending reminder fires (exact habit times for v1). Cron invokes Edge Function to send via Web Push.
create table if not exists public.reminder_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slot_key text not null,
  fire_at_utc timestamptz not null,
  title text not null default 'Consistency',
  body text not null default '',
  tag text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, slot_key, fire_at_utc)
);

create index if not exists reminder_schedule_due_idx
  on public.reminder_schedule (fire_at_utc)
  where (sent_at is null);

alter table public.reminder_schedule enable row level security;

create policy "reminder_schedule_select_own"
  on public.reminder_schedule for select
  using (auth.uid() = user_id);

create policy "reminder_schedule_insert_own"
  on public.reminder_schedule for insert
  with check (auth.uid() = user_id);

create policy "reminder_schedule_update_own"
  on public.reminder_schedule for update
  using (auth.uid() = user_id);

create policy "reminder_schedule_delete_own"
  on public.reminder_schedule for delete
  using (auth.uid() = user_id);

-- Edge Functions (service_role): sync backups and reminder delivery.
grant select, insert, update, delete on table public.user_state to service_role;
grant select, insert, update, delete on table public.user_state_history to service_role;
grant select, insert, update, delete on table public.push_subscriptions to service_role;
grant select, insert, update, delete on table public.reminder_schedule to service_role;
