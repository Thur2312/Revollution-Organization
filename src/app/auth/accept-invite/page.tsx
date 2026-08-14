"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LockSimple } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../../../lib/supabaseClient'
import { Logo } from '../../../components/ui/Logo'
import { Field } from '../../../components/ui/Field'
import { Button } from '../../../components/ui/Button'

// Reached from the link in the Supabase invite email. The Supabase client
// auto-detects the access/refresh tokens in the URL hash and establishes a
// session on load (detectSessionInUrl, on by default) — by the time this
// component mounts, `getSession()` should already resolve to that session.
// This page's only job is to let the invited person set their password.
export default function AcceptInvitePage() {
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session)
      setCheckingSession(false)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.')
    if (!/[0-9]/.test(password)) return setError('A senha precisa ter pelo menos um número.')

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) return setError(error.message)

    router.push('/app')
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-surface px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>

        <div className="rounded-xl border border-border bg-background p-8 shadow-sm">
          <h1 className="mb-1 text-lg font-semibold text-primary">Bem-vindo à Revollution</h1>

          {checkingSession ? (
            <p className="text-sm text-muted-foreground">Verificando convite…</p>
          ) : !hasSession ? (
            <p className="text-sm text-muted-foreground">
              Este link de convite é inválido ou expirou. Peça a um administrador para te convidar novamente.
            </p>
          ) : (
            <>
              <p className="mb-6 text-sm text-muted-foreground">Defina uma senha para concluir seu cadastro.</p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Field
                  label="Senha"
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  icon={<LockSimple size={18} />}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="-mt-2 text-xs text-muted-foreground">Mínimo de 8 caracteres, com pelo menos um número.</p>

                {error && (
                  <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}

                <Button type="submit" disabled={loading} className="mt-2 w-full">
                  {loading ? 'Aguarde…' : 'Entrar na Revollution'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
