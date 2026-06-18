-- Evolve: schedule the push-reminders Edge Function (required for notifications to ring).
-- Run once in Supabase Dashboard → SQL Editor after deploying push-reminders and setting secrets.
--
-- Prerequisites:
--   1. supabase functions deploy push-reminders --no-verify-jwt
--   2. supabase secrets set VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_SUBJECT="mailto:you@example.com" CRON_SECRET="long-random-secret"
--   3. CONSISTENCY_VAPID_PUBLIC_KEY in index.html matches VAPID_PUBLIC_KEY secret
--
-- Option A (recommended): Supabase Dashboard → Edge Functions → push-reminders → Schedules
--   Method: POST
--   Cron: */3 * * * *   (every 3 minutes)
--   Header: x-cron-secret: <your CRON_SECRET>
--
-- Option B: pg_cron + pg_net (below). Replace placeholders before running.

-- enable extension if not already (Dashboard → Database → Extensions: pg_cron, pg_net)
-- create extension if not exists pg_cron with schema extensions;
-- create extension if not exists pg_net with schema extensions;

-- Remove old job name if re-running
-- select cron.unschedule('evolve-push-reminders');

/*
select cron.schedule(
  'evolve-push-reminders',
  '*/3 * * * *',
  $$
  select net.http_post(
    url := 'https://sgnuxxqkverroxdskvrd.supabase.co/functions/v1/push-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'REPLACE_WITH_YOUR_CRON_SECRET'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
*/

-- Manual test (curl from your machine — proves function + VAPID + secrets):
-- curl -X POST "https://sgnuxxqkverroxdskvrd.supabase.co/functions/v1/push-reminders" \
--   -H "Content-Type: application/json" \
--   -H "x-cron-secret: YOUR_CRON_SECRET"
-- Expected: {"scanned":N,"sent":M} — scanned>0 if due rows exist; sent>0 if push_subscriptions + VAPID OK
