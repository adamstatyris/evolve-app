# Phase B — Push notifications diagnostic checklist

**Status:** Code path verified in repo; delivery requires Supabase dashboard configuration.

## What the app does (client)

1. User enables **Browser reminders** (Settings → Preferences).
2. User grants notification permission on an **installed PWA** (iOS requires home-screen install).
3. Client upserts `push_subscriptions` via `ensureWebPushSubscription()` (`index.html`).
4. Client writes pending rows to `reminder_schedule` via `syncReminderScheduleToSupabase()` (debounced on edit; full refresh after SW register, visibility, ~00:10 UTC).
5. `CONSISTENCY_VAPID_PUBLIC_KEY` in `index.html` must match server `VAPID_PUBLIC_KEY` secret.

## What the server does

- Edge Function: `supabase/functions/push-reminders/index.ts`
- Selects due rows: `sent_at IS NULL`, `fire_at_utc <= now`, not older than 7 days (`STALE_MS`).
- Sends Web Push via `web-push`; marks `sent_at` on success; prunes 404/410 subscriptions.

## Diagnose in this order

| # | Check | Where | Pass criteria |
|---|--------|--------|----------------|
| 1 | Cron invokes `push-reminders` | Supabase Dashboard → Edge Functions → cron, or pg_cron + pg_net | POST every 3–15 min with header `x-cron-secret: <CRON_SECRET>` |
| 2 | Secrets set | `supabase secrets list` | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` non-empty |
| 3 | VAPID match | Compare `index.html` `CONSISTENCY_VAPID_PUBLIC_KEY` vs `VAPID_PUBLIC_KEY` secret | Byte-for-byte equal; re-subscribe users after change |
| 4 | Data present | Table Editor | `push_subscriptions` row for test user; `reminder_schedule` row with `sent_at` null and `fire_at_utc` in the past |
| 5 | Manual invoke | `curl -X POST …/functions/v1/push-reminders -H "x-cron-secret: …"` | JSON `{scanned, sent}`; `scanned>0` means due rows exist |
| 6 | Device test | Installed PWA on real phone | Notification rings at due time |

## Strongest suspect

**No cron job calling `push-reminders`.** Tables populate correctly but nothing sends until the function is invoked on a schedule. See `README.md` Web Push section for pg_cron example.

## Nightly backup roll

`nightly-backup-roll` at ~00:15 UTC rebuilds `reminder_schedule` from cloud `user_state` — ensure this cron exists too if schedules go stale overnight.
