# Consistency

A habit and goal tracker built around weekly consistency, gentle scoring, and weekly treats. Single-file PWA — installable on Android and iOS.

## Status

Closed beta. Currently local-only (no accounts, data lives in `localStorage`).
Cloud sync (auth + multi-device) is the next phase.

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

## License

All rights reserved. Personal beta — please do not redistribute.
