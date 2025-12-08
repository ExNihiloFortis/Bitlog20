// app/api/fundamental/article/route.ts

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

export const runtime = "nodejs";

function decodeEntities(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(html: string): string {
  const decoded = decodeEntities(html);
  return decoded
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBetween(html: string, re: RegExp): string | null {
  const m = html.match(re);
  if (m && m[1]) return m[1].trim();
  return null;
}

// Sigue redirecciones y resuelve Google News -> medio real
async function resolveFinalUrl(
  initialUrl: string
): Promise<{ finalUrl: string; html: string }> {
  const res = await fetch(initialUrl, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(
      "Error al descargar página inicial:",
      res.status,
      txt.slice(0, 200)
    );
    throw new Error(`No se pudo descargar la página inicial (${res.status}).`);
  }

  const html = await res.text();
  let finalUrl = res.url;

  let host = "";
  try {
    host = new URL(finalUrl).hostname.replace(/^www\./, "");
  } catch {
    host = "";
  }

  // Si ya no es Google News, listo
  if (host !== "news.google.com") {
    return { finalUrl, html };
  }

  // Intentar sacar og:url
  const ogUrl =
    extractBetween(
      html,
      /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i
    ) ||
    extractBetween(
      html,
      /<meta[^>]+name=["']og:url["'][^>]+content=["']([^"']+)["']/i
    );

  let candidate = ogUrl || null;

  // Si og:url sigue siendo news.google.com, buscamos primer <a> externo
  if (!candidate || candidate.includes("news.google.com")) {
    const linkRe = /<a[^>]+href="(https?:\/\/[^">]+)"/gi;
    let match: RegExpExecArray | null;
    while ((match = linkRe.exec(html)) !== null) {
      const href = match[1];
      try {
        const u = new URL(href);
        const h = u.hostname.replace(/^www\./, "");
        if (h !== "news.google.com") {
          candidate = href;
          break;
        }
      } catch {
        continue;
      }
    }
  }

  if (!candidate) {
    // Nos quedamos con la página de Google News (no ideal, pero mejor que nada)
    return { finalUrl, html };
  }

  const res2 = await fetch(candidate, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
  });

  if (!res2.ok) {
    const txt = await res2.text();
    console.error(
      "Error al descargar artículo final:",
      res2.status,
      txt.slice(0, 200)
    );
    throw new Error(
      `No se pudo descargar el artículo final (${res2.status}).`
    );
  }

  const html2 = await res2.text();
  finalUrl = res2.url;

  return { finalUrl, html: html2 };
}

// Intenta extraer el cuerpo según el host
function extractBodyByHost(host: string, html: string): string {
  host = host.toLowerCase();

  // Yahoo Finance
  if (host.includes("yahoo.com")) {
    const m =
      html.match(
        /<div[^>]+class="[^"]*caas-body[^"]*"[^>]*>[\s\S]*?<\/div>/i
      ) ||
      html.match(/<article[\s\S]*?<\/article>/i);
    if (m && m[0]) return m[0];
  }

  // MarketWatch
  if (host.includes("marketwatch.com")) {
    const m =
      html.match(
        /<div[^>]+class="[^"]*article__body[^"]*"[^>]*>[\s\S]*?<\/div>/i
      ) ||
      html.match(/<article[\s\S]*?<\/article>/i);
    if (m && m[0]) return m[0];
  }

  // MSN
  if (host.includes("msn.com")) {
    const m =
      html.match(/<article[\s\S]*?<\/article>/i) ||
      html.match(
        /<section[^>]+id="article-body"[^>]*>[\s\S]*?<\/section>/i
      );
    if (m && m[0]) return m[0];
  }

  // CNBC
  if (host.includes("cnbc.com")) {
    const m =
      html.match(
        /<div[^>]+class="[^"]*ArticleBody-articleBody[^"]*"[^>]*>[\s\S]*?<\/div>/i
      ) ||
      html.match(/<article[\s\S]*?<\/article>/i);
    if (m && m[0]) return m[0];
  }

  // Investors.com
  if (host.includes("investors.com")) {
    const m =
      html.match(
        /<div[^>]+class="[^"]*single-article__body[^"]*"[^>]*>[\s\S]*?<\/div>/i
      ) ||
      html.match(/<article[\s\S]*?<\/article>/i);
    if (m && m[0]) return m[0];
  }

  // Genérico: primer <article>
  const art = html.match(/<article[\s\S]*?<\/article>/i);
  if (art && art[0]) return art[0];

  // Fallback: <body>
  const body = html.match(/<body[\s\S]*?<\/body>/i);
  if (body && body[0]) return body[0];

  return html;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawUrl = searchParams.get("url");

    if (!rawUrl) {
      return NextResponse.json(
        { error: "Falta parámetro 'url'." },
        { status: 400 }
      );
    }

    const decodedUrl = decodeURIComponent(rawUrl);

    // 1) Resolver URL final
    const { finalUrl, html } = await resolveFinalUrl(decodedUrl);

    let host = "";
    try {
      host = new URL(finalUrl).hostname.replace(/^www\./, "");
    } catch {
      host = "";
    }

    // 2) Título
    let title =
      extractBetween(
        html,
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
      ) ||
      extractBetween(
        html,
        /<meta[^>]+name=["']og:title["'][^>]+content=["']([^"']+)["']/i
      ) ||
      extractBetween(
        html,
        /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i
      );

    if (!title) {
      const tMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (tMatch && tMatch[1]) {
        title = stripHtml(tMatch[1]);
      }
    }
    if (!title) title = "Article";

    // 3) Imagen principal
    let imageUrl =
      extractBetween(
        html,
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
      ) ||
      extractBetween(
        html,
        /<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i
      ) ||
      extractBetween(
        html,
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i
      );
    if (imageUrl) imageUrl = imageUrl.trim();

    // 4) Fecha
    let publishedAt =
      extractBetween(
        html,
        /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i
      ) ||
      extractBetween(
        html,
        /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i
      ) ||
      extractBetween(
        html,
        /<meta[^>]+name=["']DC.date.issued["'][^>]+content=["']([^"']+)["']/i
      );
    if (publishedAt) publishedAt = publishedAt.trim();

    // 5) Cuerpo principal
    const bodyHtml = extractBodyByHost(host, html);

    // 6) Párrafos
    const rawParts = bodyHtml.split(/<\/p>/i);
    const paragraphs: string[] = [];

    for (const part of rawParts) {
      const pm = part.match(/<p[^>]*>([\s\S]*)$/i);
      if (!pm || !pm[1]) continue;
      const text = stripHtml(pm[1]);
      if (text && text.length > 60) {
        paragraphs.push(text);
      }
      if (paragraphs.length >= 40) break;
    }

    if (paragraphs.length === 0) {
      const fullText = stripHtml(bodyHtml);
      const slice = fullText.slice(0, 6000);
      const chunks = slice.split(/(?<=[.!?])\s+/);
      for (const ch of chunks) {
        const t = ch.trim();
        if (t.length > 40) paragraphs.push(t);
        if (paragraphs.length >= 40) break;
      }
    }

    const article = {
      title,
      imageUrl: imageUrl || null,
      publishedAt: publishedAt || null,
      sourceHost: host || null,
      paragraphs,
    };

    return NextResponse.json({ article });
  } catch (err: any) {
    console.error("Error en /api/fundamental/article:", err);
    return NextResponse.json(
      { error: "Error interno al limpiar el artículo." },
      { status: 500 }
    );
  }
}

