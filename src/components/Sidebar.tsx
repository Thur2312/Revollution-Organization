"use client"
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  CaretDoubleLeft,
  CaretDown,
  CaretRight,
  ClipboardText,
  Envelope,
  Kanban,
  SignOut,
  SquaresFour,
  UserCircle,
  UsersThree,
} from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../lib/supabaseClient'
import { SIDEBAR_REFRESH_EVENT } from '../lib/sidebarRefresh'
import { LogoMark } from './ui/Logo'
import { NotificationBell } from './NotificationBell'

type BoardRow = { id: string; name: string; workspace_id: string }
type WorkspaceRow = { id: string; name: string }

function monogramStyle(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % 2
  return hash === 0 ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'
}

export function Sidebar({ userId }: { userId: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[] | null>(null)
  const [boards, setBoards] = useState<BoardRow[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [collapsed, setCollapsed] = useState(false)
  const [userToggled, setUserToggled] = useState(false)
  const [inviteCount, setInviteCount] = useState(0)

  // Auto-collapse to the icon rail on narrow viewports (tablet/phone) so the
  // sidebar doesn't eat most of the screen — but once the person toggles it
  // by hand, respect that choice instead of fighting them on every resize.
  useEffect(() => {
    if (userToggled) return
    function applyForWidth() {
      setCollapsed(window.innerWidth < 768)
    }
    applyForWidth()
    window.addEventListener('resize', applyForWidth)
    return () => window.removeEventListener('resize', applyForWidth)
  }, [userToggled])

  useEffect(() => {
    if (!userId) return
    let mounted = true
    async function load() {
      const { data: memberships } = await supabase.from('memberships').select('workspace_id').eq('user_id', userId)
      const ids = ((memberships ?? []) as { workspace_id: string }[]).map((m) => m.workspace_id)
      if (ids.length === 0) {
        if (mounted) setWorkspaces([])
        return
      }
      const [{ data: ws }, { data: bd }] = await Promise.all([
        supabase.from('workspaces').select('id, name').in('id', ids).order('name'),
        supabase
          .from('boards')
          .select('id, name, workspace_id')
          .in('workspace_id', ids)
          .order('created_at', { ascending: true }),
      ])
      if (!mounted) return
      setWorkspaces((ws ?? []) as WorkspaceRow[])
      setBoards((bd ?? []) as BoardRow[])
    }
    async function loadInviteCount() {
      const { data } = await supabase.rpc('my_pending_invites')
      if (mounted) setInviteCount((data as unknown[] | null)?.length ?? 0)
    }
    load()
    loadInviteCount()
    window.addEventListener(SIDEBAR_REFRESH_EVENT, loadInviteCount)
    // Workspace/board create/rename/delete happen in sibling components
    // (WorkspaceList, BoardList) that don't share state with this tree —
    // they broadcast this event instead of us polling or lifting state up.
    window.addEventListener(SIDEBAR_REFRESH_EVENT, load)
    return () => {
      mounted = false
      window.removeEventListener('sidebar:refresh', load)
      window.removeEventListener('sidebar:refresh', loadInviteCount)
    }
  }, [userId])

  const activeWorkspaceId = useMemo(() => {
    const workspaceMatch = pathname.match(/^\/app\/workspace\/([^/]+)/)
    if (workspaceMatch) return workspaceMatch[1]
    const boardMatch = pathname.match(/^\/app\/board\/([^/]+)/)
    if (boardMatch) return boards.find((b) => b.id === boardMatch[1])?.workspace_id ?? null
    return null
  }, [pathname, boards])

  const activeBoardId = pathname.match(/^\/app\/board\/([^/]+)/)?.[1] ?? null

  useEffect(() => {
    if (activeWorkspaceId) setExpanded((prev) => ({ ...prev, [activeWorkspaceId]: true }))
  }, [activeWorkspaceId])

  const boardsByWorkspace = useMemo(() => {
    const map: Record<string, BoardRow[]> = {}
    for (const b of boards) (map[b.workspace_id] ??= []).push(b)
    return map
  }, [boards])

  function navClasses(active: boolean) {
    return `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
      active ? 'bg-accent/10 text-accent' : 'text-foreground hover:bg-surface'
    }`
  }

  if (collapsed) {
    return (
      <aside className="flex h-dvh w-16 shrink-0 flex-col items-center gap-3 border-r border-border bg-background py-4">
        <Link href="/app" title="Revollution">
          <LogoMark className="h-8 w-8" />
        </Link>
        <button
          onClick={() => {
            setUserToggled(true)
            setCollapsed(false)
          }}
          title="Expandir menu"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          <CaretRight size={16} />
        </button>
        <NotificationBell userId={userId} collapsed />
        <Link
          href="/app/invites"
          title="Convites"
          className="relative rounded-md p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          <Envelope size={18} />
          {inviteCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold leading-none text-destructive-foreground">
              {inviteCount > 9 ? '9+' : inviteCount}
            </span>
          )}
        </Link>
        <div className="mt-2 flex flex-col items-center gap-1.5">
          {workspaces?.map((w) => (
            <Link
              key={w.id}
              href={`/app/workspace/${w.id}`}
              title={w.name}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold ${monogramStyle(
                w.id
              )} ${activeWorkspaceId === w.id ? 'ring-2 ring-accent ring-offset-1 ring-offset-background' : ''}`}
            >
              {w.name.trim().charAt(0).toUpperCase()}
            </Link>
          ))}
        </div>
        <div className="mt-auto flex flex-col items-center gap-3">
          <Link
            href="/app/profile"
            title="Perfil"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            <UserCircle size={16} />
          </Link>
          <button
            title="Sair"
            onClick={handleSignOut}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface hover:text-destructive"
          >
            <SignOut size={16} />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex h-dvh w-64 shrink-0 flex-col border-r border-border bg-background">
      <div className="flex items-center justify-between px-4 py-4">
        <Link href="/app" className="flex items-center gap-2">
          <LogoMark className="h-7 w-7" />
          <span className="text-[15px] font-semibold tracking-tight text-primary">Revollution</span>
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell userId={userId} collapsed={false} />
          <button
            onClick={() => {
              setUserToggled(true)
              setCollapsed(true)
            }}
            title="Colapsar menu"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            <CaretDoubleLeft size={15} />
          </button>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 px-3">
        <Link href="/app" className={navClasses(pathname === '/app')}>
          <SquaresFour size={17} />
          Meus workspaces
        </Link>
        <Link href="/app/overview" className={navClasses(pathname === '/app/overview')}>
          <ClipboardText size={17} />
          Visão geral
        </Link>
        <Link href="/app/invites" className={navClasses(pathname === '/app/invites')}>
          <Envelope size={17} />
          Convites
          {inviteCount > 0 && (
            <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {inviteCount}
            </span>
          )}
        </Link>
      </nav>

      <div className="mt-4 flex-1 overflow-y-auto px-3">
        <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Workspaces
        </p>
        {workspaces === null ? (
          <div className="flex flex-col gap-1.5 px-1">
            {[0, 1].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-surface" />
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <p className="px-2.5 text-xs text-muted-foreground">Nenhum workspace ainda.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {workspaces.map((w) => {
              const isOpen = !!expanded[w.id]
              const wsBoards = boardsByWorkspace[w.id] ?? []
              return (
                <li key={w.id}>
                  <div className={navClasses(activeWorkspaceId === w.id && !activeBoardId)}>
                    <button
                      onClick={() => setExpanded((prev) => ({ ...prev, [w.id]: !prev[w.id] }))}
                      aria-label={isOpen ? 'Recolher' : 'Expandir'}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      {isOpen ? <CaretDown size={12} weight="bold" /> : <CaretRight size={12} weight="bold" />}
                    </button>
                    <Link href={`/app/workspace/${w.id}`} className="flex min-w-0 flex-1 items-center gap-2">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold ${monogramStyle(
                          w.id
                        )}`}
                      >
                        {w.name.trim().charAt(0).toUpperCase()}
                      </span>
                      <span className="truncate">{w.name}</span>
                    </Link>
                  </div>

                  {isOpen && (
                    <ul className="ml-6 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-2.5">
                      {wsBoards.length === 0 ? (
                        <li className="px-2.5 py-1 text-xs text-muted-foreground">Nenhum board</li>
                      ) : (
                        wsBoards.map((b) => (
                          <li key={b.id}>
                            <Link
                              href={`/app/board/${b.id}`}
                              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                                activeBoardId === b.id
                                  ? 'bg-accent/10 font-medium text-accent'
                                  : 'text-muted-foreground hover:bg-surface hover:text-foreground'
                              }`}
                            >
                              <Kanban size={14} />
                              <span className="truncate">{b.name}</span>
                            </Link>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-1 border-t border-border px-3 py-3">
        {activeWorkspaceId && (
          <Link href={`/app/workspace/${activeWorkspaceId}/members`} className={navClasses(pathname.endsWith('/members'))}>
            <UsersThree size={17} />
            Membros
          </Link>
        )}
        <Link href="/app/profile" className={navClasses(pathname === '/app/profile')}>
          <UserCircle size={17} />
          Perfil
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-destructive"
        >
          <SignOut size={17} />
          Sair
        </button>
      </div>
    </aside>
  )
}
