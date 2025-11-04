// [BLOQUE 1] Import CSV (client) con ref y token ------------------------------
"use client";
import { useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function Page(){
  const fileRef = useRef<HTMLInputElement>(null);
  const [out,setOut]=useState<any>(null);
  const [err,setErr]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);

  const onUpload=async(e:React.FormEvent)=>{
    e.preventDefault();
    setErr(null); setOut(null); setBusy(true);
    try{
      const sb=supabaseBrowser();
      const ses = await sb.auth.getSession();
      const token = ses.data.session?.access_token;
      if(!token){ setErr("No hay sesión. Inicia en /login"); return; }

      const f = fileRef.current?.files?.[0];
      if(!f){ setErr("Selecciona un archivo CSV"); return; }

      const fd = new FormData();
      fd.append("file", f);

      const res = await fetch(
        "https://lmdqwatifsrulwimhyce.functions.supabase.co/import_csv",
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd }
      );

      const text = await res.text();
      try { setOut(JSON.parse(text)); }
      catch { setOut({ raw:text }); if(!res.ok) setErr(`HTTP ${res.status}`); }
    } catch(e:any){
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-xl">
      <h1 className="text-xl font-bold">Importar CSV</h1>
      <form onSubmit={onUpload} className="space-y-3">
        <input ref={fileRef} name="file" type="file" accept=".csv,text/csv" className="border p-2 w-full"/>
        <button disabled={busy} className="border px-3 py-2">{busy?"Subiendo...":"Subir"}</button>
      </form>
      {err && <pre className="text-red-600">{err}</pre>}
      {out && <pre className="text-xs bg-black text-green-400 p-2 rounded">{JSON.stringify(out,null,2)}</pre>}
      <p className="text-sm opacity-70">Tip: si ves “Unauthorized”, entra primero en <a className="underline" href="/login">/login</a>.</p>
    </div>
  );
}

