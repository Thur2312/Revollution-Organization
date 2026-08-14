"use client"
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { CheckCircle, Info, WarningCircle, X } from '@phosphor-icons/react/dist/ssr'

type ToastType = 'success' | 'error' | 'info'

type ToastItem = {
  id: number
  type: ToastType
  message: string
  leaving: boolean
}

type ToastFn = (message: string, type?: ToastType) => void

const ToastContext = createContext<ToastFn>(() => {})

const iconByType: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: WarningCircle,
  info: Info,
}

const styleByType: Record<ToastType, string> = {
  success: 'border-accent/40 text-foreground [&_svg]:text-accent',
  error: 'border-destructive/40 text-foreground [&_svg]:text-destructive',
  info: 'border-border text-foreground [&_svg]:text-muted-foreground',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 200)
  }, [])

  const toast = useCallback<ToastFn>(
    (message, type = 'success') => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, type, message, leaving: false }])
      setTimeout(() => dismiss(id), 3500)
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-80 flex flex-col gap-2">
        {toasts.map((t) => {
          const Icon = iconByType[t.type]
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-xl border bg-background px-4 py-3 text-sm shadow-lg ${
                styleByType[t.type]
              }`}
              style={{ animation: `${t.leaving ? 'toast-out' : 'toast-in'} 200ms ease-out forwards` }}
            >
              <Icon size={18} weight="fill" className="mt-0.5 shrink-0" />
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Fechar"
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
