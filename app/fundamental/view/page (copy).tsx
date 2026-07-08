import React, { Suspense } from "react";
import TopNav from "@/components/TopNav";
import FundamentalViewClient from "./FundamentalViewClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function FundamentalViewPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#000" }}>
      <TopNav />
      <main className="container" style={{ paddingTop: 24 }}>
        <Suspense
          fallback={
            <div
              style={{
                maxWidth: 900,
                margin: "0 auto",
                color: "#9ca3af",
                fontSize: 14,
              }}
            >
              Cargando artículo fundamental...
            </div>
          }
        >
          <FundamentalViewClient />
        </Suspense>
      </main>
    </div>
  );
}

