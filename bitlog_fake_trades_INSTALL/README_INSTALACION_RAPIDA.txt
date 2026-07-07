FAKE TRADES V1 - INSTALACION RAPIDA

1) Copia estas carpetas/archivos en la raiz de Bitlog:

app/fake-trades/
components/FakeTradeImageManager.tsx
supabase/migrations/20260706_fake_trades.sql

2) NO reemplaces components/TopNav.tsx.
Solo abre tu TopNav actual y en NAV_LINKS agrega despues de New:

  { href: "/fake-trades", label: "Fake" },
  { href: "/fake-trades/new", label: "Fake+" },

3) Ejecuta en Supabase SQL Editor el archivo:

supabase/migrations/20260706_fake_trades.sql

4) Corre:

npm run dev

5) Abre:

/fake-trades
/fake-trades/new
/fake-trades/stats

Notas:
- Usa tablas separadas: fake_trades y fake_trade_images.
- Usa el bucket journal existente.
- No mezcla estadisticas con trades reales.
- Resultado: PENDING / WIN / LOSS / NEUTRAL.
