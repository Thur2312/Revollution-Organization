"use client"
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

type AppSession = {
  userId: string | null
  loading: boolean
  isPlatformAdmin: boolean
}

const AppSessionContext = createContext<AppSession>({ userId: null, loading: true, isPlatformAdmin: false })

export function AppSessionProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data } = await supabase.auth.getUser()
      if (!mounted) return
      setUserId(data.user?.id ?? null)
      setLoading(false)
    }
    load()
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })
    return () => {
      mounted = false
      data?.subscription?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!userId) {
      setIsPlatformAdmin(false)
      return
    }
    let mounted = true
    async function loadAdminFlag() {
      const { data } = await supabase.from('profiles').select('is_platform_admin').eq('id', userId as string).single()
      if (mounted) setIsPlatformAdmin(data?.is_platform_admin ?? false)
    }
    loadAdminFlag()
    return () => {
      mounted = false
    }
  }, [userId])

  return (
    <AppSessionContext.Provider value={{ userId, loading, isPlatformAdmin }}>{children}</AppSessionContext.Provider>
  )
}

export function useAppSession() {
  return useContext(AppSessionContext)
}
