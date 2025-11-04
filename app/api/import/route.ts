// [BLOQUE 1] Proxy a Supabase Edge Function ----------------------------------
import { NextRequest } from "next/server";

export async function POST(req: NextRequest){
  try{
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if(!file) return new Response(JSON.stringify({ok:false, error:"Missing file"}), { status:400 });

    // Construye URL del Edge Function: https://<ref>.functions.supabase.co/import_csv
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL!; // https://xxxx.supabase.co
    const fnUrl = base.replace(".supabase.co", ".functions.supabase.co") + "/import_csv";

    // Usa service role en servidor (seguro en server only)
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const fd = new FormData();
    fd.append("file", file, (file as any).name || "import.csv");

    const res = await fetch(fnUrl, { method:"POST", body: fd, headers:{ "Authorization": `Bearer ${svc}` } });
    const json = await res.json();
    return new Response(JSON.stringify(json), { status: res.ok?200:500 });
  }catch(e:any){
    return new Response(JSON.stringify({ ok:false, error: e?.message || "Server error" }), { status:500 });
  }
}

