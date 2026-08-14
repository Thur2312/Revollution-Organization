import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../supabase/types'

// Server-only client — uses the service role key, which bypasses RLS and can
// call the Auth admin API (e.g. inviteUserByEmail). Never import this from a
// "use client" component; it must only run in route handlers / server code.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export function createSupabaseAdminClient() {
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
