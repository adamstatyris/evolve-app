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
