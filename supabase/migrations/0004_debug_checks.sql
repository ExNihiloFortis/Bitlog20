-- [BLOQUE 1] ¿Cuántos registros crudos tienes por usuario?
select user_id, count(*) as rows_raw
from public.trades_raw
group by user_id
order by rows_raw desc;

-- [BLOQUE 2] ¿Cuántos trades normalizados?
select user_id, count(*) as rows_trades
from public.trades
group by user_id
order by rows_trades desc;
