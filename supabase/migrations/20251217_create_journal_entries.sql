-- =====================================================
-- Bitlog 2.5 → Journal Mental (pensamientos diarios)
-- =====================================================

create table if not exists public.journal_entries (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  entry_date  date not null, -- día local (America/Mazatlan)
  content     text not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (user_id, entry_date)
);

create index if not exists idx_journal_user_date
on public.journal_entries (user_id, entry_date);

alter table public.journal_entries enable row level security;

create policy journal_entries_own
on public.journal_entries
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create trigger trg_journal_updated_at
before update on public.journal_entries
for each row
execute procedure public.set_updated_at();

