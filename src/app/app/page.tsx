"use client"
import dynamic from 'next/dynamic'
import { useAppSession } from '../../lib/AppSessionContext'

const WorkspaceList = dynamic(() => import('../../components/WorkspaceList'), { ssr: false })

export default function AppPage() {
  const { userId } = useAppSession()

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-primary">Seus workspaces</h1>
      <p className="mt-1 text-sm text-muted-foreground">Boards e times que você administra ou dos quais participa.</p>

      <div className="mt-8">{userId && <WorkspaceList userId={userId} />}</div>
    </div>
  )
}
