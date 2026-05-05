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
- **Magic link “rate limit”** — Supabase caps how many OTP/magic-link emails can be sent per hour (see [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)). Heavy testing triggers this quickly; wait ~1 hour, use Google sign-in, or raise limits / use **custom SMTP** on a paid tier.

## License

All rights reserved. Personal beta — please do not redistribute.
