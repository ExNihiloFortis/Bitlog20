-- [BLOQUE 1] Permitir nulos en entry_price si fuera necesario
alter table public.trades alter column entry_price drop not null;

