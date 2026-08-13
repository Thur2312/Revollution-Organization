import Link from 'next/link'
import { Cinzel } from 'next/font/google'
import { SquaresFour, ListChecks, UsersThree, ArrowRight, Eye } from '@phosphor-icons/react/dist/ssr'

const display = Cinzel({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-display' })

const capabilities = [
  {
    icon: SquaresFour,
    title: 'Boards por workspace',
    body: 'Colunas e cards organizados por time, com arrastar e soltar entre etapas.',
  },
  {
    icon: ListChecks,
    title: 'Checklists e comentários',
    body: 'Cada card guarda descrição, subtarefas, prazos e o histórico da conversa.',
  },
  {
    icon: UsersThree,
    title: 'Permissões por papel',
    body: 'Owner, admin, membro ou convidado: cada um vê e edita só o que deve.',
  },
]

function Seam() {
  return (
    <div
      aria-hidden="true"
      className="h-px w-full bg-gradient-to-r from-transparent via-[#C9A26B]/50 to-transparent"
    />
  )
}

function RoleBoardPreview({ variant }: { variant: 'member' | 'admin' }) {
  const columns =
    variant === 'member'
      ? [{ rows: 2 }, { rows: 1 }]
      : [{ rows: 3 }, { rows: 2 }, { rows: 3 }, { rows: 1 }]

  return (
    <div
      aria-hidden="true"
      className="flex h-full items-start gap-2.5 rounded-lg border border-[#C9A26B]/25 bg-[#2B0A15]/60 p-3.5"
    >
      {columns.map((col, i) => (
        <div key={i} className="flex flex-1 flex-col gap-1.5">
          <div className="h-1.5 w-2/3 rounded-full bg-[#C9A26B]/30" />
          {Array.from({ length: col.rows }).map((_, j) => (
            <div
              key={j}
              className="h-6 w-full rounded border border-[#C9A26B]/20 bg-[#E6C98D]/[0.08]"
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export default function Home() {
  return (
    <main className={display.variable}>
      {/* Hero — brand-true wine + gold, the register the Revollution mark was actually drawn for */}
      <div className="relative overflow-hidden bg-[#2B0A15]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-1/2 h-[560px] w-[560px] -translate-y-1/2 opacity-[0.07]"
        >
          <img src="/brand/revollution-mark.png" alt="" className="h-full w-full object-contain" />
        </div>

        <header className="relative mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
          <span className="inline-flex items-center gap-3">
            <img src="/brand/revollution-mark.png" alt="Revollution" className="h-9 w-9 rounded-full" />
            <span
              className="font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-[0.18em] text-[#E6C98D]"
            >
              REVOLLUTION
            </span>
          </span>
          <Link
            href="/auth/signin"
            className="inline-flex h-9 items-center rounded-full border border-[#C9A26B]/40 px-5 text-sm text-[#E6C98D] transition-colors hover:border-[#C9A26B] hover:bg-[#C9A26B]/10"
          >
            Entrar
          </Link>
        </header>

        <section className="relative mx-auto max-w-6xl px-6 pb-24 pt-14 md:pt-20">
          <p className="font-[family-name:var(--font-display)] text-xs font-semibold tracking-[0.32em] text-[#C9A26B]">
            MARCAS E PATENTES — PAINEL INTERNO
          </p>
          <h1 className="mt-5 max-w-2xl font-[family-name:var(--font-display)] text-4xl font-medium leading-[1.15] tracking-tight text-[#F3EAD9] md:text-[3.25rem]">
            O escritório, organizado com a precisão de um registro.
          </h1>
          <p className="mt-6 max-w-[48ch] text-base leading-relaxed text-[#F3EAD9]/70">
            Boards, processos, prazos e times da Revollution reunidos num único painel
            interno — feito para o ritmo de quem protege marcas todos os dias.
          </p>
          <div className="mt-9">
            <Link
              href="/auth/signin"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[#C9A26B] px-7 text-sm font-medium text-[#2B0A15] transition-colors hover:bg-[#E6C98D]"
            >
              Acessar plataforma
              <ArrowRight size={17} weight="bold" />
            </Link>
          </div>
        </section>
      </div>

      <Seam />

      {/* Signature: the one thing worth knowing about how the board actually behaves */}
      <section className="bg-[#430F1C] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <p className="font-[family-name:var(--font-display)] text-xs font-semibold tracking-[0.32em] text-[#C9A26B]">
            VISIBILIDADE POR PAPEL
          </p>
          <h2 className="mt-4 max-w-xl font-[family-name:var(--font-display)] text-2xl font-medium leading-snug text-[#F3EAD9] md:text-3xl">
            Cada pessoa vê o que é dela. O admin vê tudo.
          </h2>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-[#C9A26B]/20 bg-[#2B0A15]/40 p-6">
              <div className="mb-4 flex items-center gap-2 text-[#E6C98D]">
                <Eye size={16} />
                <span className="text-sm font-medium">Sua visão</span>
              </div>
              <div className="h-32">
                <RoleBoardPreview variant="member" />
              </div>
              <p className="mt-4 text-sm text-[#F3EAD9]/60">
                Membros veem só os cards em que estão envolvidos — sem ruído do resto do
                escritório.
              </p>
            </div>

            <div className="rounded-2xl border border-[#C9A26B]/20 bg-[#2B0A15]/40 p-6">
              <div className="mb-4 flex items-center gap-2 text-[#E6C98D]">
                <SquaresFour size={16} />
                <span className="text-sm font-medium">Visão do admin</span>
              </div>
              <div className="h-32">
                <RoleBoardPreview variant="admin" />
              </div>
              <p className="mt-4 text-sm text-[#F3EAD9]/60">
                Admins acompanham todos os processos, de todos os times, em qualquer board.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Seam />

      <section className="bg-[#2B0A15]">
        <div className="mx-auto grid max-w-6xl divide-y divide-[#C9A26B]/15 md:grid-cols-3 md:divide-x md:divide-y-0">
          {capabilities.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex flex-col gap-3 px-6 py-12">
              <Icon size={20} weight="bold" className="text-[#C9A26B]" />
              <h3 className="text-base font-semibold text-[#F3EAD9]">{title}</h3>
              <p className="text-sm leading-relaxed text-[#F3EAD9]/60">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <Seam />

      <footer className="relative overflow-hidden bg-[#2B0A15]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 opacity-[0.05]"
        >
          <img src="/brand/revollution-mark.png" alt="" className="h-full w-full object-contain" />
        </div>
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 py-12 text-center">
          <img src="/brand/revollution-mark.png" alt="Revollution" className="h-8 w-8 rounded-full" />
          <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.18em] text-[#E6C98D]">
            REVOLLUTION
          </p>
          <p className="text-xs tracking-[0.1em] text-[#F3EAD9]/50">MARCAS E PATENTES</p>
          <p className="mt-3 text-xs text-[#F3EAD9]/40">Ferramenta interna Revollution</p>
        </div>
      </footer>
    </main>
  )
}
