"use client";
import * as React from "react";
import { createClient } from "@supabase/supabase-js";

export default function Page(){
  const [out,setOut]=React.useState<any>({});
  React.useEffect(()=>{(async()=>{
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const ses = await sb.auth.getSession();
    const user = ses.data.session?.user ?? null;

    const { count, error: eCount } = await sb
      .from("trades")
      .select("*", { head: true, count: "exact" });

    const { data: sample, error: eSample } = await sb
      .from("trades")
      .select("id,ticket,symbol,dt_open_utc,pnl_usd_gross")
      .order("dt_open_utc", { ascending:false })
      .limit(5);

    setOut({
      env:{
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        anon:(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"").slice(0,8)+"..."
      },
      user,
      count_owned: eCount ? null : (count ?? null),
      select_ok: !eSample,
      select_err: eSample?.message ?? null,
      sample: sample ?? []
    });
  })();},[]);
  return <pre style={{padding:16,background:'#000',color:'#0f0',borderRadius:8}}>{JSON.stringify(out,null,2)}</pre>;
}

