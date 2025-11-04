// [BLOQUE 1] Server-only ------------------------------------------------------
import 'server-only';
import { createClient } from '@supabase/supabase-js';

// [BLOQUE 2] Env (Vercel/Local) ----------------------------------------------
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// [BLOQUE 3] Cliente admin (solo servidor) -----------------------------------
export const supabaseAdmin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false }
});


