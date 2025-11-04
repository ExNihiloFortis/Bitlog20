-- [BLOQUE 1] Drop constraint actual (si existe)
alter table public.trades
  drop constraint if exists trades_close_reason_check;

-- [BLOQUE 2] Nuevo constraint de valores permitidos (+ NULL)
alter table public.trades
  add constraint trades_close_reason_check
  check (
    close_reason is null
    or close_reason in (
      'TP', 'SL', 'MANUAL', 'BREAKEVEN', 'TIME', 'OTHER'
    )
  );

