# Consistency

A habit and goal tracker built around weekly consistency, gentle scoring, and weekly treats. Single-file PWA — installable on Android and iOS.

## Status

Closed beta. **Auth:** Supabase (Google + email magic link). App data still lives in `localStorage` on each device until cloud sync (Phase D) ships.

## Repository layout

```
.
├── index.html              # Entire app (HTML + CSS + JS in one file)
├── manifest.webmanifest    # PWA manifest
├── sw.js                   # Minimal service worker (pass-through, enables installability)
├── _headers                # Cloudflare Pages cache rules
├── icons/                  # PWA icons (192, 512, apple-touch)
└── README.md
```

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
- All UI strings have an adult voice and a kid voice (ages 0–8) — keep both in sync when editing.
- Onboarding follows "Approach D": short intro → milestone steppers triggered by user actions.

## Auth notes (Supabase)

- **Sign-in** uses [Supabase Auth](https://supabase.com/docs/guides/auth) with `flowType: 'implicit'` so **magic-link emails work when opened from another device or mail app** (PKCE requires the same browser session that requested the link).
- **Email “From” (e.g. “Supabase Auth”)** — On the default host, Supabase sends from their infrastructure. To show **“Consistency”** or **“S-Sence Labs”** as the sender, add **custom SMTP** in the Supabase dashboard (**Project → Settings → Auth → SMTP Settings**), then set your **sender name** and **from address** (use a domain you control, e.g. `noreply@yourdomain.com`, with SPF/DKIM as your provider requires). You can also edit **Authentication → Email Templates** for subject/body copy.
- **Redirect URLs** must include your production site and local dev (e.g. `https://your-project.pages.dev/**` and `http://localhost:*/**`).
- **Magic link email (centered layout)** — In **Authentication → Email Templates**, open the **Magic Link** template and replace the body with HTML like below. Put **`{{ .ConfirmationURL }}`** only in the `href` of the button and in the fallback line (Supabase expands it to the full verify URL). The layout uses nested tables so it stays centered in Gmail and Outlook.

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
              If you didn’t request this email, you can ignore it. This link will expire after a short time for your security.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

- **Magic link “rate limit”** — Supabase caps how many OTP/magic-link emails can be sent per hour (see [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)). Heavy testing triggers this quickly; wait ~1 hour, use Google sign-in, or raise limits / use **custom SMTP** on a paid tier.
- **Link opens the site but you stay logged out** — The fragment `#access_token=…` must stay on the URL until the Supabase client ingests it. Older builds stripped it too early (a race with `getSession()`). Current `index.html` retries session detection briefly and only then clears the address bar; redeploy if you still see this after clicking **Open Consistency**.

## License

All rights reserved. Personal beta — please do not redistribute.
