"use client"
import { useEffect, useRef } from 'react'
import { markSessionHeartbeat, markSessionStart } from '../lib/timesheet'

const HEARTBEAT_MS = 60_000

// Mounted once for the lifetime of an authenticated /app session (see
// src/app/app/layout.tsx). Stamps today's time_entries row on mount and
// keeps it warm with a periodic heartbeat — the definitive end-of-day stamp
// is written separately, from the sign-out handler in Sidebar.tsx.
export function TimesheetHeartbeat({ userId }: { userId: string }) {
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    markSessionStart(userId)

    const interval = setInterval(() => markSessionHeartbeat(userId), HEARTBEAT_MS)
    return () => clearInterval(interval)
  }, [userId])

  return null
}
