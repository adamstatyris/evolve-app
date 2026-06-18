/**
 * Build Web Push reminder rows from persisted ROOT payload (active profile only).
 * Uses IANA zone from `user.reminderTimeZone` so server weeks match the device that last saved.
 */
import { DateTime } from 'npm:luxon@3.5.0'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

type Habit = Record<string, unknown> & {
  id: string
  goalId?: string
  active?: boolean
  archived?: boolean
  masteryLegendaryCoreLocked?: boolean
  remindersEnabled?: boolean
  reminderTimes?: string[]
  tier?: string
  metric?: string
  emoji?: string
  title?: string
  addedDate?: string
  listOrder?: number
}
type Goal = Record<string, unknown> & { id: string; status?: string }
type HabitDay = { days?: boolean[]; dayValues?: number[]; value?: number; locked?: boolean; tierAtLock?: string }
type WeekData = { habitData?: Record<string, HabitDay> }
type User = Record<string, unknown> & {
  dob?: string
  startDate?: string
  browserNotifyEnabled?: boolean
  trackingPaused?: boolean
  trackingStopped?: boolean
  reminderTimeZone?: string
  /** Kid UI: when false, skip per-habit clock-time rows (weekly nudges still allowed). Default/on when unset. */
  kidHabitSpecificRemindersEnabled?: boolean
}
type Profile = { user?: User; habits?: Habit[]; goals?: Goal[]; weeks?: Record<string, WeekData> }
type Root = {
  storageVersion?: number
  activeProfileId?: string
  profiles?: Record<string, Profile>
  profileMeta?: Record<string, { isChildProfile?: boolean }>
}

const TITLE = 'Consistency'
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function userAgeYearsFromDob(dob: string | undefined): number | null {
  if (!dob || String(dob).length < 10) return null
  const birth = new Date(String(dob).slice(0, 10) + 'T12:00:00')
  if (Number.isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const md = today.getMonth() - birth.getMonth()
  if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function profileIsChild(meta: Record<string, unknown> | undefined, P: Profile): boolean {
  if (meta && meta.isChildProfile === true) return true
  if (meta && meta.isChildProfile === false) return false
  const age = userAgeYearsFromDob(P.user?.dob)
  return age !== null && age >= 0 && age <= 8
}

function isoDateZ(dt: DateTime): string {
  return dt.toISODate() ?? ''
}

function weekDatesZ(nowMs: number, tz: string, offWeeks: number): DateTime[] {
  const todayStr = DateTime.fromMillis(nowMs, { zone: tz }).toISODate()!
  let monday = DateTime.fromISO(`${todayStr}T12:00:00`, { zone: tz }).startOf('day')
  const wd = monday.weekday // 1=Mon .. 7=Sun
  monday = monday.minus({ days: wd - 1 })
  monday = monday.plus({ weeks: offWeeks })
  return Array.from({ length: 7 }, (_, i) => monday.plus({ days: i }).startOf('day'))
}

function weekKeyZ(nowMs: number, tz: string, off: number): string {
  const monday = weekDatesZ(nowMs, tz, off)[0]
  const wy = monday.weekYear
  const wn = monday.weekNumber
  return `${wy}-W${String(wn).padStart(2, '0')}`
}

function offsetForWeekKeyZ(nowMs: number, tz: string, wk: string): number | null {
  for (let o = 0; o >= -400; o--) {
    if (weekKeyZ(nowMs, tz, o) === wk) return o
  }
  return null
}

function isoWeekEditLockMsZ(nowMs: number, tz: string, off: number): number {
  const ds = weekDatesZ(nowMs, tz, off)
  const sun = ds[6]
  const mon = sun.plus({ days: 1 }).startOf('day')
  return mon.toMillis()
}

function trackingStartMillisZ(S: Profile, tz: string): number {
  const start = String(S.user?.startDate || isoDateZ(DateTime.fromMillis(Date.now(), { zone: tz })))
  return DateTime.fromISO(`${start.slice(0, 10)}T00:00:00`, { zone: tz }).toMillis()
}

function trackingLogLocked(S: Profile): boolean {
  return !!(S.user?.trackingPaused || S.user?.trackingStopped)
}

function isIsoWeekEndedForOffsetZ(nowMs: number, tz: string, off: number): boolean {
  return nowMs >= isoWeekEditLockMsZ(nowMs, tz, off)
}

function canEditTrackerDayZ(S: Profile, nowMs: number, tz: string, off: number, dayIndex: number): boolean {
  if (trackingLogLocked(S)) return false
  if (isIsoWeekEndedForOffsetZ(nowMs, tz, off)) return false
  const dates = weekDatesZ(nowMs, tz, off)
  const dt = dates[dayIndex]
  const ts = trackingStartMillisZ(S, tz)
  if (dt.toMillis() < ts) return false
  const todayStart = DateTime.fromMillis(nowMs, { zone: tz }).startOf('day')
  if (off === 0 && dt > todayStart) return false
  return true
}

function canEditHabitDayZ(S: Profile, nowMs: number, tz: string, h: Habit, off: number, dayIndex: number): boolean {
  if (!h || !canEditTrackerDayZ(S, nowMs, tz, off, dayIndex)) return false
  const ad = String(h.addedDate || '').slice(0, 10)
  if (!ad) return true
  const dt = weekDatesZ(nowMs, tz, off)[dayIndex].startOf('day')
  return isoDateZ(dt) >= ad
}

function canScheduleHabitReminderOnDayZ(
  S: Profile,
  nowMs: number,
  tz: string,
  h: Habit,
  off: number,
  dayIndex: number,
): boolean {
  if (!h?.active || h.archived) return false
  if (trackingLogLocked(S)) return false
  if (isIsoWeekEndedForOffsetZ(nowMs, tz, off)) return false
  const dt = weekDatesZ(nowMs, tz, off)[dayIndex].startOf('day')
  if (dt.toMillis() < trackingStartMillisZ(S, tz)) return false
  const todayStart = DateTime.fromMillis(nowMs, { zone: tz }).startOf('day')
  if (dt < todayStart) return false
  const ad = String(h.addedDate || '').slice(0, 10)
  if (ad && isoDateZ(dt) < ad) return false
  return true
}

function habitAddedDateStr(h: Habit): string {
  return String(h.addedDate || '').slice(0, 10)
}

function goalById(S: Profile, id: string): Goal | undefined {
  return S.goals?.find((g) => g.id === id)
}

function goalIsActive(g: Goal | undefined): boolean {
  return !!g && (g.status || 'active') === 'active'
}

function habitListSort(a: Habit, b: Habit): number {
  return (a.listOrder ?? 0) - (b.listOrder ?? 0) || String(a.id).localeCompare(String(b.id))
}

function trackerHabitsOrderedZ(S: Profile): Habit[] {
  return (S.habits || [])
    .filter((h) => {
      if (!h.active || h.archived) return false
      if (h.masteryLegendaryCoreLocked) return true
      return goalIsActive(goalById(S, String(h.goalId || '')))
    })
    .sort(habitListSort)
}

function getWD(S: Profile, wk: string): WeekData {
  if (!S.weeks) S.weeks = {}
  if (!S.weeks[wk]) S.weeks[wk] = { habitData: {} }
  const w = S.weeks[wk]
  if (!w.habitData) w.habitData = {}
  return w
}

function ensureHD(S: Profile, wk: string, id: string): HabitDay {
  const wd = getWD(S, wk)
  if (!wd.habitData![id]) {
    wd.habitData![id] = { days: Array(7).fill(false), value: 0, dayValues: Array(7).fill(0) }
  }
  const hd = wd.habitData![id]
  if (!hd.dayValues) hd.dayValues = Array(7).fill(0)
  return hd
}

function habitEffectiveTierZ(S: Profile, nowMs: number, tz: string, h: Habit, wk: string): string {
  if (!h || !wk) return 'core'
  const wd = S.weeks?.[wk]
  const hd = wd?.habitData?.[h.id]
  const off = offsetForWeekKeyZ(nowMs, tz, wk)
  const weekEnded = off !== null && isIsoWeekEndedForOffsetZ(nowMs, tz, off)
  if (hd && (hd.locked === true || weekEnded)) {
    if (hd.tierAtLock === 'growth' || hd.tierAtLock === 'core') return hd.tierAtLock
  }
  return h.tier === 'growth' ? 'growth' : 'core'
}

function habitHasLogForDayIndexZ(S: Profile, h: Habit, wk: string, di: number): boolean {
  const hd = ensureHD(S, wk, h.id)
  if (h.metric === 'days') return !!(hd.days && hd.days[di])
  const v = Number((hd.dayValues && hd.dayValues[di]) || 0) || 0
  if (v > 0) return true
  return !!(hd.days && hd.days[di])
}

function todayIsoWeekDayIndexZ(nowMs: number, tz: string): number {
  const ds = weekDatesZ(nowMs, tz, 0)
  const todayStr = DateTime.fromMillis(nowMs, { zone: tz }).toISODate()!
  for (let i = 0; i < 7; i++) {
    if (isoDateZ(ds[i]) === todayStr) return i
  }
  return -1
}

function notificationBodySimple(h: Habit): string {
  const t = (String(h.emoji || '🎯').trim() || '🎯') + ' ' + String(h.title || 'Habit').trim()
  return t.length > 60 ? t.slice(0, 57) + '…' : t
}

function jsDayOfWeek(nowMs: number, tz: string): number {
  const w = DateTime.fromMillis(nowMs, { zone: tz }).weekday
  return w === 7 ? 0 : w
}

export type ReminderRow = {
  slot_key: string
  fire_at_utc: string
  title: string
  body: string
  tag: string
}

export function buildReminderScheduleRowsFromRoot(
  root: Root,
  nowMs: number,
  maxFireMs: number,
): ReminderRow[] {
  const rows: ReminderRow[] = []
  if (!root || root.storageVersion !== 5 || !root.profiles || typeof root.profiles !== 'object') return rows
  const pid = root.activeProfileId
  if (!pid || !root.profiles[pid]) return rows
  const S = root.profiles[pid]
  const meta = root.profileMeta?.[pid]
  const kid = profileIsChild(meta as Record<string, unknown> | undefined, S)
  const notify = !!S.user?.browserNotifyEnabled
  const paused = !!S.user?.trackingPaused
  const stopped = !!S.user?.trackingStopped
  if (!notify || paused || stopped) return rows

  const tz = String(S.user?.reminderTimeZone || 'UTC').trim() || 'UTC'
  const todayYmd = DateTime.fromMillis(nowMs, { zone: tz }).toISODate()!

  function addRow(ymd: string, hm: string, tag: string, body: string) {
    const fire = DateTime.fromISO(`${ymd}T${hm}:00`, { zone: tz })
    const t = fire.toMillis()
    if (!(t > nowMs && t <= maxFireMs)) return
    const hmFlat = hm.replace(':', '')
    rows.push({
      slot_key: `${tag}:${ymd}:${hmFlat}`,
      fire_at_utc: fire.toUTC().toISO()!,
      title: TITLE,
      body: body || '',
      tag,
    })
  }

  // Per-habit clock times: today only (see client buildExactReminderScheduleRowsForSupabase).
  const kidAllowsHabitClockReminders = !kid || S.user?.kidHabitSpecificRemindersEnabled !== false
  if (kidAllowsHabitClockReminders) {
    const di = todayIsoWeekDayIndexZ(nowMs, tz)
    if (di >= 0) {
      for (const h of trackerHabitsOrderedZ(S)) {
        if (!h.remindersEnabled || !Array.isArray(h.reminderTimes) || !h.reminderTimes.length) continue
        if (!canScheduleHabitReminderOnDayZ(S, nowMs, tz, h, 0, di)) continue
        for (const hm of h.reminderTimes) {
          const fire = DateTime.fromISO(`${todayYmd}T${hm}:00`, { zone: tz })
          const t = fire.toMillis()
          if (t <= nowMs || t > maxFireMs) continue
          rows.push({
            slot_key: `hrd:${h.id}:${hm}:${todayYmd}`,
            fire_at_utc: fire.toUTC().toISO()!,
            title: TITLE,
            body: notificationBodySimple(h),
            tag: `hrd:${h.id}:${hm}`,
          })
        }
      }
    }
  }

  const wk = weekKeyZ(nowMs, tz, 0)
  const di = todayIsoWeekDayIndexZ(nowMs, tz)
  if (di >= 0) {
    const habits = trackerHabitsOrderedZ(S).filter((h) => canEditHabitDayZ(S, nowMs, tz, h, 0, di))
    const cores = habits.filter((h) => habitEffectiveTierZ(S, nowMs, tz, h, wk) === 'core')
    const growth = habits.filter((h) => habitEffectiveTierZ(S, nowMs, tz, h, wk) === 'growth')
    const coreUn = cores.some((h) => !habitHasLogForDayIndexZ(S, h, wk, di))
    const growthUn = growth.some((h) => !habitHasLogForDayIndexZ(S, h, wk, di))
    let c = DateTime.fromMillis(nowMs, { zone: tz }).startOf('day')
    const endCap = DateTime.fromMillis(maxFireMs, { zone: tz })
    while (c <= endCap) {
      if (c.weekday === 7) {
        const ymd = c.toISODate()!
        addRow(ymd, '10:00', 'sun_m', "It's Sunday — your week locks at midnight. Make sure everything's logged.")
        addRow(ymd, '13:00', 'sun_mid', 'Midday Sunday — week locks at midnight. Anything still open?')
        addRow(ymd, '15:00', 'sun_a', 'A few hours left before your week locks. Any missing entries?')
        addRow(ymd, '18:00', 'sun_ev', 'Early evening — your week locks at midnight. Time to check the log.')
        addRow(ymd, '20:00', 'sun_e', 'Last chance — your week locks in a few hours.')
      }
      c = c.plus({ days: 1 })
    }
    if (coreUn || growthUn) {
      addRow(todayYmd, '14:00', 'habits_day', 'Some habits are not logged yet today — open Consistency when you can.')
    }
  }

  return rows
}

export async function replaceReminderScheduleForUser(
  supa: SupabaseClient,
  userId: string,
  rootPayload: unknown,
  nowMs: number,
): Promise<{ ok: boolean; inserted: number; error?: string; skipped?: boolean }> {
  const root = rootPayload as Root
  if (!root || typeof root !== 'object' || root.storageVersion !== 5 || !root.profiles || !root.activeProfileId) {
    return { ok: true, inserted: 0, skipped: true }
  }
  const maxFire = nowMs + WINDOW_MS
  const rows = buildReminderScheduleRowsFromRoot(root, nowMs, maxFire)

  const pid = root.activeProfileId
  const u = pid ? root.profiles?.[pid]?.user : undefined
  const notify = !!u?.browserNotifyEnabled
  const paused = !!u?.trackingPaused
  const stopped = !!u?.trackingStopped

  try {
    if (!notify || paused || stopped) {
      const del = await supa.from('reminder_schedule').delete().eq('user_id', userId)
      if (del.error) return { ok: false, inserted: 0, error: del.error.message }
      return { ok: true, inserted: 0 }
    }

    const delPend = await supa.from('reminder_schedule').delete().eq('user_id', userId).is('sent_at', null)
    if (delPend.error) return { ok: false, inserted: 0, error: delPend.error.message }

    if (!rows.length) return { ok: true, inserted: 0 }

    const withUser = rows.map((r) => ({ ...r, user_id: userId }))
    const ins = await supa.from('reminder_schedule').insert(withUser)
    if (ins.error) return { ok: false, inserted: 0, error: ins.error.message }
    return { ok: true, inserted: rows.length }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, inserted: 0, error: msg }
  }
}
