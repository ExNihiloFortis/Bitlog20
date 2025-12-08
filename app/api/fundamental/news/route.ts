// app/api/fundamental/news/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;


import { NextResponse } from "next/server";

// Usamos runtime Node para poder hacer fetch sin restricciones extrañas
export const runtime = "nodejs";

// Helper para extraer el contenido de una etiqueta XML simple: <tag>...</tag>
function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(re);
  if (!match) return null;
  let value = match[1].trim();
  // Quitar CDATA
  value = value.replace("<![CDATA[", "").replace("]]>", "").trim();
  return value || null;
}

// Decodificar entidades HTML básicas (&lt; &gt; &amp; &quot; &#39; etc.)
function decodeEntities(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// Quitar etiquetas HTML después de decodificar
function stripHtml(html: string): string {
  const decoded = decodeEntities(html);
  return decoded
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}




export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawQuery = (searchParams.get("q") || "").trim();

    // Si no hay query, usamos algo general de mercados
    const baseQuery = rawQuery || "stock market finance";

    // Google News RSS: "when:1d" = últimas 24h
    const fullQuery = `${baseQuery} when:1d`;
    const qParam = encodeURIComponent(fullQuery);

    const rssUrl = `https://news.google.com/rss/search?q=${qParam}&hl=en-US&gl=US&ceid=US:en`;

    const res = await fetch(rssUrl, { method: "GET" });

    if (!res.ok) {
      const txt = await res.text();
      console.error("Google News RSS error:", res.status, txt.slice(0, 300));
      return NextResponse.json(
        {
          error: `Error al consultar Google News RSS (${res.status}).`,
        },
        { status: 500 }
      );
    }

    const xml = await res.text();

    // Partimos por <item> (cada noticia)
    const parts = xml.split("<item>").slice(1); // el [0] es header del RSS

    const articles = parts.map((block) => {
      const title = extractTag(block, "title") ?? "Sin título";
      let link = extractTag(block, "link") ?? "";
      link = link.trim();

      const pubDate = extractTag(block, "pubDate") ?? undefined;
      const source = extractTag(block, "source") ?? "Google News";

      const rawDescription = extractTag(block, "description") ?? "";

      // 1) Intentar primero <media:content url="...">
      let imageUrl: string | null = null;
      const mediaMatch = block.match(
        /<media:content[^>]+url="([^">]+)"/i
      );
      if (mediaMatch && mediaMatch[1]) {
        imageUrl = mediaMatch[1];
      } else {
        // 2) Si no hay <media:content>, intentamos buscar <img src="...">
        //    pero primero decodificamos entidades (&lt;img ...&gt;)
        const decoded = decodeEntities(rawDescription);
        const imgMatch = decoded.match(/<img[^>]+src="([^">]+)"/i);
        if (imgMatch && imgMatch[1]) {
          imageUrl = imgMatch[1];
        }
      }

      // Descripción limpia (texto plano)
      const description = stripHtml(rawDescription);

      return {
        title: stripHtml(title), // por si también trae HTML/entidades
        url: link,
        source,
        publishedAt: pubDate,
        description,
        imageUrl,
      };
    });

    return NextResponse.json({ articles });
  } catch (err: any) {
    console.error("Error en /api/fundamental/news (Google News):", err);
    return NextResponse.json(
      { error: "Error interno al buscar noticias." },
      { status: 500 }
    );
  }
}

