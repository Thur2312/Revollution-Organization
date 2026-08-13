"use client"
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

type AppSession = {
  userId: string | null
  loading: boolean
}

const AppSessionContext = createContext<AppSession>({ userId: null, loading: true })

export function AppSessionProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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

  return <AppSessionContext.Provider value={{ userId, loading }}>{children}</AppSessionContext.Provider>
}

export function useAppSession() {
  return useContext(AppSessionContext)
}
