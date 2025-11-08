-- Catálogo genérico de opciones para dropdowns
-- kind: 'symbol' | 'timeframe' | 'pattern' | 'candle' | 'ea'
create table if not exists public.catalog_items (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('symbol','timeframe','pattern','candle','ea')),
  value text not null,
  sort_index int default 0,
  created_at timestamptz default now(),
  unique(user_id, kind, value)
);

alter table public.catalog_items enable row level security;

drop policy if exists ci_select_own on public.catalog_items;
create policy ci_select_own on public.catalog_items
for select using (auth.uid() = user_id);

drop policy if exists ci_ins_own on public.catalog_items;
create policy ci_ins_own on public.catalog_items
for insert with check (auth.uid() = user_id);

drop policy if exists ci_upd_own on public.catalog_items;
create policy ci_upd_own on public.catalog_items
for update using (auth.uid() = user_id);

drop policy if exists ci_del_own on public.catalog_items;
create policy ci_del_own on public.catalog_items
for delete using (auth.uid() = user_id);

-- Vista por kind ordenada (útil para selects)
create or replace view public.catalog_by_kind as
select kind, value, sort_index
from public.catalog_items
where user_id = auth.uid()
order by kind, sort_index, value;

-- Seed rápido (idempotente) para el usuario actual (si quiere)
-- NOTA: estos inserts no corren solos sin contexto de auth.uid(); los haremos desde la UI.

