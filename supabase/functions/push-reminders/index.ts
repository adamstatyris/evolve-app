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

function habitIdFromReminderTag(tag: string): string | null {
  if (!tag.startsWith('hrd:')) return null
  const parts = tag.split(':')
  if (parts.length < 3) return null
  return parts[1] || null
}

function emojiForHabitReminder(profile: Profile | null, tag: string): string {
  const hid = habitIdFromReminderTag(tag)
  if (!hid || !profile?.habits?.length) return ''
  const h = profile.habits.find((x) => x && x.id === hid)
  return String(h?.emoji || '').trim()
}

async function loadActiveProfile(
  supa: ReturnType<typeof createClient>,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await supa
    .from('user_state')
    .select('payload')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data?.payload) return null
  const root = data.payload as Root
  if (!root || root.storageVersion !== 5 || !root.profiles || !root.activeProfileId) return null
  return root.profiles[root.activeProfileId] ?? null
}

Deno.serve(async (req) => {
  try {
    if (!CRON_SECRET) return err(500, 'CRON_SECRET not configured')
    if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
      console.warn('[push-reminders] 401: x-cron-secret mismatch')
      return new Response('Unauthorized', { status: 401 })
    }

    if (!SUPABASE_URL || !SERVICE_KEY) return err(500, 'Missing SUPABASE_URL or SERVICE_ROLE')
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return err(500, 'VAPID keys not configured')

    const supa = createClient(SUPABASE_URL, SERVICE_KEY)
    const now = Date.now()
    const nowIso = new Date(now).toISOString()
    const staleIso = new Date(now - STALE_MS).toISOString()

    const { data: due, error: qErr } = await supa
      .from('reminder_schedule')
      .select('id,user_id,slot_key,title,body,tag,fire_at_utc')
      .is('sent_at', null)
      .lte('fire_at_utc', nowIso)
      .gte('fire_at_utc', staleIso)
      .order('fire_at_utc', { ascending: true })
      .limit(300)

    if (qErr) return err(500, qErr.message)

    let sent = 0
    const rows = due ?? []
    const profileCache = new Map<string, Profile | null>()

    for (const row of rows) {
      const { data: subs, error: sErr } = await supa
        .from('push_subscriptions')
        .select('id,endpoint,p256dh,auth')
        .eq('user_id', row.user_id)

      if (sErr) continue

      const list = subs ?? []
      if (!list.length) continue

      let iconEmoji = ''
      if (String(row.tag || '').startsWith('hrd:')) {
        if (!profileCache.has(row.user_id)) {
          profileCache.set(row.user_id, await loadActiveProfile(supa, row.user_id))
        }
        iconEmoji = emojiForHabitReminder(profileCache.get(row.user_id) ?? null, String(row.tag || ''))
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

    const body = { scanned: rows.length, sent }
    console.log('[push-reminders] ok', JSON.stringify(body))
    return new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return err(500, `Unhandled: ${message}`)
  }
})
