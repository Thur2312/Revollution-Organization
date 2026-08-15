-- 0017_column_celebrate.sql
-- Per-column celebration: when enabled, a card landing in this column (by
-- creation or by drag-in) fires a one-off confetti burst for whoever's
-- looking at the board. Client-side only, not synced across other tabs.

alter table public.board_columns
  add column celebrate_on_card boolean not null default false;
