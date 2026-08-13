"use client"
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '../../../../lib/supabaseClient'
import { useAppSession } from '../../../../lib/AppSessionContext'

const BoardList = dynamic(() => import('../../../../components/BoardList'), { ssr: false })

export default function WorkspacePage({ params }: { params: { id: string } }) {
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
      <h1 className="text-2xl font-semibold tracking-tight text-primary">{workspaceName ?? ' '}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Boards deste workspace.</p>

      <div className="mt-8">{userId && <BoardList workspaceId={workspaceId} userId={userId} />}</div>
    </div>
  )
}
