-- [BLOQUE 1] Ajustes base -----------------------------------------------------
-- 1. Forzar zona UTC en DB (convención: todos los *_utc)
-- 2. Extensiones útiles
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- [BLOQUE 2] Tabla cruda: trades_raw -----------------------------------------
-- Guarda CSV tal cual (a prueba de cambios futuros)
create table if not exists public.trades_raw (
  id            bigserial primary key,
  user_id       uuid not null,
  -- Campos típicos Exness/MT5 crudos (ajusta/añade si tu CSV trae más)
  ticket        text not null,            -- clave única del broker/CSV
  broker        text,
  broker_account text,
  symbol        text,
  type          text,                     -- BUY/SELL o código del CSV
  lots          numeric,
  opening_time_utc timestamptz,
  closing_time_utc timestamptz,
  entry_price   numeric,
  exit_price    numeric,
  commission_usd numeric,
  swap_usd      numeric,
  profit_usd    numeric,
  raw_json      jsonb,                    -- fila original opcional
  created_at    timestamptz default now()
);
create unique index if not exists trades_raw_user_ticket_idx
  on public.trades_raw(user_id, ticket);

-- [BLOQUE 3] Tabla app: trades (normalizada) ---------------------------------
create table if not exists public.trades (
  id              bigserial primary key,
  user_id         uuid not null,
  ticket          text not null,                -- misma clave de merge
  broker          text,
  broker_account  text,
  symbol          text not null,
  side            text check (side in ('BUY','SELL')),
  volume          numeric,
  ccy             text default 'USD',
  entry_price     numeric,
  exit_price      numeric,
  dt_open_utc     timestamptz not null,
  dt_close_utc    timestamptz,
  timeframe       text,                         -- M1..H4..D1
  session         text,                         -- Tokyo/London/NY/etc.
  ea              text,                         -- nombre estrategia
  fee_usd         numeric,
  swap_usd        numeric,
  tax_usd         numeric,
  pnl_usd_gross   numeric,
  pnl_usd_net     numeric,
  rr              numeric,
  status          text check (status in ('OPEN','CLOSED','CANCELLED')) default 'CLOSED',
  close_reason    text check (close_reason in ('TP','SL','manual','partial','timeout')),
  notes           text,
  tags            text[],
  images_count    int default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create unique index if not exists trades_user_ticket_idx
  on public.trades(user_id, ticket);

-- [BLOQUE 4] Tabla imágenes ---------------------------------------------------
create table if not exists public.trade_images (
  id           bigserial primary key,
  trade_id     bigint not null references public.trades(id) on delete cascade,
  user_id      uuid not null,
  title        text,
  path         text not null, -- journal/u_<uid>/t_<trade_id>/<filename>
  sort_index   int default 0,
  byte_size    int,
  content_type text,
  created_at   timestamptz default now()
);
create index if not exists trade_images_trade_idx on public.trade_images(trade_id);

-- [BLOQUE 5] Jobs de importación ---------------------------------------------
create table if not exists public.imports (
  id             bigserial primary key,
  user_id        uuid not null,
  source         text, -- Exness/MT5/CSV
  file_name      text,
  row_count      int default 0,
  merged_count   int default 0,
  inserted_count int default 0,
  failed_count   int default 0,
  started_at     timestamptz default now(),
  finished_at    timestamptz,
  status         text check (status in ('RUNNING','FAILED','COMPLETED')) default 'RUNNING',
  error_message  text
);

-- [BLOQUE 6] Auditoría mínima -------------------------------------------------
create table if not exists public.audit_log (
  id        bigserial primary key,
  user_id   uuid not null,
  entity    text not null,    -- trades / trade_images / imports
  entity_id bigint,
  action    text not null,    -- CREATE/UPDATE/DELETE/VIEW/EXPORT
  diff      jsonb,
  context   jsonb,
  dt_utc    timestamptz default now()
);

-- [BLOQUE 7] Vistas útiles ----------------------------------------------------
create or replace view public.v_trades_with_duration as
select
  t.*,
  case when t.dt_close_utc is not null
       then extract(epoch from (t.dt_close_utc - t.dt_open_utc))::int
       else null end as duration_sec
from public.trades t;

create or replace view public.v_kpi_min as
select
  user_id,
  count(*)                              as trades_count,
  avg( case when pnl_usd_net is not null
            then case when pnl_usd_net >= 0 then 1 else 0 end::int end ) as win_rate_raw,
  sum(coalesce(pnl_usd_net,0))          as pnl_net_usd,
  sum(coalesce(fee_usd,0))              as fees_usd,
  avg( case when dt_close_utc is not null then extract(epoch from (dt_close_utc - dt_open_utc)) end )::int as avg_duration_sec
from public.trades
group by user_id;

-- [BLOQUE 8] RLS --------------------------------------------------------------
-- [BLOQUE 8] RLS --------------------------------------------------------------
alter table public.trades_raw enable row level security;
alter table public.trades     enable row level security;
alter table public.trade_images enable row level security;
alter table public.imports    enable row level security;
alter table public.audit_log  enable row level security;

-- Política: sólo dueño (auth.uid())
create policy trades_raw_own
  on public.trades_raw for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy trades_own
  on public.trades for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy trade_images_own
  on public.trade_images for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy imports_own
  on public.imports for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy audit_log_own
  on public.audit_log for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- [BLOQUE 9] Triggers de updated_at ------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_trades_updated_at on public.trades;
create trigger trg_trades_updated_at
before update on public.trades
for each row execute procedure public.set_updated_at();

