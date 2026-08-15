-- 0016_board_color.sql
-- Per-board accent color, picked from a fixed palette (see
-- src/components/board/boardColors.ts) — stored as a short key, not a raw
-- hex, so the frontend never has to trust/sanitize arbitrary color input.

alter table public.boards
  add column color text not null default 'accent'
  check (color in ('accent', 'rose', 'amber', 'emerald', 'sky', 'violet', 'slate'));
