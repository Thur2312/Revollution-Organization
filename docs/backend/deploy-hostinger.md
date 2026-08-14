# Deploy — Hostinger (frontend) + Supabase (backend)

## Decisão de hospedagem do frontend

Com prazo até sexta e SSR não sendo essencial no MVP (páginas dependem de
dados carregados client-side via Supabase JS + RLS), **priorizar export
estático do Next.js** (`output: 'export'`) servido como site estático na
Hostinger, em vez de depender de Node rodando no plano de hospedagem:

- Menos pontos de falha no dia do lançamento (sem processo Node pra
  manter/reiniciar, sem risco de a Hostinger não suportar a versão de
  Node necessária).
- Perde: rotas dinâmicas server-side e Server Actions. Não é um problema
  aqui porque toda leitura/escrita de dados já passa pelo Supabase JS SDK
  no browser.
- Se alguma página precisar mesmo de servidor (ex.: rota de callback OAuth
  específica), isolar só essa rota e reavaliar plano Node da Hostinger só
  para ela; manter o resto estático.

## Passo a passo

1. **Domínio e SSL**
   - Confirmar o domínio já apontado (registrado no pedido do produto).
   - Na Hostinger: ativar SSL (Let's Encrypt automático, geralmente já
     habilitado por padrão) e reduzir o TTL do DNS para 300s **antes** do
     dia do deploy final, para propagação rápida em caso de troca de IP.

2. **Build do frontend**
   ```bash
   npm run build   # com output: 'export' no next.config
   ```
   Isso gera `out/` — é esse diretório que sobe pra Hostinger (File Manager
   ou FTP/SFTP, na raiz `public_html`).

3. **Variáveis de ambiente**
   Como é export estático, `NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` são embutidas no build (não existem em
   runtime no servidor) — conferir que o `.env` de produção está correto
   **antes** de rodar `npm run build`, senão precisa rebuildar e resubir.

4. **Supabase — Auth Redirect URLs**
   Antes de liberar o domínio final: Dashboard → Authentication → URL
   Configuration → adicionar o domínio de produção em `Site URL` e
   `Redirect URLs`. Sem isso, login/reset de senha falha silenciosamente em
   produção mesmo com o resto funcionando.

5. **CI (GitHub Actions)** — preparar o workflow agora, ativar quando o
   repositório git for criado:
   ```yaml
   name: build
   on: [push]
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: 20 }
         - run: npm ci
         - run: npm run lint
         - run: npm run build
   ```
   Deploy em si (upload pra Hostinger) pode ficar manual no dia 3 dado o
   prazo — automatizar via FTP Action é opcional, não bloqueante pro MVP.

## Checklist de release (sexta)

- [ ] `supabase db push` aplicado no projeto hospedado (migrations 0001–0005)
- [ ] Backup manual do banco antes do push final: `supabase db dump -f backup.sql`
- [ ] Auth Redirect URLs configuradas com o domínio final
- [ ] Bucket `attachments` confirmado como privado no dashboard
- [ ] `.env` de produção conferido e build gerado depois dele
- [ ] DNS com TTL baixo, apontamento testado, SSL ativo (cadeado no browser)
- [ ] Smoke test manual pós-deploy: signup → criar workspace → criar board →
      criar card → mover entre colunas → abrir modal → comentar → anexar
      arquivo
- [ ] Rollback plan: manter o build anterior (`out/` anterior) salvo antes
      de sobrescrever, para reverter rápido se algo quebrar em produção
