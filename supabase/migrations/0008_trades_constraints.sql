-- [BLOQUE 1] Índice único para upsert por (user_id, ticket)
create unique index if not exists trades_user_ticket_ux
on public.trades(user_id, ticket);

-- [BLOQUE 2] Columnas que pueden venir nulas desde CSV
alter table public.trades alter column symbol drop not null;
alter table public.trades alter column dt_open_utc drop not null;
alter table public.trades alter column entry_price drop not null;
alter table public.trades alter column side drop not null;

