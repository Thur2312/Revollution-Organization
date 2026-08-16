"use client"
import { useEffect, useRef } from 'react'
import { markSessionHeartbeat, markSessionStart } from '../lib/timesheet'

const HEARTBEAT_MS = 30_000

// Mounted once for the lifetime of an authenticated /app session (see
// src/app/app/layout.tsx). Stamps today's time_entries row on mount and
// keeps it warm with a periodic heartbeat — there's no reliable "browser
// closed" event, so a closed tab is only detectable as this heartbeat going
// stale (see the timesheet page, which treats a frozen last_seen_at as the
// effective end of the session).
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
