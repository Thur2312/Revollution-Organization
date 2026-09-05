"use client"
import { useEffect, useState } from 'react'
import { DeviceMobile, DownloadSimple, X } from '@phosphor-icons/react/dist/ssr'
import { Button } from './ui/Button'

const DISMISSED_KEY = 'revollution-install-card-dismissed'

// Chrome/Edge/Android fire this before showing their own install UI, which
// we suppress (preventDefault) so we can trigger it later from our own
// button instead of an unpredictable browser-owned prompt.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari doesn't support display-mode: standalone detection the same way
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function InstallAppCard() {
  const [dismissed, setDismissed] = useState(true)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    if (localStorage.getItem(DISMISSED_KEY) === '1') return
    setDismissed(false)

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {}
  }

  async function handleInstall() {
    if (!installEvent) return
    setInstalling(true)
    try {
      await installEvent.prompt()
      const { outcome } = await installEvent.userChoice
      if (outcome === 'accepted') dismiss()
    } finally {
      setInstalling(false)
      setInstallEvent(null)
    }
  }

  if (dismissed) return null

  return (
    <div className="mb-8 flex flex-col gap-4 rounded-xl border border-accent/30 bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <DeviceMobile size={20} className="mt-0.5 shrink-0 text-accent" />
        <div>
          <p className="text-sm font-medium text-foreground">Tenha o Revollution no seu celular</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {installEvent
              ? 'Instale como app pra abrir direto da tela inicial, sem barra de endereço.'
              : 'No menu do navegador, escolha "Adicionar à tela inicial" (ou "Instalar app"). No iPhone é pelo botão de compartilhar do Safari.'}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {installEvent && (
          <Button type="button" size="sm" onClick={handleInstall} disabled={installing}>
            <DownloadSimple size={14} weight="bold" />
            {installing ? 'Instalando…' : 'Instalar app'}
          </Button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
