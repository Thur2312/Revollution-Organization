import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '../../../../lib/supabaseAdmin'
import type { Database } from '../../../../../supabase/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Sends the actual invite email once a caller has already created the
// pending public.workspace_invites row via the invite_member() RPC. Kept as
// a separate step (not folded into invite_member) because sending email
// requires the service role key, which must never be reachable from RLS —
// this route re-checks admin membership itself before touching it.
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })

  const { workspaceId, email } = (await request.json()) as { workspaceId?: string; email?: string }
  if (!workspaceId || !email) {
    return NextResponse.json({ error: 'workspaceId and email are required' }, { status: 400 })
  }

  const callerClient = createClient<Database>(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: isAdmin, error: adminCheckError } = await callerClient.rpc('is_workspace_admin', {
    p_workspace_id: workspaceId,
  })
  if (adminCheckError || !isAdmin) {
    return NextResponse.json({ error: 'Only workspace admins can send invites' }, { status: 403 })
  }

  const admin = createSupabaseAdminClient()
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/accept-invite`,
  })
  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
