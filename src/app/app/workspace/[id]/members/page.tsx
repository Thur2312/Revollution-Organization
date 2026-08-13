"use client"
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../../../../../lib/supabaseClient'
import { useAppSession } from '../../../../../lib/AppSessionContext'

const MembersPanel = dynamic(() => import('../../../../../components/MembersPanel').then((m) => m.MembersPanel), {
  ssr: false,
})

export default function WorkspaceMembersPage({ params }: { params: { id: string } }) {
  const workspaceId = params.id
  const { userId } = useAppSession()
  const [workspaceName, setWorkspaceName] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('workspaces').select('name').eq('id', workspaceId).single()
      setWorkspaceName((data as { name: string } | null)?.name ?? null)
    }
    load()
  }, [workspaceId])

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href={`/app/workspace/${workspaceId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft size={16} />
        {workspaceName ?? 'Workspace'}
      </Link>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-primary">Membros</h1>
      <p className="mb-8 text-sm text-muted-foreground">Quem tem acesso a este workspace e com qual papel.</p>

      {userId && <MembersPanel workspaceId={workspaceId} userId={userId} />}
    </div>
  )
}
