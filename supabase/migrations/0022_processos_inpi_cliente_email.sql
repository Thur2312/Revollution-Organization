-- 0022_processos_inpi_cliente_email.sql
-- Cada processo passa a ter um destinatário próprio (o cliente do
-- workspace por quem o processo foi depositado), preenchido no cadastro,
-- pra que o aviso de atualização vá pra pessoa certa em vez de pra quem
-- cadastrou o processo. Independente de CRM: um processo não precisa de
-- um card correspondente pra ter um e-mail de aviso.

alter table public.processos_inpi add column cliente_nome text;
alter table public.processos_inpi add column cliente_email text;
