# Part 1 — What's left (user action checklist)

Shipped in commit `27b9da0` on `main`. Use this list after you review the deploy.

---

## 1. Review the deploy (you)

- [ ] Hard-refresh the live app (or local) after Cloudflare Pages finishes building.
- [ ] Smoke-test **adult** and **kid** mode: dashboard, Log, Add goal, Add habit, recovery status bullets.
- [ ] Open insights **ME1, ME6, ME7, ME10, NH9, I22, I4** — confirm your wording.
- [ ] Create a **new money goal** with weekly savings + treat budget — confirm treat band bias.
- [ ] Create a **new points goal** — confirm locked habit point values.
- [ ] Toggle **Settings → Account → Basic** — confirm Masteries blocked and Paths hidden.
- [ ] Switch **currency** in Settings — confirm pot labels update.
- [ ] Note anything to adjust and come back with a list.

---

## 2. Push notifications — Supabase (you, dashboard)

Code is in place; delivery needs ops setup. Follow `docs/PHASE_B_NOTIFICATIONS.md` in order:

- [ ] **Cron:** Schedule `push-reminders` every 5–15 min with header `x-cron-secret: <CRON_SECRET>` (pg_cron + pg_net or Supabase scheduled function).
- [ ] **Secrets:** Confirm non-empty: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] **VAPID match:** Compare `CONSISTENCY_VAPID_PUBLIC_KEY` in `index.html` with `VAPID_PUBLIC_KEY` secret — must match byte-for-byte.
- [ ] **Re-subscribe:** After any VAPID change, disable and re-enable Browser reminders on your test device.
- [ ] **Data check:** `push_subscriptions` has your user; `reminder_schedule` has a due row (`sent_at` null, `fire_at_utc` in the past).
- [ ] **Manual POST:** Call the function with `x-cron-secret` — expect `{scanned, sent}` with `scanned > 0` when due.
- [ ] **Device test:** Installed PWA on a real phone — notification fires at due time.

---

## 3. Insights curation — optional pass (you)

First batch is applied. ~100 other rows still have default “keep as-is” proposals.

- [ ] Open `docs/ui-copy/insights-review.tsv` (or edit `docs/ui-copy/insights-proposed.json`).
- [ ] Fill `proposed_*` for any rows you want changed.
- [ ] Hand back to agent: `node tools/apply-insights-proposed.mjs` → deploy.

---

## 4. External / manual branding (you, outside repo)

- [ ] OAuth consent screen app name → **Evolve**
- [ ] SMTP / magic-link sender → **S-Sence Labs** / Evolve
- [ ] Trademark check on logo lockup + “S-Sence Labs” (if not done)

---

## 5. Deferred in code — agent on your go-ahead

| Item | Notes |
|------|--------|
| Animated top-row logomark | Palette → goal status colour after ~3s, rotate every 20s |
| Tips guide recovery block | Shorten to match dashboard bullet list (`docs/PHASE_G_AUDIT_REPORT.md`) |
| Remaining static `£` | ~22 in guides/tours — gradual `fmtMoney` pass |
| Money goal timeframe + realistic date | Phase D stretch — not built yet |
| Kid copy for empty mastery insights | MX1–MX7, BK_SM* kid variants missing |
| Server-side entitlements + Stripe | Phase F billing — client toggle only today |
| Real Path content + onboarding | Placeholder only; separate plan later |
| Phase G audit fixes | Report only until you approve each item |

---

## 6. Part 2 — explicitly out of scope

Evolve Together (couples skin, Pairpaths, partner logging) — revisit only after Part 1 review is signed off.
