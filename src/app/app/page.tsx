import { supabase } from '@/src/lib/supabaseClient'

export default async function AppPage() {
  // This is a simple placeholder. We'll rely on client-side auth checks later.
  return (
    <main className="max-w-5xl mx-auto p-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-4">Painel do Revollution Idea — aqui aparecerão seus workspaces e boards.</p>
      <p className="mt-6">Próximo: integrar auth, criar workspaces e boards.</p>
    </main>
  )
}
