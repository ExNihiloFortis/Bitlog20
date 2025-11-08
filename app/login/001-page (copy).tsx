// [BLOQUE 1] Login simple (client)
"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";

export default function Page() {
  const [email,setEmail]=useState(""); const [pass,setPass]=useState("");
  const [err,setErr]=useState<string|null>(null); const r=useRouter();
  const onSubmit=async(e:React.FormEvent)=>{e.preventDefault(); setErr(null);
    const sb=supabaseBrowser();
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) { setErr(error.message); return; }
    r.push("/import");
  };
  return (
    <div className="p-6 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">Login</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="border w-full p-2" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="border w-full p-2" type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} />
        <button className="border px-3 py-2">Entrar</button>
        {err && <p className="text-red-600 text-sm">{err}</p>}
      </form>
    </div>
  );
}

