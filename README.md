# Revollution Idea — MVP

Scaffold inicial do projeto Next.js (TypeScript) com Tailwind e integração com Supabase.

Quick start

1. Copie `.env.example` para `.env.local` e adicione as chaves do Supabase.

```bash
npm install
npm run dev
```

Deploy na Hostinger

- Build: `npm run build`
- Start: `npm run start`
- Se preferir minimizar setup no Hostinger, exporte como site estático e use Supabase para backend.

Próximos passos que vou executar:
- Configurar projeto Supabase (schema inicial, RLS) — preciso das credenciais do Supabase.
- Implementar autenticação e CRUD de boards/columns/cards.
