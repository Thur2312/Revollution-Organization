import Link from 'next/link'

export default function Home() {
  return (
    <main className="max-w-4xl mx-auto p-8">
      <header className="flex items-center justify-between mb-12">
        <h1 className="text-3xl font-bold">Revollution Idea</h1>
        <nav>
          <Link href="/app" className="text-sm text-blue-600">Entrar</Link>
        </nav>
      </header>

      <section className="prose">
        <h2>Bem-vindo</h2>
        <p>Produto inicial inspirado no monday.com com identidade visual do Revollution.</p>
        <p>Prazo de lançamento: sexta. MVP: boards, tarefas, comentários, uploads.</p>
      </section>
    </main>
  )
}
