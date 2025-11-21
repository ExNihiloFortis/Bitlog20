-- Crea tabla para guardar códigos OTP de 2FA por usuario

create table if not exists public.user_otp (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_user_otp_user_code
  on public.user_otp (user_id, code, used);

create index if not exists idx_user_otp_expires_at
  on public.user_otp (expires_at);

