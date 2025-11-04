-- [BLOQUE 1] Permitir nulos en campos estrictos ------------------------------
alter table public.trades alter column symbol drop not null;
alter table public.trades alter column dt_open_utc drop not null;

