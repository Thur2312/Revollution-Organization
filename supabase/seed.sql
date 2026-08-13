-- seed.sql — LOCAL/DEV ONLY. Never run against production.
-- Creates 3 demo auth users (owner/member/guest), one workspace, one board
-- with 3 columns and sample cards, plus a checklist and a comment — enough
-- to exercise the RLS policies and the frontend end to end.
--
-- Password for all demo users: demo1234

-- confirmation_token/recovery_token/email_change_token_new/email_change must be
-- '' rather than NULL: GoTrue's Go scanner errors ("converting NULL to string
-- is unsupported") on login for any user whose these columns are NULL, which
-- normal signups never hit since the auth API always writes '' for them.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'owner@boardplatform.local', crypt('demo1234', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Owner Demo"}',
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111112',
   'authenticated', 'authenticated', 'member@boardplatform.local', crypt('demo1234', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Member Demo"}',
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111113',
   'authenticated', 'authenticated', 'guest@boardplatform.local', crypt('demo1234', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Guest Demo"}',
   '', '', '', '');

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111111',
   '{"sub":"11111111-1111-1111-1111-111111111111","email":"owner@boardplatform.local"}',
   'email', now(), now(), now()),
  ('11111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111112',
   '11111111-1111-1111-1111-111111111112',
   '{"sub":"11111111-1111-1111-1111-111111111112","email":"member@boardplatform.local"}',
   'email', now(), now(), now()),
  ('11111111-1111-1111-1111-111111111113', '11111111-1111-1111-1111-111111111113',
   '11111111-1111-1111-1111-111111111113',
   '{"sub":"11111111-1111-1111-1111-111111111113","email":"guest@boardplatform.local"}',
   'email', now(), now(), now());

-- public.profiles rows are created automatically by the on_auth_user_created
-- trigger. public.memberships owner row is created automatically by the
-- on_workspace_created trigger.

insert into public.workspaces (id, name, slug, owner_id)
values ('22222222-2222-2222-2222-222222222222', 'Demo Workspace', 'demo', '11111111-1111-1111-1111-111111111111');

insert into public.memberships (user_id, workspace_id, role) values
  ('11111111-1111-1111-1111-111111111112', '22222222-2222-2222-2222-222222222222', 'member'),
  ('11111111-1111-1111-1111-111111111113', '22222222-2222-2222-2222-222222222222', 'guest');

insert into public.boards (id, workspace_id, name, created_by)
values ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Sprint Board', '11111111-1111-1111-1111-111111111111');

insert into public.board_columns (id, board_id, name, position) values
  ('44444444-4444-4444-4444-444444444441', '33333333-3333-3333-3333-333333333333', 'To Do', 0),
  ('44444444-4444-4444-4444-444444444442', '33333333-3333-3333-3333-333333333333', 'Doing', 1),
  ('44444444-4444-4444-4444-444444444443', '33333333-3333-3333-3333-333333333333', 'Done', 2);

insert into public.cards (id, column_id, title, description, position, created_by) values
  ('55555555-5555-5555-5555-555555555551', '44444444-4444-4444-4444-444444444441',
   'Configurar autenticacao', 'Login, signup e reset de senha via Supabase Auth.', 0, '11111111-1111-1111-1111-111111111111'),
  ('55555555-5555-5555-5555-555555555552', '44444444-4444-4444-4444-444444444441',
   'Criar onboarding de workspace', 'Fluxo de criacao de workspace e convite de membros.', 1, '11111111-1111-1111-1111-111111111112'),
  ('55555555-5555-5555-5555-555555555553', '44444444-4444-4444-4444-444444444442',
   'Board Kanban com drag and drop', 'Implementar @dnd-kit entre colunas.', 0, '11111111-1111-1111-1111-111111111111'),
  ('55555555-5555-5555-5555-555555555554', '44444444-4444-4444-4444-444444444443',
   'Spec do produto', 'Documento inicial aprovado.', 0, '11111111-1111-1111-1111-111111111111');

insert into public.checklists (id, card_id, title, position)
values ('66666666-6666-6666-6666-666666666661', '55555555-5555-5555-5555-555555555551', 'Etapas', 0);

insert into public.checklist_items (checklist_id, text, done, position) values
  ('66666666-6666-6666-6666-666666666661', 'Configurar provider de email', true, 0),
  ('66666666-6666-6666-6666-666666666661', 'Criar paginas de login/signup', false, 1),
  ('66666666-6666-6666-6666-666666666661', 'Criar pagina de reset de senha', false, 2);

insert into public.comments (card_id, user_id, text) values
  ('55555555-5555-5555-5555-555555555551', '11111111-1111-1111-1111-111111111112', 'Posso comecar pelo signup hoje.'),
  ('55555555-5555-5555-5555-555555555551', '11111111-1111-1111-1111-111111111111', 'Beleza, me chama se travar em algo.');

-- Pending invite: exercises the "convite aguardando cadastro" state (owner
-- invited someone who hasn't signed up yet). Sign up as
-- pending@boardplatform.local locally to see accept_pending_invites() turn
-- this into a membership automatically.
insert into public.workspace_invites (workspace_id, email, role, invited_by)
values ('22222222-2222-2222-2222-222222222222', 'pending@boardplatform.local', 'member', '11111111-1111-1111-1111-111111111111');
