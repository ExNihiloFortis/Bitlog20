-- [B1] Índice para orden/keyset (dt_open_utc desc, id desc)
create index if not exists idx_trades_dtopen_id_desc
on public.trades (dt_open_utc desc, id desc);

