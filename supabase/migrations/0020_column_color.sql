-- 0020_column_color.sql
-- User-editable color for regular (non-CRM) board columns — same 7-value
-- palette already used for boards.color. Null means no color (neutral),
-- matching every column that existed before this migration.

alter table public.board_columns
  add column color text
  check (color is null or color in ('accent', 'rose', 'amber', 'emerald', 'sky', 'violet', 'slate'));
