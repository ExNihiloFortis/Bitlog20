// [BLOQUE 1] Cliente público (browser) ---------------------------------------
import { createClient } from '@supabase/supabase-js';

// [BLOQUE 2] Env públicas ----------------------------------------------------
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// [BLOQUE 3] Export -----------------------------------------------------------
export const supabaseClient = createClient(url, anon);

