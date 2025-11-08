-- ===================== [5B] catalog_items (creación/ajuste) =====================
create table if not exists public.catalog_items (
  id bigserial primary key,
  type text not null,         -- symbol | timeframe | ea | pattern | candle
  value text not null,
  sort_index int,
  created_at timestamptz default now()
);

-- índices útiles
create index if not exists catalog_items_type_idx on public.catalog_items(type);
create index if not exists catalog_items_sort_idx on public.catalog_items(type, sort_index);

-- RLS (si usas RLS global, puedes permitir lectura pública y escritura por owner si agregas user_id)
alter table public.catalog_items enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where polname = 'catalog_items_read_all') then
    create policy catalog_items_read_all on public.catalog_items
      for select using (true);
  end if;
end$$;

-- Si quieres escrituras solo para el dueño, añade user_id y políticas;
-- por ahora dejamos abierto para simplificar tu edición en UI.

