create or replace view public.distinct_symbols as
select distinct symbol
from public.trades
where symbol is not null and length(trim(symbol)) > 0
order by 1;

create index if not exists trades_symbol_idx on public.trades (symbol);
