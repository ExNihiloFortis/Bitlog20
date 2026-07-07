# Bitlog Fake Trades V1

Objetivo: módulo sencillo y separado de trades reales.

Rutas nuevas:
- `/fake-trades`
- `/fake-trades/new`
- `/fake-trades/[id]`
- `/fake-trades/[id]/edit`
- `/fake-trades/stats`

Tablas nuevas:
- `fake_trades`
- `fake_trade_images`

No mezcla estadísticas con `trades`.
Usa el mismo estilo CSS existente y un carrusel copiado/adaptado de `ImageManager`.

Instalación:
1. Copia las carpetas `app`, `components` y `supabase` encima del proyecto.
2. Aplica la migración `supabase/migrations/20260706_fake_trades.sql`.
3. Reemplaza `components/TopNav.tsx` por el incluido si quieres accesos directos en el menú.
4. Ejecuta `npm run dev`.
