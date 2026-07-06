import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@localhost'
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('URL') ?? ''
const SERVICE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''

/** Skip rows older than this (missed while cron was down). Matches the ~7-day schedule horizon
 *  so delayed sends still deliver after outages; rows older than this are skipped. */
const STALE_MS = 7 * 24 * 60 * 60 * 1000

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

type Habit = { id?: string; emoji?: string }
type Profile = { habits?: Habit[] }
type Root = {
  storageVersion?: number
  activeProfileId?: string
  profiles?: Record<string, Profile>
}

function err(status: number, message: string) {
  console.error(`[push-reminders] ${status}: ${message}`)
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function parseHabitReminderTag(tag: string): { habitId: string; emoji: string } | null {
  if (!tag.startsWith('hrd:')) return null
  const rest = tag.slice(4)
  if (rest.includes('|')) {
    const parts = rest.split('|')
    if (parts.length >= 3) {
      return { habitId: parts[0], emoji: parts.slice(2).join('|').trim() }
    }
  }
  const legacy = rest.match(/^([^:]+):(\d{2}:\d{2})$/)
  if (legacy) return { habitId: legacy[1], emoji: '' }
  return null
}

function emojiFromHabitReminderTag(tag: string): string {
  const parsed = parseHabitReminderTag(tag)
  return parsed?.emoji ?? ''
}

function emojiForHabitReminder(root: Root | null, tag: string): string {
  const fromTag = emojiFromHabitReminderTag(tag)
  if (fromTag) return fromTag
  const parsed = parseHabitReminderTag(tag)
  if (!parsed?.habitId || !root?.profiles) return ''
  for (const profile of Object.values(root.profiles)) {
    const h = profile?.habits?.find((x) => x && x.id === parsed.habitId)
    if (h?.emoji) return String(h.emoji).trim()
  }
  return ''
}

function emojiFromGeneralReminderTag(tag: string): string {
  const t = String(tag || '').trim()
  if (t === 'habits_day') return '✅'
  if (t === 'habits_morning') return '☀️'
  if (t.startsWith('sun_')) return '🗓️'
  if (t === '_tempPushTest') return '🔔'
  if (t.startsWith('hfr_nudge:')) return '💬'
  return ''
}

function emojiForFailRecoveryNudge(root: Root | null, tag: string): string {
  const t = String(tag || '')
  if (!t.startsWith('hfr_nudge:')) return ''
  const hid = t.slice(10).split('|')[0]
  if (!hid || !root?.profiles) return '💬'
  for (const profile of Object.values(root.profiles)) {
    const h = profile?.habits?.find((x) => x && x.id === hid)
    if (h?.emoji) return String(h.emoji).trim()
  }
  return '💬'
}

function emojiForPushReminder(root: Root | null, tag: string): string {
  const t = String(tag || '')
  if (t.startsWith('hrd:')) {
    const fromTag = emojiFromHabitReminderTag(t)
    if (fromTag) return fromTag
    return emojiForHabitReminder(root, t)
  }
  if (t.startsWith('hfr_nudge:')) return emojiForFailRecoveryNudge(root, t)
  return emojiFromGeneralReminderTag(t)
}

async function loadUserRoot(
  supa: ReturnType<typeof createClient>,
  userId: string,
): Promise<Root | null> {
  const { data, error } = await supa
    .from('user_state')
    .select('payload')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data?.payload) return null
  const root = data.payload as Root
  if (!root || root.storageVersion !== 5 || !root.profiles) return null
  return root
}

type DueRow = {
  id: string
  user_id: string
  slot_key: string
  title: string
  body: string
  tag: string
  fire_at_utc: string
}

async function processDueReminders(
  supa: ReturnType<typeof createClient>,
  userIdFilter: string | null,
): Promise<{ scanned: number; sent: number; mode: 'cron' | 'user' }> {
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const staleIso = new Date(now - STALE_MS).toISOString()

  let q = supa
    .from('reminder_schedule')
    .select('id,user_id,slot_key,title,body,tag,fire_at_utc')
    .is('sent_at', null)
    .lte('fire_at_utc', nowIso)
    .gte('fire_at_utc', staleIso)
    .order('fire_at_utc', { ascending: true })
    .limit(userIdFilter ? 80 : 300)

  if (userIdFilter) q = q.eq('user_id', userIdFilter)

  const { data: due, error: qErr } = await q
  if (qErr) throw new Error(qErr.message)

  let sent = 0
  const rows = (due ?? []) as DueRow[]
  const rootCache = new Map<string, Root | null>()

  for (const row of rows) {
    const { data: subs, error: sErr } = await supa
      .from('push_subscriptions')
      .select('id,endpoint,p256dh,auth')
      .eq('user_id', row.user_id)

    if (sErr) continue

    const list = subs ?? []
    if (!list.length) continue

    let iconEmoji = ''
    if (row.tag) {
      const tagStr = String(row.tag)
      const needsRoot =
        (tagStr.startsWith('hrd:') && !emojiFromHabitReminderTag(tagStr)) ||
        tagStr.startsWith('hfr_nudge:')
      if (needsRoot && !rootCache.has(row.user_id)) {
        rootCache.set(row.user_id, await loadUserRoot(supa, row.user_id))
      }
      iconEmoji = emojiForPushReminder(
        rootCache.get(row.user_id) ?? null,
        tagStr,
      )
    }

    const payload = JSON.stringify({
      title: row.title,
      body: row.body,
      tag: row.tag,
      iconEmoji,
    })

    let delivered = false
    for (const s of list) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 300 },
        )
        delivered = true
      } catch (e: unknown) {
        const status =
          e && typeof e === 'object' && 'statusCode' in e
            ? (e as { statusCode: number }).statusCode
            : 0
        if (status === 410 || status === 404) {
          await supa.from('push_subscriptions').delete().eq('id', s.id)
        }
      }
    }

    if (delivered) {
      await supa
        .from('reminder_schedule')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', row.id)
      sent++
    }
  }

  return { scanned: rows.length, sent, mode: userIdFilter ? 'user' : 'cron' }
}

Deno.serve(async (req) => {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) return err(500, 'Missing SUPABASE_URL or SERVICE_ROLE')
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return err(500, 'VAPID keys not configured')

    const supa = createClient(SUPABASE_URL, SERVICE_KEY)
    const cronOk = !!CRON_SECRET && req.headers.get('x-cron-secret') === CRON_SECRET
    const authHeader = req.headers.get('Authorization') ?? ''
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

    let userIdFilter: string | null = null
    if (cronOk) {
      userIdFilter = null
    } else if (bearer) {
      const { data: userData, error: userErr } = await supa.auth.getUser(bearer)
      if (userErr || !userData?.user?.id) {
        console.warn('[push-reminders] 401: invalid bearer token')
        return new Response('Unauthorized', { status: 401 })
      }
      userIdFilter = userData.user.id
    } else {
      console.warn('[push-reminders] 401: missing cron secret or bearer token')
      return new Response('Unauthorized', { status: 401 })
    }

    const body = await processDueReminders(supa, userIdFilter)
    console.log('[push-reminders] ok', JSON.stringify(body))
    return new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return err(500, `Unhandled: ${message}`)
  }
})
