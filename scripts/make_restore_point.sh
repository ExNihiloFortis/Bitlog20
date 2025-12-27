#!/usr/bin/env bash
set -euo pipefail

# ====================
# CONFIG
# ====================
RP_DATE="${1:-$(date +%F)}"  # YYYY-MM-DD
RP_DIR="backups/BitLog_RESTOREPOINT_${RP_DATE}"
FULL_TAR="backups/BitLog_RESTOREPOINT_${RP_DATE}_FULL.tar.gz"

echo "===================="
echo "MAKE RESTORE POINT"
echo "date=$RP_DATE"
echo "dir =$RP_DIR"
echo "===================="

# ====================
# GUARDS
# ====================
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL no está seteada."
  exit 1
fi

# Asegurar gitignore de backups/
if ! grep -qE '^\s*backups/\s*$' .gitignore 2>/dev/null; then
  echo "ERROR: backups/ no está en .gitignore"
  echo "Solución: echo 'backups/' >> .gitignore && git add .gitignore && git commit -m 'chore: ignore backups'"
  exit 1
fi

mkdir -p "$RP_DIR"/{code,db,docs}

# ====================
# 1) TAR CODE
# ====================
echo "[1/5] Tarring code..."
tar -czf "$RP_DIR/code/bitlog_code.tar.gz" \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git \
  --exclude=backups \
  .

# ====================
# 2) DB DUMP (Postgres 17 via Docker)
# ====================
echo "[2/5] Dumping DB (postgres:17)..."
docker run --rm \
  -e DATABASE_URL="$DATABASE_URL" \
  -v "$PWD/$RP_DIR/db:/dump" \
  postgres:17 \
  pg_dump "$DATABASE_URL" \
    --format=custom \
    --no-owner \
    --no-privileges \
    --file=/dump/bitlog_db.dump

# ====================
# 3) QUICK VALIDATION (counts from live DB)
# ====================
echo "[3/5] Validating live counts..."
LIVE_COUNTS="$(docker run --rm -e DATABASE_URL="$DATABASE_URL" postgres:17 \
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atc \
  "select count(*) from public.trades; select count(*) from public.journal_entries;")"

TRADES_CT="$(echo "$LIVE_COUNTS" | sed -n '1p')"
JOURNAL_CT="$(echo "$LIVE_COUNTS" | sed -n '2p')"

# ====================
# 4) RESTORE_POINT.md
# ====================
echo "[4/5] Writing RESTORE_POINT.md..."
cat > "$RP_DIR/docs/RESTORE_POINT.md" <<MD
# BitLog Restore Point — ${RP_DATE} (0–100 con DATOS)

## Snapshot
- Fecha: ${RP_DATE}
- TZ: America/Mazatlan (UTC-7)
- Incluye datos: SÍ (DB dump Postgres custom)

## Incluye (datos)
- public.trades: ${TRADES_CT}
- public.journal_entries: ${JOURNAL_CT}

## Imágenes
- Nota: Las imágenes NO se respaldan en Supabase Storage.
- BitLog guarda enlaces (URLs externas, p.ej. imgBB). Este restore point respalda la BD con esos enlaces.

## Archivos
- code/bitlog_code.tar.gz
- db/bitlog_db.dump
- checksums.sha256
- FULL: BitLog_RESTOREPOINT_${RP_DATE}_FULL.tar.gz

## Restore 0–100 (nuevo entorno)
1) Código
   - tar -xzf bitlog_code.tar.gz
   - npm i
   - set env vars
   - npm run build

2) DB (con datos)
   - pg_restore --no-owner --no-privileges -d <TARGET_DB_URL> bitlog_db.dump

## Verificación post-restore
- /trades muestra historial
- /journal muestra entradas
- app carga sin errores
MD

# ====================
# 5) CHECKSUMS + FULL TAR
# ====================
echo "[5/5] Checksums + FULL tar..."
(
  cd "$RP_DIR"
  sha256sum \
    code/bitlog_code.tar.gz \
    db/bitlog_db.dump \
    docs/RESTORE_POINT.md \
    > checksums.sha256
)

tar -czf "$FULL_TAR" -C backups "BitLog_RESTOREPOINT_${RP_DATE}"

echo "===================="
echo "DONE ✅"
echo "RP_DIR:   $RP_DIR"
echo "FULL_TAR: $FULL_TAR"
echo "===================="
ls -lh "$RP_DIR"/{code,db,docs} "$FULL_TAR"
