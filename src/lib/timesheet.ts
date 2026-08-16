import { supabase } from './supabaseClient'

// Local calendar date (not UTC) so a session that starts at 23:50 and a
// heartbeat at 00:05 don't get split across two work_date rows for most
// timezones people actually work in.
export function todayLocal(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Called once per session (mount) and re-opens today's entry (clearing a
// stale ended_at) if the person had already signed out once today.
export async function markSessionStart(userId: string) {
  const work_date = todayLocal()
  const { data: existing } = await supabase
    .from('time_entries')
    .select('id, ended_at')
    .eq('user_id', userId)
    .eq('work_date', work_date)
    .maybeSingle()

  if (!existing) {
    await supabase.from('time_entries').insert({ user_id: userId, work_date })
    return
  }
  if (existing.ended_at) {
    await supabase
      .from('time_entries')
      .update({ ended_at: null, last_seen_at: new Date().toISOString() })
      .eq('id', existing.id)
  }
}

// Called periodically while the app is open. There's no reliable way to run
// code exactly when a browser/tab is closed, so this heartbeat IS the end-of
// -session signal: once it stops (tab closed), last_seen_at simply stops
// moving, and the timesheet view treats that frozen timestamp as when the
// session ended. Signing out does NOT stamp an end — only closing the
// browser does, per how this is meant to track "time on the platform".
export async function markSessionHeartbeat(userId: string) {
  await supabase
    .from('time_entries')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('work_date', todayLocal())
}
