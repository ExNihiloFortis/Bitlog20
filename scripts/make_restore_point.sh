#!/usr/bin/env bash
# [BLOQUE 1] detener si algo falla
set -e

# [BLOQUE 2] crear carpeta backups
mkdir -p backups

# [BLOQUE 3] exportar variables de vercel
vercel env pull .env.vercel
cp -f .env.local backups/.env.local.snapshot || true

# [BLOQUE 4] dump de base de datos supabase
TS=$(date +"%Y%m%d_%H%M%S")
supabase db dump -f "backups/db_${TS}.sql"

# [BLOQUE 5] armar lista de paths existentes
PATHS=()
add() { [ -e "$1" ] && PATHS+=("$1"); }

add ".vercel"
add "app"
add "pages"
add "public"
add "lib"
add "supabase"
add "package.json"
add "package-lock.json"
add "tsconfig.json"
add "next.config.js"
add ".env.local"
add ".env.vercel"
add "backups"

# [BLOQUE 6] crear snapshot comprimido del proyecto (solo existentes)
tar -czf "backups/bitlog_snapshot_${TS}.tar.gz" "${PATHS[@]}"

# [BLOQUE 7] mensaje final
echo "✅ PUNTO DE RESTAURACIÓN creado:"
echo " - backups/db_${TS}.sql"
echo " - backups/bitlog_snapshot_${TS}.tar.gz"

