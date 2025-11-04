-- [BLOQUE 1] Crear bucket privado 'journal' (idempotente)
insert into storage.buckets (id, name, public)
values ('journal', 'journal', false)
on conflict (id) do nothing;

-- [BLOQUE 2] (Opcional) Políticas de lectura/escritura por RLS vía RPC/FW
--   - Mantener bucket privado (public = false)
--   - Acceso a archivos solo con Signed URLs desde la app

