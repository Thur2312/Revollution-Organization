"use client"
import { useState } from 'react'
import { supabase } from '@/src/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return setError(error.message)
    router.push('/app')
  }

  async function handleSignUp() {
    setError(null)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return setError(error.message)
    // After sign up, redirect or show confirmation
    router.push('/app')
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Entrar / Registrar</h2>
      <form onSubmit={handleSignIn} className="space-y-4">
        <div>
          <label className="block text-sm">Email</label>
          <input className="w-full border p-2 rounded" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm">Senha</label>
          <input type="password" className="w-full border p-2 rounded" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {error && <div className="text-red-600">{error}</div>}
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded" type="submit">Entrar</button>
          <button type="button" onClick={handleSignUp} className="px-4 py-2 bg-gray-200 rounded">Registrar</button>
        </div>
      </form>
    </main>
  )
}
