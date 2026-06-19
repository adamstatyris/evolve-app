import { createClient } from 'jsr:@supabase/supabase-js@2'
import { replaceReminderScheduleForUser } from './reminder_schedule_from_payload.ts'

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('URL') ?? ''
const SERVICE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''

function payloadEligibleForBackup(payload: unknown): boolean {
  if (payload === null || payload === undefined) return false
  if (typeof payload !== 'object') return false
  const o = payload as Record<string, unknown>
  if (Object.keys(o).length === 0) return false
  if (o.storageVersion === undefined || o.storageVersion === null) return false
  return true
}

Deno.serve(async (req) => {
  if (!CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'CRON_SECRET not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supa = createClient(SUPABASE_URL, SERVICE_KEY)
  const nowIso = new Date().toISOString()

  const { data: states, error: qErr } = await supa
    .from('user_state')
    .select('user_id,payload')

  if (qErr) {
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rows = states ?? []
  let processed = 0
  let errors = 0

  for (const row of rows) {
    if (!row || !row.user_id || !payloadEligibleForBackup(row.payload)) continue
    const uid = row.user_id as string
    const livePayload = row.payload

    try {
      const { data: t1Row } = await supa
        .from('user_state_history')
        .select('payload,saved_at')
        .eq('user_id', uid)
        .eq('slot', 'T-1')
        .maybeSingle()

      if (t1Row && t1Row.payload !== null && t1Row.payload !== undefined) {
        const t2SavedAt = (t1Row as { saved_at?: string }).saved_at ?? nowIso
        const del2 = await supa.from('user_state_history').delete().eq('user_id', uid).eq('slot', 'T-2')
        if (del2.error) throw del2.error
        const ins2 = await supa.from('user_state_history').insert({
          user_id: uid,
          slot: 'T-2',
          payload: t1Row.payload,
          saved_at: t2SavedAt,
        })
        if (ins2.error) throw ins2.error
      }

      const nowMs = Date.now()
      const rs = await replaceReminderScheduleForUser(supa, uid, livePayload, nowMs)
      if (!rs.ok) console.warn('[nightly-backup-roll] reminder_schedule', uid, rs.error)

      const del1 = await supa.from('user_state_history').delete().eq('user_id', uid).eq('slot', 'T-1')
      if (del1.error) throw del1.error
      const ins1 = await supa.from('user_state_history').insert({
        user_id: uid,
        slot: 'T-1',
        payload: livePayload,
        saved_at: nowIso,
      })
      if (ins1.error) throw ins1.error
      processed++
    } catch (e) {
      console.warn('[nightly-backup-roll] user failed', uid, e)
      errors++
    }
  }

  return new Response(JSON.stringify({ ok: true, processed, errors, scanned: rows.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
