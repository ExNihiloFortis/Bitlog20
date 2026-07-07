-- Fake Trades V1: separado de trades reales
create table if not exists public.fake_trades (
  id bigserial primary key,
  user_id uuid not null,
  symbol text not null,
  side text check (side in ('BUY','SELL')),
  timeframe text,
  setup_datetime timestamptz,
  source_type text check (source_type in ('PROPIA','EXTERNA')) default 'PROPIA',
  source_name text,
  source_url text,
  pattern_name text,
  entry_price numeric,
  stop_loss numeric,
  take_profit numeric,
  expected_move text,
  result text check (result in ('PENDING','WIN','LOSS','NEUTRAL')) default 'PENDING',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.fake_trade_images (
  id bigserial primary key,
  fake_trade_id bigint not null references public.fake_trades(id) on delete cascade,
  user_id uuid not null,
  title text,
  storage_path text,
  external_url text,
  sort_index int default 0,
  created_at timestamptz default now()
);

create index if not exists fake_trades_user_created_idx on public.fake_trades(user_id, created_at desc);
create index if not exists fake_trades_user_symbol_idx on public.fake_trades(user_id, symbol);
create index if not exists fake_trades_user_result_idx on public.fake_trades(user_id, result);
create index if not exists fake_trade_images_trade_idx on public.fake_trade_images(fake_trade_id);

alter table public.fake_trades enable row level security;
alter table public.fake_trade_images enable row level security;

drop policy if exists fake_trades_own on public.fake_trades;
create policy fake_trades_own
  on public.fake_trades for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists fake_trade_images_own on public.fake_trade_images;
create policy fake_trade_images_own
  on public.fake_trade_images for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists trg_fake_trades_updated_at on public.fake_trades;
create trigger trg_fake_trades_updated_at
before update on public.fake_trades
for each row execute procedure public.set_updated_at();
