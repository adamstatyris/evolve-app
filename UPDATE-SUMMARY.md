# Consistency — combined release summary (Web Push + v2.2.1)

This note merges **yesterday’s Web Push–only reminder work** with **today’s v2.2.1 product release** (grace removal, Goals tab, scoring/UX).

---

## Part A — Web Push–only reminders (prior drop)

### Notifications: Web Push only
- **Removed** the best-effort path: **Periodic Background Sync**, service-worker **reminder snapshot** cache, and **in-tab** `showNotification` flows for habit / Sunday nudges and per-minute exact-time pings.
- **All** of those reminders are now modeled as **rows in `reminder_schedule`** and sent by the existing Supabase **`push-reminders`** Edge Function when cron calls it with `x-cron-secret`.
- The **service worker** (`sw.js`) is **fetch + push + notification click** only. Cache name is bumped with each deploy that should refresh clients (**`consistency-sw-v8`** as of v2.2.1).

### What gets scheduled on the server (when VAPID is set and user is signed in)
- **Exact habit times** (same rules as before; still **skipped in kid mode** on the client schedule).
- **Sunday week-close** messages at **fixed local times** (spread bands, e.g. 10:00–20:00).
- **`habits_day`** at **14:00 local**: one generic nudge when **any core or growth** habit for today is still unlogged (replaces the old **growth-only** “pot” copy).
- Optional dev row **`_tempPush2350`** if `CONSISTENCY_TEMP_PUSH_TEST_2350` remains enabled.

### Product / copy
- The former **`growth_day`** push was **app-coded** to growth tier only; it is now **`habits_day`** with neutral copy so it matches **core or growth** (and reads as “habits” generally).

### Ops / README
- README **Web Push** section: no more “local SW reminders” fallback; documents that **VAPID public in `index.html`** is required for cron-side delivery.

### Cloud backup (prior fix, still in tree)
- `user_state_history` **`saved_at`** on archive uses the **same wall-clock instant as the upload** (aligned with `user_state.updated_at`), and prune keeps **today + yesterday + two days ago** so “Revert to yesterday” matches calendar expectations.

---

## Part B — v2.2.1 (grace removal, Goals tab, pots & scoring)

### Grace mode removed from the product surface
- **Settings** and **Help** no longer expose a grace-period toggle or dashboard chips; mid-week behavior is handled by **proportional targets**, **recovery**, and closed-week rules.
- **Server push** no longer schedules **grace-specific Sunday** rows (only the shared **Sunday week-close** bands and other rows above).

### Goals tab
- New **Goals** tab: **pots vs savings targets**, **retether** (move a habit to another goal) with UI flow and safeguards (**28-day cooldown** when changing goal on a habit).

### Pots, caps, and celebrations
- **Pot cap / contribution** logic uses **week-end simulation** consistent with how treats are computed; **week summary** uses **goal-attached habits for that week** (`habitsForGoalInWeek` / related helpers), not a stale raw list.
- **Pot target “party” / celebration**: respects **snooze**, ties to **`goalId`**, and only marks **shown** after explicit confirm; actions for **snooze**, **OK**, and opening **Goals** after a check.

### Migrate / data hygiene
- Migrate strips legacy **grace** fields where appropriate; goals gain **`potTargetCelebrationShown`** / **`potTargetCelebrationSnoozeUntil`** as needed; **goal id at lock** and related backfill for locked weeks.

### Copy, tours, What’s New
- Guided tour **Main views** and **Settings** steps mention **Goals** and no longer mention Grace.
- In-app **What’s New** / version strings: **v2.2.1** (`manifest.webmanifest` **name**, `<title>`, About, `WHATS_NEW_*`).

---

**Deploy:** push `main`; ensure Supabase cron + secrets + `CONSISTENCY_VAPID_PUBLIC_KEY` are configured so users receive pushes. After deploy, clients pick up **v2.2.1** and the new **service worker** cache revision.
