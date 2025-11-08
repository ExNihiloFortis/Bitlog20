# ---
# create or replace function public.distinct_symbols()
# returns setof text
# language sql
# security definer
# set search_path = public
# as $$
#   select distinct symbol from public.trades where symbol is not null
#   union
#   select distinct symbol from public.trades_raw where symbol is not null
# $$;
# ---
