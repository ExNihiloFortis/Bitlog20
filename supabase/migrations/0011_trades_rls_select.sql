-- [B1] RLS ON + policy de lectura por dueño (idempotente)
alter table public.trades enable row level security;

drop policy if exists trades_select_own on public.trades;
create policy trades_select_own
on public.trades
for select
using (auth.uid() = user_id);

