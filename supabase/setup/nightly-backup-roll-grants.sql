-- Fix: nightly-backup-roll Edge Function returns 500
--   {"error":"permission denied for table user_state"}
-- Run once in Supabase Dashboard → SQL Editor (same pattern as push-reminders-grants.sql).

grant usage on schema public to service_role;

grant select, insert, update, delete on table public.user_state to service_role;
grant select, insert, update, delete on table public.user_state_history to service_role;
