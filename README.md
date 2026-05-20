# Consistency

A habit and goal tracker built around weekly consistency, gentle scoring, and weekly treats. Single-file PWA ÔÇö installable on Android and iOS.

## Status

Closed beta (**v2.2.1**). **Auth:** Supabase (Google + email magic link). **Cloud sync:** signed-in users sync the full multi-profile `ROOT` to Supabase (`user_state`) from **Settings ÔåÆ Account**. **Automatic cloud backups:** two rolling snapshots per account (**T-1** / **T-2**) live in `user_state_history` (column **`slot`**). They are updated **server-side** by the **`nightly-backup-roll`** Edge Function (e.g. daily at 00:10 UTC). The app also refreshes **T-1** / **T-2** immediately before a **destructive profile or goal delete** when sync is on. **Settings ÔåÆ Advanced ÔåÆ Automatic cloud backups** lists **Revert to yesterday** (T-1) and **Revert to 2 days ago** (T-2) when those rows exist.

## Repository layout

```
.
Ôö£ÔöÇÔöÇ index.html              # Entire app (HTML + CSS + JS in one file)
Ôö£ÔöÇÔöÇ manifest.webmanifest    # PWA manifest
Ôö£ÔöÇÔöÇ sw.js                   # Service worker: fetch + Web Push handler only
Ôö£ÔöÇÔöÇ _headers                # Cloudflare Pages cache rules
Ôö£ÔöÇÔöÇ supabase/
Ôöé   Ôö£ÔöÇÔöÇ migrations/            # Incremental SQL (e.g. slot column for existing DBs)
Ôöé   Ôö£ÔöÇÔöÇ functions/push-reminders/      # Edge Function: cron sends due rows via Web Push
Ôöé   ÔööÔöÇÔöÇ functions/nightly-backup-roll/ # Edge Function: nightly T-1/T-2 rolling backups
Ôö£ÔöÇÔöÇ icons/                  # PWA icons (192, 512, apple-touch)
ÔööÔöÇÔöÇ README.md
```

## Supabase setup (cloud sync + backups)

Do this in the [Supabase Dashboard](https://supabase.com/dashboard) for **the same project** your app uses (Project URL + anon key in the frontend).

1. Open your project ÔåÆ **SQL Editor** (left sidebar) ÔåÆ **New query**.
2. Open [`supabase/schema.sql`](supabase/schema.sql) in this repo and **copy the entire file** into the editor.  
   - **New project:** run the full script once.  
   - **Already migrated `user_state`:** if the editor reports errors such as *policy already exists* for `user_state_*`, do **not** re-run those lines ÔÇö copy only the block in `schema.sql` from `-- Rolling cloud backups` through the last `user_state_history` policy and run **that** once (or run [`supabase/migrations/20260209000000_user_state_history_slot.sql`](supabase/migrations/20260209000000_user_state_history_slot.sql) to add `slot` + policies on an older database). For **Web Push**, copy from `-- Web Push:` through the last `reminder_schedule` policy and run that once (see [Web Push](#web-push-supabase-edge-function--cron)).
3. Click **Run** (or **Ctrl+Enter**). You should see success; no rows returned is normal.
4. Quick check: **Table Editor** ÔåÆ confirm **`user_state`** and **`user_state_history`** exist and RLS is enabled (shield icon). If you ran the Web Push block, **`push_subscriptions`** and **`reminder_schedule`** should also appear.
5. Deploy or refresh the app; sign in and use **Sync now** once. **Advanced → Automatic cloud backups** fills in after the **`nightly-backup-roll`** job has run at least once (or after you trigger the function manually). If `user_state_history` is missing, uploads still work; revert buttons stay disabled.

### Nightly rolling backups (`nightly-backup-roll`)

1. Run the migration in [`supabase/migrations/20260209000000_user_state_history_slot.sql`](supabase/migrations/20260209000000_user_state_history_slot.sql) (or ensure [`supabase/schema.sql`](supabase/schema.sql) is applied) so `user_state_history.slot` exists and **`user_state_history_update_own`** RLS is present.
2. Deploy: `supabase functions deploy nightly-backup-roll --no-verify-jwt`
3. Reuse the same secrets as **`push-reminders`**: **`CRON_SECRET`**, and set **`SUPABASE_SERVICE_ROLE_KEY`** (and **`SUPABASE_URL`** if not auto-injected) via `supabase secrets set` when required by your environment.
4. Schedule a daily **HTTP POST** to  
   `https://<project-ref>.supabase.co/functions/v1/nightly-backup-roll`  
   with header **`x-cron-secret: <same as CRON_SECRET>`**, at **00:10 UTC** (or your preferred time). Example with **pg_cron** + **`pg_net`** (adjust URL and secret; enable extensions in the dashboard if needed):

```sql
select cron.schedule(
  'nightly-backup-roll',
  '10 0 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/nightly-backup-roll',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "YOUR_CRON_SECRET"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

**Order per user (inside the function):** (1) if **T-1** exists in `user_state_history`, copy it to **T-2**; (2) rebuild **`reminder_schedule`** pending rows from **live** `user_state.payload` for the next **~7 days** (Web Push); (3) snapshot **live** `user_state.payload` into **T-1**. Step 3 is the current save slot becoming “yesterday’s backup,” not a copy into T-2.

## Web Push (Supabase Edge Function + cron)

**All** reminder delivery when the app is closed is **Web Push** through Supabase: the client writes pending rows to **`reminder_schedule`** (and the **nightly-backup-roll** job refreshes them from cloud state at **00:10 UTC**), and registers a **VAPID** subscription in **`push_subscriptions`**. A scheduled job calls the **`push-reminders`** Edge Function ( `web-push` ) to deliver notifications. The service worker **only** handles `push` and `fetch` (no Periodic Background Sync reminder snapshot).

**Due-row window (staleness):** each cron run only sends rows whose `fire_at_utc` is **in the past** but **not older than 7 days** (see `STALE_MS` in `push-reminders/index.ts`). That matches the schedule horizon so a long outage can still flush pending pushes; rows older than that are skipped. Your cron interval (e.g. every **3 minutes**) only controls *how often* the function runs, not that cap.

**Client “signed in” for scheduling:** the app keeps reminders and `push_subscriptions` only when **`_authSession`** is set (live Supabase session from storage + refresh), not only offline device-trust. While the app is used periodically, the client **refreshes the access token automatically**; users typically stay signed in for a long time until they sign out or the **refresh token** expires. Exact lifetimes are **project-specific** — check **Supabase Dashboard → Authentication → Settings** (JWT expiry, refresh behaviour). If the user has not opened the app for longer than your refresh allows, they need to sign in again before new rows are written.

Included in the schedule: **per-habit exact times** (adult/active profiles only; kid profiles get **Sunday** + **habits_day** nudges only — same as the client). Times use **`user.reminderTimeZone`** on the server nightly build and the browser’s local calendar when the client builds rows. **`CONSISTENCY_VAPID_PUBLIC_KEY`** must be set in `index.html` for client scheduling; users must be **signed in** with sync-capable session.

**Client schedule sync:** debounced **edit** syncs cap pending fires at the next **00:10** in `reminderTimeZone` or **7 days**, whichever is sooner; **full** **7-day** syncs run after service-worker registration, around **00:10:30 UTC** (when the page has run), on tab visibility, and after habit save (edit). **`CONSISTENCY_TEMP_PUSH_TEST_2350`** remains client-only when enabled in `index.html`.

**Billing:** delivery uses normal Edge Function invocations. On the free tier, projects include a large monthly Edge quota (see [Supabase pricing](https://supabase.com/pricing)); a cron every 1ÔÇô5 minutes stays far below typical free limits for a personal app.

1. Run the **`-- Web Push:`** section from [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor (if you have not already).
2. Generate VAPID keys (public + private), e.g. `npx --yes web-push generate-vapid-keys`.
3. In the project root (with [Supabase CLI](https://supabase.com/docs/guides/cli) linked): set secrets, for example:
   - `supabase secrets set VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_SUBJECT="mailto:you@yourdomain" CRON_SECRET="long-random-string"`
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are normally injected when the function runs; set them via `secrets set` if your setup requires it.
4. Deploy: `supabase functions deploy push-reminders --no-verify-jwt`  
   (JWT verification is off so **only** callers that know `CRON_SECRET` should invoke the URL; use HTTPS and a long random secret.)
5. Schedule HTTP **`POST`** to  
   `https://<project-ref>.supabase.co/functions/v1/push-reminders`  
   with header **`x-cron-secret: <same as CRON_SECRET>`** (Supabase Dashboard cron, `pg_net`, GitHub Actions, etc.). Every 1ÔÇô5 minutes is reasonable.
6. In [`index.html`](index.html), set **`CONSISTENCY_VAPID_PUBLIC_KEY`** to the **public** key string (must match `VAPID_PUBLIC_KEY` in secrets). Leave it empty to disable writing server schedule rows (no Web Push deliveries from cron).
7. Users must be **signed in**, grant **notification** permission, and have **browser reminders** enabled; then open the app so the client can upsert subscription and schedule rows after edits or after the nightly / visibility / UTC-timer paths refresh the slice.

**Add to Home Screen:** after setup, the app may prompt (once per browser session, per device) to install or pin the PWA—important especially on **iOS** (Safari: Share → Add to Home Screen) for Web Push behaviour. Users can dismiss for the session or **Don’t ask again** (saved on the **active profile** in local storage).

Any static-file server works. Two easy options:

```powershell
# Option 1: Python (pre-installed on most systems)
cd consistency-app
python -m http.server 8080

# Option 2: Node (if installed)
npx --yes serve -l 8080 .
```

Then open <http://localhost:8080>.

PWA install only works on `https://` or `localhost`. The service worker explicitly checks for this before registering.

## Deploy

Hosted on Cloudflare Pages. Every push to `main` auto-deploys.

- Production: `https://<project>.pages.dev` (closed beta)
- Preview branches: `https://<branch>.<project>.pages.dev`

## Development workflow

1. Edit `index.html`.
2. Test locally (see above) or in Cursor's preview.
3. Commit and push. Cloudflare Pages picks up the push and rebuilds.

```powershell
git add .
git commit -m "Short description of the change"
git push
```

## Conventions

- Single-file architecture is intentional for now (deploy simplicity, easy backups).
- Persistent state lives in `localStorage` under key `consistency-app-v4`.
- Per-profile data is namespaced inside `ROOT.profiles`.
- All UI strings have an adult voice and a kid voice (ages 0ÔÇô8) ÔÇö keep both in sync when editing.
- Onboarding follows "Approach D": short intro ÔåÆ milestone steppers triggered by user actions.

## Auth notes (Supabase)

- **Google account picker says ÔÇ£Log in toÔÇØ + a long random-looking string** ÔÇö That text is **not** controlled in `index.html`. Google takes it from the **OAuth consent screen** (and the OAuth client) backing your sign-in. To show a friendly name (e.g. **Consistency app**):
  1. In [Google Cloud Console](https://console.cloud.google.com/) use the **same Google Cloud project** where the **Web client ID** is registered that you entered in Supabase (see next bullet).
  2. Go to **APIs & Services ÔåÆ OAuth consent screen**.
  3. Set **App name** to `Consistency app` (or `Consistency`). Save.  
     Optional: add **App logo**, **support email**, and **developer contact** ÔÇö required if you move beyond ÔÇ£TestingÔÇØ or widen audience.
  4. In [Supabase](https://supabase.com/dashboard) open **Authentication ÔåÆ Providers ÔåÆ Google**: use your own **Client ID** and **Client Secret** from that Cloud project (see [Google sign-in with Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google)). If you only use SupabaseÔÇÖs pre-filled Google keys, branding is limited; **custom credentials** + consent screen above are what make the picker show your name.
- **Sign-in** uses [Supabase Auth](https://supabase.com/docs/guides/auth) with `flowType: 'implicit'` so **magic-link emails work when opened from another device or mail app** (PKCE requires the same browser session that requested the link).
- **Email ÔÇ£FromÔÇØ (e.g. ÔÇ£Supabase AuthÔÇØ)** ÔÇö On the default host, Supabase sends from their infrastructure. To show **ÔÇ£ConsistencyÔÇØ** or **ÔÇ£S-Sence LabsÔÇØ** as the sender, add **custom SMTP** in the Supabase dashboard (**Project ÔåÆ Settings ÔåÆ Auth ÔåÆ SMTP Settings**), then set your **sender name** and **from address** (use a domain you control, e.g. `noreply@yourdomain.com`, with SPF/DKIM as your provider requires). You can also edit **Authentication ÔåÆ Email Templates** for subject/body copy.
- **Redirect URLs** must include your production site and local dev (e.g. `https://your-project.pages.dev/**` and `http://localhost:*/**`).
- **Magic link email (centered layout)** ÔÇö In **Authentication ÔåÆ Email Templates**, open the **Magic Link** template and replace the body with HTML like below. Put **`{{ .ConfirmationURL }}`** only in the `href` of the button and in the fallback line (Supabase expands it to the full verify URL). The layout uses nested tables so it stays centered in Gmail and Outlook.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>Sign in</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0f2f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.08);">
          <tr>
            <td align="center" style="padding:28px 24px 8px;font-size:20px;font-weight:600;color:#111827;">
              Sign in to Consistency
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:12px 24px 24px;font-size:15px;line-height:1.5;color:#4b5563;">
              You asked for a one-tap link to your account. Use the button below.
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 24px 28px;">
              <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#ffffff !important;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
                Open Consistency
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 24px 28px;font-size:13px;line-height:1.55;color:#6b7280;">
              Button not working? Paste this link into your browser:<br>
              <span style="word-break:break-all;color:#2563eb;">{{ .ConfirmationURL }}</span>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 24px 32px;font-size:12px;line-height:1.5;color:#9ca3af;">
              If you didnÔÇÖt request this email, you can ignore it. This link will expire after a short time for your security.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

- **Magic link ÔÇ£rate limitÔÇØ** ÔÇö Supabase caps how many OTP/magic-link emails can be sent per hour (see [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)). Heavy testing triggers this quickly; wait ~1 hour, use Google sign-in, or raise limits / use **custom SMTP** on a paid tier.
- **Link opens the site but you stay logged out** ÔÇö The fragment `#access_token=ÔÇª` must stay on the URL until the Supabase client ingests it. Older builds stripped it too early (a race with `getSession()`). Current `index.html` retries session detection briefly and only then clears the address bar; redeploy if you still see this after clicking **Open Consistency**.

## Cloud sync (Phase D)

1. In the Supabase dashboard, open **SQL** ÔåÆ **New query**, paste `supabase/schema.sql`, and run it once. That creates `public.user_state` (`user_id`, `payload` jsonb, `updated_at`) with RLS so each user can only read/write their own row.
2. In the app, **Settings ÔåÆ Account**: turn **Sync this device with the cloud** on (default), edit data as usual ÔÇö uploads are debounced (~2s after each save). **Sync now** forces an immediate upsert.
3. **Conflict model (MVP):** last-write-wins using `ROOT._sync.editAt` (local, bumped on every normal save) versus `user_state.updated_at` from the server. After sign-in or session recovery, if the remote copy is newer the app replaces local `ROOT` with the migrated remote payload (then saves locally without bumping `editAt` for merge); if local is newer (or the cloud row is empty), the app pushes. Identical timestamps skip a redundant merge.

## License

All rights reserved. Personal beta ÔÇö please do not redistribute.
