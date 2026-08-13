"use client"
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { EnvelopeSimple, LockSimple } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../../../lib/supabaseClient'
import { Logo } from '../../../components/ui/Logo'
import { Field } from '../../../components/ui/Field'
import { Button } from '../../../components/ui/Button'
import { BackToSite } from '../../../components/ui/BackToSite'

type Mode = 'signin' | 'signup'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(mode: Mode, email: string, password: string): string | null {
  if (!EMAIL_RE.test(email)) return 'Digite um email válido.'
  if (mode === 'signup' && password.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (mode === 'signup' && !/[0-9]/.test(password)) return 'A senha precisa ter pelo menos um número.'
  if (password.length < 6) return 'A senha precisa ter pelo menos 6 caracteres.'
  return null
}

export default function SignInPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    const cleanEmail = email.trim().toLowerCase()
    const validationError = validate(mode, cleanEmail, password)
    if (validationError) return setError(validationError)

    setLoading(true)

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
      setLoading(false)
      if (error) return setError(error.message)
      router.push('/app')
      return
    }

    const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password })
    setLoading(false)
    if (error) return setError(error.message)

    if (!data.session) {
      // Email confirmation is required on this project — no session was created,
      // so any pre-existing session in this browser is still the one active.
      // Redirecting to /app here would silently show that other account's data.
      setInfo('Conta criada! Verifique seu email para confirmar antes de entrar.')
      setMode('signin')
      setPassword('')
      return
    }

    router.push('/app')
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-surface px-6 py-12">
      <div className="absolute left-6 top-6">
        <BackToSite />
      </div>
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>

        <div className="rounded-xl border border-border bg-background p-8 shadow-sm">
          <div className="mb-6 flex gap-1 rounded-lg bg-surface p-1">
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                setError(null)
                setInfo(null)
              }}
              className={`h-9 flex-1 rounded-md text-sm font-medium transition-colors ${
                mode === 'signin' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setError(null)
                setInfo(null)
              }}
              className={`h-9 flex-1 rounded-md text-sm font-medium transition-colors ${
                mode === 'signup' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              required
              icon={<EnvelopeSimple size={18} />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              label="Senha"
              type="password"
              name="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'signup' ? 8 : 6}
              icon={<LockSimple size={18} />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === 'signup' && (
              <p className="-mt-2 text-xs text-muted-foreground">Mínimo de 8 caracteres, com pelo menos um número.</p>
            )}

            {info && (
              <p role="status" className="rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent">
                {info}
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? 'Aguarde…' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Acesso restrito a membros convidados da Revollution.
        </p>
      </div>
    </main>
  )
}
