# Consistency

A habit and goal tracker built around weekly consistency, gentle scoring, and weekly treats. Single-file PWA ÔÇö installable on Android and iOS.

## Status

Closed beta (**v2.2beta**). **Auth:** Supabase (Google + email magic link). **Cloud sync:** signed-in users sync the full multi-profile `ROOT` to Supabase (`user_state`) from **Settings ÔåÆ Account**. **Automatic cloud archives:** these are **not** manual uploads. After you run the SQL in [`supabase/schema.sql`](supabase/schema.sql) (see [Supabase setup](#supabase-setup-cloud-sync--backups)), each successful sync can archive the **previous** cloud payload on the server; the app keeps **at most 2 archived states per account from the last 2 days** (rolling 48 hours). **Settings ÔåÆ Account ÔåÆ Automatic cloud archives** lists them as **Backup 1** / **Backup 2** (newest first) for **manual restore** if live data looks wrongÔÇöthe app creates and uploads the archives when you sync.

## Repository layout

```
.
Ôö£ÔöÇÔöÇ index.html              # Entire app (HTML + CSS + JS in one file)
Ôö£ÔöÇÔöÇ manifest.webmanifest    # PWA manifest
Ôö£ÔöÇÔöÇ sw.js                   # Minimal service worker (pass-through, enables installability)
Ôö£ÔöÇÔöÇ _headers                # Cloudflare Pages cache rules
Ôö£ÔöÇÔöÇ supabase/
Ôöé   ÔööÔöÇÔöÇ schema.sql          # `user_state` + `user_state_history` + RLS (run / re-run in Supabase SQL Editor)
Ôö£ÔöÇÔöÇ icons/                  # PWA icons (192, 512, apple-touch)
ÔööÔöÇÔöÇ README.md
```

## Supabase setup (cloud sync + backups)

Do this in the [Supabase Dashboard](https://supabase.com/dashboard) for **the same project** your app uses (Project URL + anon key in the frontend).

1. Open your project ÔåÆ **SQL Editor** (left sidebar) ÔåÆ **New query**.
2. Open [`supabase/schema.sql`](supabase/schema.sql) in this repo and **copy the entire file** into the editor.  
   - **New project:** run the full script once.  
   - **Already migrated `user_state`:** if the editor reports errors such as *policy already exists* for `user_state_*`, do **not** re-run those lines ÔÇö copy only the block in `schema.sql` from `-- Previous cloud payloads` through the last `user_state_history` policy and run **that** once to add cloud backup history.
3. Click **Run** (or **Ctrl+Enter**). You should see success; no rows returned is normal.
4. Quick check: **Table Editor** ÔåÆ confirm tables **`user_state`** and **`user_state_history`** exist and RLS is enabled (shield icon).
5. Deploy or refresh the app; sign in and use **Sync now** once. After the **second** upload (when a previous cloud version exists), **Automatic cloud archives** on the Account tab should list **Backup 1** / **Backup 2** rows.

Snapshots are optional for sync itself: if `user_state_history` is missing, uploads still work; the app just cannot list or restore older cloud copies.

## Local preview

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
