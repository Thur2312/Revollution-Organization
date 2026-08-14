# Spec do produto — MVP interno tipo Monday.com

Identidade visual baseada em https://revolutionpatentes.com/. Entrega rígida: MVP em 4 dias (lançamento até sexta). Público inicial: até 100 usuários da empresa.

**Objetivo:** entregar um MVP interno com boards kanban, tarefas, comentários, uploads, roles/teams e autenticação, hospedado com frontend em Hostinger e backend gerenciado (Supabase).

## Escopo do MVP (entregar até sexta)
- Autenticação (email/password, OAuth opcional)
- Criação/gestão de Workspaces e Teams
- Boards Kanban: criar, renomear, deletar
- Colunas e Cards: CRUD básico
- Drag & drop entre colunas (arrastar/soltar)
- Card modal: descrição, checklists, comentários
- Upload e anexos em cards (Supabase Storage)
- Permissões básicas por role (owner, admin, member, guest)
- Landing + dashboard interno + apontamento de domínio e SSL na Hostinger

## Fora do escopo para este prazo
- Automations avançadas (fluxos complexos)
- Marketplace/templantes extensos
- Relatórios analíticos avançados
- Integrações externas além de upload básico (adiar)

## Restrições e premissas
- Prazo rígido: lançamento funcional até sexta.
- Infra já disponível: conta Hostinger e domínio (confirmado).
- Stack escolhido: Next.js (TypeScript) + Supabase (Auth, Postgres, Realtime, Storage).
- Máximo de usuários simultâneos esperados no primeiro mês: ~100.

## Recomendação de arquitetura técnica
- Frontend: Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui + Radix para componentes, @dnd-kit para DnD.
- Backend: Supabase (projects): Postgres gerenciado + Realtime + Storage + Edge Functions (futuras).
- Deploy: Frontend build export/Node hospedado na Hostinger (ou site estático com ISR para reduzir dependência Node).
- CI/Dev: GitHub Actions (build/test), lint/format (ESLint, Prettier), husky pre-commit.

## Modelo de dados (alto nível)
- users (supabase auth + perfil)
- workspaces (id, name, owner_id, settings)
- teams (id, workspace_id, name)
- memberships (user_id, workspace_id, role)
- boards (id, workspace_id, name)
- columns (id, board_id, position, name)
- cards (id, column_id, title, description, position, metadata)
- checklists (id, card_id, title)
- checklist_items (id, checklist_id, text, done)
- comments (id, card_id, user_id, text, created_at)
- attachments (id, card_id, storage_path, url, uploaded_by)

## Segurança e RLS (Resumo)
- Usar Row Level Security no Postgres para garantir que usuários só acessem dados do seu workspace.
- Exemplos de políticas: membros só veem boards do workspace; apenas owners podem deletar workspace; comentários vinculados ao workspace.
- Validar uploads com URLs assinadas e permissões de leitura/escrita restritas.

## UX / Páginas principais
- Landing / marketing (home, contato)
- Auth: login, signup, reset password
- Onboarding: criar workspace e convidar membros
- Dashboard: lista de workspaces e boards
- Board view: colunas horizontais, cards, drag & drop
- Card modal: detalhes, checklists, comentários, anexos
- Settings: workspace settings, members, roles

## API / Realtime
- Uso primário do Supabase JS SDK no frontend.
- Realtime channels para: comentários (canal por board/card) e presença básica (online status).
- Edge Functions para webhooks e automations simples (futuras).

## Cronograma (detalhado)
- Terça (dia 0): scaffold repo, layout base, supabase projeto + schema inicial + RLS inicial, landing e auth pages mínimas.
- Quarta (dia 1): auth completo, workspaces/teams, models para boards/columns/cards, CRUD básico.
- Quinta (dia 2): drag & drop, card modal (checklist, comments), uploads e storage integração, roles/permissions.
- Sexta (dia 3): polimentos, testes manuais, build, deploy em Hostinger, apontar DNS, SSL, QA final e correções rápidas.

## Critérios de aceitação (MVP)
- Usuário consegue criar conta, criar workspace, criar board, colunas e cards, mover cards entre colunas.
- Card permite adicionar descrição, checklist, comentário e anexar arquivo.
- Permissões básicas funcionando: membros sem permissão de admin não podem excluir workspace.
- DNS apontado e site acessível via HTTPS no domínio informado.

## Riscos e mitigação
- Hostinger Node/SSL tarde: mitigar servindo frontend estático (ISR) e reduzir dependência de Node em produção.
- Integração realtime pode apresentar latência: implementar comentários via Realtime mas com fallback polling curto.
- Tempo: priorizar features end-to-end (YAGNI) e deixar extras para pós-MVP.

## Testes e QA
- Testes manuais de fluxo (signup → criar workspace → criar board → DnD).
- Testes unitários básicos (components) e smoke e2e com Playwright (sanity).
- Checklist de release (backup supabase, variáveis de ambiente, DNS TTL reduzido antes do deploy).

## Entregáveis imediatos
1. Spec (este arquivo) commitado em repo.
2. Scaffold do projeto Next.js + integração Supabase.
3. MVP funcional implantado no domínio da Hostinger.

## Próximos passos (após sua aprovação do spec)
1. Criar repositório e scaffold Next.js (TS).
2. Configurar Supabase project e aplicar migrations / RLS.
3. Implementar auth e onboarding.
4. Iterar features principais seguindo cronograma.
