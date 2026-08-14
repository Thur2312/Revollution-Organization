# QA — checklist do MVP

## Fluxo manual principal

- [ ] Signup com email/senha cria usuário e o profile é criado automaticamente
      (trigger `on_auth_user_created`)
- [ ] Login e logout funcionam
- [ ] Reset de senha (envio de email + troca) funciona
- [ ] Criar workspace: usuário vira `owner` automaticamente (trigger
      `on_workspace_created`)
- [ ] Convidar membro para o workspace com role `admin`/`member`/`guest`
      via `invite_member(workspace_id, email, role)`
- [ ] Convidar email que **já** tem conta: `invite_member` retorna `'added'`
      e a membership aparece na hora
- [ ] Convidar email que **não** tem conta: `invite_member` retorna
      `'invited'` e fica pendente em `workspace_invites` (ver seed:
      `pending@boardplatform.local`)
- [ ] Ao esse email fazer signup, `accept_pending_invites()` cria a
      membership sozinho e marca o convite como aceito (`accepted_at`)
- [ ] Reconvidar o mesmo email antes de aceitar atualiza o convite existente
      (não duplica linha em `workspace_invites`)
- [ ] Revogar convite pendente (delete em `workspace_invites`, só admin)
- [ ] Criar board dentro do workspace
- [ ] Renomear e deletar board
- [ ] Criar, renomear e deletar colunas
- [ ] Criar card numa coluna
- [ ] Drag & drop de card entre colunas persiste a nova coluna/posição após
      reload da página
- [ ] Abrir card modal: editar descrição, criar checklist, marcar/desmarcar
      item, comentar, anexar arquivo
- [ ] Comentário aparece em tempo real pra outro usuário com o card aberto
      (Realtime) — se não aparecer instantâneo, confirmar fallback de
      polling curto
- [ ] Anexo enviado é baixável só por quem tem acesso ao workspace (testar
      link direto sem estar logado — deve falhar)

## Permissões por role (usar os 3 usuários demo do seed: owner/member/guest)

- [ ] `member` **não** consegue deletar o workspace (nem ver a opção, nem
      via chamada direta à API)
- [ ] `member` consegue criar/editar boards, colunas e cards
- [ ] `guest` **não** consegue criar/editar boards, colunas, cards ou
      checklists (RLS deve bloquear o `insert`/`update`)
- [ ] `guest` consegue ver os boards do workspace, comentar e anexar
      arquivo em um card
- [ ] Usuário sem membership no workspace não vê nada dele (nem via URL
      direta de um board)
- [ ] Apenas `owner`/`admin` conseguem convidar/remover membros —
      `member`/`guest` chamando `invite_member` diretamente recebe exceção
      ("only workspace admins can invite members")
- [ ] Um membro consegue sair do workspace (remover a própria membership)

## Smoke e2e (Playwright — fluxo mínimo, não cobertura completa)

```
signup -> login -> criar workspace -> criar board -> criar 2 colunas
-> criar card -> abrir card -> adicionar comentário -> fechar
-> arrastar card pra outra coluna -> reload -> confirmar posição persistida
```
Rodar esse smoke contra o ambiente de staging/local antes de cada deploy
para produção, não só uma vez.

## Checklist de release (ver detalhes em `docs/deploy-hostinger.md`)

- [ ] Backup do banco hospedado antes do deploy final
- [ ] Variáveis de ambiente de produção conferidas
- [ ] DNS com TTL reduzido, SSL ativo
- [ ] Smoke test manual rodado direto em produção após o deploy
