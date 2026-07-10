# Evolve performance optimization report

**Date:** 2026-07-09  
**Scope:** `index.html` — render hot path after lineage/difficulty features

## Symptoms

App felt sluggish after recent updates: tab switches, logging days, and dashboard refreshes triggered heavy work on every `renderAll()`.

## Root causes (diagnostics)

| Issue | Impact |
|-------|--------|
| `habitsInLineage()` filtered the full habit array on every call | O(n²) during manage/tracker lineage dedupe |
| `processScheduledHabitLineageSwitches()` ran every `renderAll()` with nested `.find()` | Unneeded scans + save/reminder sync |
| `syncGoalRecoveryAndPotNotices()` always called `invalidateGoalPotTotalCache()` | Busted tracker/manage render fingerprints even when recovery state unchanged |
| `syncAllGoalRecovery()` used `computeRecoveryTimeline()` directly | Missed per-render-pass timeline cache |
| `syncHabitMasteryAwards()` on every dashboard deferred pass | 27/54/81-day rolling windows per habit |
| Fail-recovery / level-up / growth-trial schedulers on every `renderAll()` | Full habit scans + timer churn |
| `trackerRenderFingerprint()` included full `goalPotTotalCacheFingerprint()` | Expensive skip-check invalidated too often |
| Float `tryShow*` paths called `save()` when only showing UI | Extra debounced writes |

## Changes applied

1. **Lineage index** — `buildLineageIndex()` + `getLineageIndex()` cached per render pass; rebuilt at `renderAll()` start.
2. **Scheduled lineage switches** — early exit when no pending activations; O(n) deactivate map instead of nested find.
3. **Recovery sync** — removed unconditional pot-cache invalidation; use `getRecoveryTimeline()` in `syncAllGoalRecovery()`.
4. **Mastery sync throttle** — `markMasterySyncDirty()` on log changes; daily calendar bump; skip redundant dashboard passes.
5. **Tracker fingerprint** — `recoveryStateFingerprint()` replaces full pot cache fingerprint for skip checks.
6. **`trackerHabitsOrdered()` cache** — memoized within render pass.
7. **Manage habits fingerprint** — variant count from lineage index (one build per paint).
8. **Float prompts debounced** — `scheduleDeferredFloatPrompts()` (400ms) instead of three schedulers per `renderAll()`.
9. **Removed spurious `save()`** from float show helpers (data unchanged).

## Expected effect

- Faster tab switches and log toggles when recovery/pot state is stable.
- Manage tab with multiple lineage variants: fewer full-array scans.
- Dashboard paints without re-running mastery unless logs changed or calendar day rolled.

## Follow-ups (not in this pass)

- Dashboard goal-card render fingerprint (partial DOM updates).
- Run mastery sync on ISO week close event instead of daily dirty flag only.
- Profile with Chrome Performance tab if further regression appears.

---

## Round 2 (2026-07-10) — Home + numeric log slowness

### Symptoms
- Home tab still slow on load with ~15 habits / 2 goals.
- Log tab slow on first open after app load.
- km / sessions day-modal saves and weekly metric inputs triggered full re-renders.

### Root causes
| Issue | Impact |
|-------|--------|
| `effectivePotResetCutoffForGoal` bypassed timeline cache | Recomputed full recovery timeline on every pot cutoff read |
| No DOM patch for km/sessions/instances (only boolean days) | Every numeric save rebuilt all 15 habit cards + dashboard |
| `renderAfterLogChange` always ran full `renderDashboard()` | Heavy goal stats even when user was on Log tab |
| Auto-lock + recovery sync on every tracker paint | Scanned all weeks even when nothing changed |
| Week summary blocked first tracker paint | User waited for summary + 15 cards in one frame |

### Changes
1. **`getRecoveryTimeline()` in pot cutoff path** — cache hits during renders.
2. **`patchLogHabitCardUI()`** — in-place updates for days, km, sessions, instances, and weekly metric inputs (mirrors existing day-toggle patch).
3. **Lightweight `patchDashboardAfterLogChange()`** — updates “Your week” KPIs only; skips goal-card rebuild when fingerprint unchanged.
4. **`maybeApplyHabitAutoLocks()` / `maybeSyncGoalRecoveryAndPotNotices()`** — skip when profile/week state unchanged.
5. **Deferred week summary** — habit rows paint first; summary + log-reveal on next frame.

---

## Round 3 (2026-07-10) — Batched log side effects

### Problem
Each tap still triggered week summary, dashboard KPIs, and insight/mastery work — noticeable when logging several days quickly.

### Approach
**Instant path:** day button / card patch, sounds, debounced save (300ms).

**Batched path (900ms after last log action):** week summary, Home “Your week” section, history table (if open), mastery/insights deferred effects. Week-complete confetti runs once in the batch flush, not per tap.

**Metric typing:** weekly number inputs debounce 450ms before patch + batch scheduling.

**Safety flush:** tab switch, profile switch, and app backgrounding flush pending batch immediately so nothing is stale when leaving Log.
