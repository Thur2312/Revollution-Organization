# Identidade visual — base para o frontend

Extraída por leitura de conteúdo/estrutura de https://revolutionpatentes.com/
(sem inspeção de CSS computado ao vivo — os hex abaixo são uma aproximação
fiel à paleta observada: azul-marinho + verde de ação sobre fundo branco.
Antes de finalizar o tema, validar visualmente contra o site ou pegar os hex
exatos via DevTools).

## Impressão geral
Corporativo mas acessível: layout limpo, bastante whitespace, cards com
cantos arredondados, CTAs em verde sobre fundo azul-marinho/branco,
tipografia sans-serif direta. Adequado para uma ferramenta interna de
produtividade — não precisa adaptação de tom, só de paleta.

## Paleta (tokens)

| Token | Hex | Uso |
|---|---|---|
| `primary` | `#0F2A47` | header, sidebar, texto de destaque, elementos de marca |
| `primary-foreground` | `#FFFFFF` | texto sobre `primary` |
| `accent` | `#16A34A` | CTAs primários, badges de sucesso, estado "Done" |
| `accent-foreground` | `#FFFFFF` | texto sobre `accent` |
| `background` | `#FFFFFF` | fundo geral |
| `muted` | `#F8FAFC` | fundo de colunas do board, cards secundários |
| `border` | `#E2E8F0` | bordas, divisores |
| `foreground` | `#1F2937` | texto principal |
| `foreground-muted` | `#64748B` | texto secundário, metadados de card |
| `destructive` | `#DC2626` | ações destrutivas (deletar board/card) |
| `warning` | `#D97706` | avisos, estado "em risco" |

## Tipografia

- Família: sans-serif do sistema (`ui-sans-serif, system-ui, -apple-system,
  "Segoe UI", Roboto, sans-serif`) — combina com o site de referência e evita
  custo de carregar web font para um MVP de 4 dias.
- Escala: `text-3xl/bold` (headlines de landing), `text-xl/semibold`
  (títulos de board/section), `text-sm` (corpo/cards), `text-xs` (metadados).

## Forma

- `border-radius`: `0.5rem` (8px) em cards/inputs, `0.75rem` (12px) em
  modais e botões primários — espelha os cantos arredondados observados no
  site de referência.
- Sombra padrão de card: `shadow-sm` (elevação sutil, sem drop shadow forte).
- Espaçamento: generoso (`p-4`/`p-6` em cards e seções), evitar densidade —
  alinhado ao "breathing room" do site de referência.

## Tailwind theme (extend)

```ts
// tailwind.config.ts — colar dentro de theme.extend.colors
colors: {
  primary: { DEFAULT: '#0F2A47', foreground: '#FFFFFF' },
  accent: { DEFAULT: '#16A34A', foreground: '#FFFFFF' },
  background: '#FFFFFF',
  muted: { DEFAULT: '#F8FAFC', foreground: '#64748B' },
  border: '#E2E8F0',
  foreground: '#1F2937',
  destructive: { DEFAULT: '#DC2626', foreground: '#FFFFFF' },
  warning: { DEFAULT: '#D97706', foreground: '#FFFFFF' },
},
borderRadius: {
  DEFAULT: '0.5rem',
  lg: '0.75rem',
},
```

Compatível com o esquema de CSS variables que o `shadcn/ui` espera
(`--primary`, `--accent`, `--background`, `--muted`, `--border`,
`--foreground`, `--destructive`) — é só mapear os hex acima pros mesmos
nomes de variável ao rodar `npx shadcn init`.
