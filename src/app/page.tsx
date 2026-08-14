import Link from 'next/link'
import { Cinzel } from 'next/font/google'
import {
  ArrowRight,
  BellRinging,
  ListChecks,
  MagnifyingGlass,
  ArrowsClockwise,
} from '@phosphor-icons/react/dist/ssr'
import { LogoMark } from '../components/ui/Logo'
import { Reveal } from '../components/ui/Reveal'

const display = Cinzel({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-display' })

const WINE = '#430F1C'
const DEEP = '#2B0A15'
const GOLD = '#C9A26B'
const GOLD_LIGHT = '#E6C98D'
const CREAM = '#F3EAD9'

const features = [
  {
    icon: ListChecks,
    title: 'Cards com tudo que importa',
    body: 'Prioridade, prazo, responsável, checklist e descrição em Markdown. Comente e use @ pra chamar a atenção de um colega direto no card.',
    span: 'md:col-span-2',
  },
  {
    icon: ArrowsClockwise,
    title: 'Tudo atualizado na hora',
    body: 'Uma mudança aparece pra todo mundo no instante em que acontece, sem precisar atualizar a página.',
    span: '',
  },
  {
    icon: MagnifyingGlass,
    title: 'Busca instantânea',
    body: 'Ctrl (ou Cmd) + K abre uma busca que acha qualquer board ou card na hora, de onde você estiver.',
    span: '',
  },
  {
    icon: BellRinging,
    title: 'Notificações e histórico',
    body: 'Um sino avisa quando te atribuem um card ou te mencionam. Cada card guarda o histórico completo do que mudou.',
    span: 'md:col-span-2',
  },
]

const roles = [
  { name: 'Convidado', body: 'Acompanha e comenta nos cards do workspace.' },
  { name: 'Membro', body: 'Cria, edita e organiza cards e colunas.' },
  { name: 'Admin', body: 'Convida gente e gerencia quem tem acesso.' },
  { name: 'Owner', body: 'Responde pelo workspace inteiro.' },
]

function PriorityDot({ tone }: { tone: 'gold' | 'cream' | 'soft' }) {
  const bg = tone === 'gold' ? GOLD : tone === 'cream' ? GOLD_LIGHT : `${GOLD}55`
  return <span className="block h-2 w-2 shrink-0 rounded-full" style={{ background: bg }} />
}

function BoardPreview() {
  const columns: { label: string; cards: { tone: 'gold' | 'cream' | 'soft'; ticks: number }[] }[] = [
    { label: 'A fazer', cards: [{ tone: 'soft', ticks: 1 }, { tone: 'gold', ticks: 0 }] },
    { label: 'Em andamento', cards: [{ tone: 'cream', ticks: 2 }, { tone: 'soft', ticks: 1 }] },
    { label: 'Concluído', cards: [{ tone: 'gold', ticks: 3 }] },
  ]
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-3 gap-3 rounded-2xl border p-4"
      style={{ borderColor: `${GOLD}30`, background: `${DEEP}90` }}
    >
      {columns.map((col) => (
        <div key={col.label} className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-0.5">
            <span className="h-1.5 w-10 rounded-full" style={{ background: `${GOLD}45` }} />
            <span className="text-[9px] font-medium" style={{ color: `${CREAM}55` }}>
              {col.cards.length}
            </span>
          </div>
          {col.cards.map((card, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-lg border p-2.5"
              style={{ borderColor: `${GOLD}22`, background: `${GOLD_LIGHT}0c` }}
            >
              <div className="flex items-center gap-1.5">
                <PriorityDot tone={card.tone} />
                <span className="h-1.5 flex-1 rounded-full" style={{ background: `${CREAM}25` }} />
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 3 }).map((_, j) => (
                  <span
                    key={j}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: j < card.ticks ? GOLD : `${CREAM}18` }}
                  />
                ))}
                <span
                  className="ml-auto h-4 w-4 rounded-full border"
                  style={{ borderColor: `${GOLD}40`, background: `${GOLD}20` }}
                />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function DragCue() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-4 rounded-2xl border p-6"
      style={{ borderColor: `${GOLD}30`, background: `${DEEP}90` }}
    >
      <div className="flex flex-1 flex-col gap-2">
        <span className="h-1.5 w-16 rounded-full" style={{ background: `${GOLD}45` }} />
        <div className="h-14 rounded-lg border opacity-40" style={{ borderColor: `${GOLD}20` }} />
      </div>
      <ArrowRight size={20} weight="bold" style={{ color: GOLD }} />
      <div className="flex flex-1 flex-col gap-2">
        <span className="h-1.5 w-16 rounded-full" style={{ background: `${GOLD}45` }} />
        <div
          className="flex flex-col gap-2 rounded-lg border p-2.5 shadow-lg"
          style={{ borderColor: GOLD, background: `${GOLD_LIGHT}18`, boxShadow: `0 12px 24px -8px ${DEEP}` }}
        >
          <div className="flex items-center gap-1.5">
            <PriorityDot tone="gold" />
            <span className="h-1.5 flex-1 rounded-full" style={{ background: `${CREAM}30` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Seam() {
  return (
    <div aria-hidden="true" className="h-px w-full" style={{ background: `linear-gradient(to right, transparent, ${GOLD}50, transparent)` }} />
  )
}

export default function Home() {
  return (
    <main className={display.variable} style={{ background: DEEP }}>
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
        <span className="inline-flex items-center gap-3">
          <LogoMark className="h-9 w-9" />
          <span
            className="font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-[0.18em]"
            style={{ color: GOLD_LIGHT }}
          >
            REVOLLUTION
          </span>
        </span>
        <Link
          href="/auth/signin"
          className="inline-flex h-9 items-center rounded-full border px-5 text-sm transition-colors"
          style={{ borderColor: `${GOLD}40`, color: GOLD_LIGHT }}
        >
          Entrar
        </Link>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-24 pt-8 md:grid-cols-[1.3fr_1fr] md:pb-32">
        <Reveal>
          <p
            className="font-[family-name:var(--font-display)] text-xs font-semibold tracking-[0.32em]"
            style={{ color: GOLD }}
          >
            MARCAS E PATENTES
          </p>
          <h1
            className="mt-5 font-[family-name:var(--font-display)] text-4xl font-medium leading-[1.15] tracking-tight md:text-[2.75rem]"
            style={{ color: CREAM }}
          >
            Do pedido ao registro,
            <br className="hidden md:block" /> sem perder o prazo.
          </h1>
          <p className="mt-6 max-w-[46ch] text-base leading-relaxed" style={{ color: `${CREAM}b3` }}>
            Boards organizados por cliente e processo, com prazos, responsáveis e
            comentários que a equipe acompanha em tempo real.
          </p>
          <div className="mt-9">
            <Link
              href="/auth/signin"
              className="inline-flex h-12 items-center gap-2 rounded-full px-7 text-sm font-medium transition-colors"
              style={{ background: GOLD, color: DEEP }}
            >
              Entrar
              <ArrowRight size={17} weight="bold" />
            </Link>
          </div>
        </Reveal>
        <Reveal delay={150}>
          <BoardPreview />
        </Reveal>
      </section>

      <Seam />

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 md:py-24 md:grid-cols-[1fr_1.1fr]">
        <Reveal>
          <DragCue />
        </Reveal>
        <Reveal delay={100}>
          <h2
            className="font-[family-name:var(--font-display)] text-2xl font-medium leading-snug md:text-3xl"
            style={{ color: CREAM }}
          >
            Cada processo, seu próprio board.
          </h2>
          <p className="mt-4 max-w-[52ch] text-sm leading-relaxed" style={{ color: `${CREAM}99` }}>
            Organize por workspace e board: as colunas marcam a etapa do processo,
            os cards guardam prazo, responsável e checklist. Arraste entre colunas
            conforme o andamento avança, sem planilha paralela pra manter atualizada.
          </p>
        </Reveal>
      </section>

      <Seam />

      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <Reveal>
          <h2
            className="max-w-md font-[family-name:var(--font-display)] text-2xl font-medium leading-snug md:text-3xl"
            style={{ color: CREAM }}
          >
            Feito pra acompanhar o trabalho de perto.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {features.map(({ icon: Icon, title, body, span }, i) => (
            <Reveal key={title} delay={i * 80} className={span}>
              <div
                className="flex h-full flex-col gap-3 rounded-2xl border p-6"
                style={
                  span
                    ? { borderColor: `${GOLD}30`, background: `linear-gradient(135deg, ${WINE}66, ${WINE}25)` }
                    : { borderColor: `${GOLD}22`, background: `${WINE}40` }
                }
              >
                <Icon size={20} weight="bold" style={{ color: GOLD }} />
                <h3 className="text-base font-semibold" style={{ color: CREAM }}>
                  {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: `${CREAM}99` }}>
                  {body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <Seam />

      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <Reveal>
          <h2
            className="max-w-lg font-[family-name:var(--font-display)] text-2xl font-medium leading-snug md:text-3xl"
            style={{ color: CREAM }}
          >
            Todo mundo vê o mesmo board. Nem todo mundo edita do mesmo jeito.
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <div className="relative mt-14">
            <div
              className="absolute left-0 right-0 top-[15px] h-px md:top-[15px]"
              style={{ background: `linear-gradient(to right, ${GOLD}25, ${GOLD})` }}
            />
            <div className="grid gap-8 md:grid-cols-4">
              {roles.map((role, i) => (
                <div key={role.name} className="relative flex flex-col gap-2 pt-9">
                  <span
                    className="absolute left-0 top-0 h-[9px] w-[9px] rounded-full"
                    style={{ background: i === roles.length - 1 ? GOLD : `${GOLD}70` }}
                  />
                  <span
                    className="text-xs font-semibold uppercase tracking-[0.14em]"
                    style={{ color: GOLD_LIGHT }}
                  >
                    {role.name}
                  </span>
                  <p className="text-sm leading-relaxed" style={{ color: `${CREAM}99` }}>
                    {role.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <Seam />

      <footer className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 opacity-[0.05]"
        >
          <LogoMark className="h-full w-full" />
        </div>
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 py-14 text-center">
          <LogoMark className="h-8 w-8" />
          <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.18em]" style={{ color: GOLD_LIGHT }}>
            REVOLLUTION
          </p>
          <p className="mt-1 text-xs" style={{ color: `${CREAM}66` }}>
            Ferramenta interna de organização e boards
          </p>
        </div>
      </footer>
    </main>
  )
}
