#!/usr/bin/env bash
set -euo pipefail

echo "===================="
echo "RESTORE PREFLIGHT"
echo "===================="

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL no está seteada."
  echo "Solución: export DATABASE_URL='...'"
  exit 1
fi

python3 - <<'PY'
import os, urllib.parse, sys
u = urllib.parse.urlparse(os.environ["DATABASE_URL"])
print("user:", u.username)
print("host:", u.hostname)
print("port:", u.port)
print("db  :", u.path)
q = urllib.parse.parse_qs(u.query)
print("sslmode:", q.get("sslmode", ["(none)"])[0])

host = (u.hostname or "")
if "pooler.supabase.com" not in host:
  print("WARNING: host NO parece pooler.supabase.com (ojo IPv6 en free).", file=sys.stderr)

if q.get("sslmode", [""])[0] != "require":
  print("WARNING: sslmode no es require (recomendado).", file=sys.stderr)
PY

echo "===================="
echo "Probando conexión y conteos (solo lectura)..."
echo "===================="

docker run --rm \
  -e DATABASE_URL="$DATABASE_URL" \
  postgres:17 \
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "
select 'trades='||count(*) from public.trades;
select 'journal_entries='||count(*) from public.journal_entries;
"

echo "===================="
echo "OK: Preflight completado."
echo "===================="
