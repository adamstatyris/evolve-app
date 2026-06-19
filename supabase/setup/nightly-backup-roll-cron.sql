-- Evolve: schedule the nightly-backup-roll Edge Function (T-1 / T-2 rolling cloud backups).
-- Run once in Supabase Dashboard → SQL Editor after deploying nightly-backup-roll and setting secrets.
--
-- Prerequisites:
--   1. supabase/migrations/20260209000000_user_state_history_slot.sql applied (slot column + update RLS)
--   2. supabase/setup/nightly-backup-roll-grants.sql applied (service_role table grants)
--   3. supabase functions deploy nightly-backup-roll --no-verify-jwt
--
-- Option A (recommended): Supabase Dashboard → Edge Functions → nightly-backup-roll → Schedules
--   Method: POST
--   Cron: 15 0 * * *   (00:15 UTC daily)
--   Header: x-cron-secret: <your CRON_SECRET>
--
-- Option B: pg_cron + pg_net (below). Replace placeholders before running.

-- enable extension if not already (Dashboard → Database → Extensions: pg_cron, pg_net)
-- create extension if not exists pg_cron with schema extensions;
-- create extension if not exists pg_net with schema extensions;

-- Remove old job name if re-running
-- select cron.unschedule('evolve-nightly-backup-roll');

/*
select cron.schedule(
  'evolve-nightly-backup-roll',
  '15 0 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/nightly-backup-roll',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'REPLACE_WITH_YOUR_CRON_SECRET'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);
*/

-- Manual test (curl):
-- curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/nightly-backup-roll" \
--   -H "Content-Type: application/json" \
--   -H "x-cron-secret: YOUR_CRON_SECRET"
-- Expected: {"ok":true,"processed":N,"errors":0,"scanned":M}
