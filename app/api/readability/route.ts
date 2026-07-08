// app/api/readability/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ReaderPayload = {
  ok: boolean;
  title?: string;
  byline?: string | null;
  siteName?: string | null;
  excerpt?: string | null;
  content?: string;
  textContent?: string;
  length?: number;
  url?: string;
  error?: string;
};

const MAX_HTML_BYTES = 5_000_000;
const TIMEOUT_MS = 12_000;

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeReaderHtml(html: string, baseUrl: string) {
  const dom = new JSDOM(`<main>${html}</main>`, { url: baseUrl });
  const doc = dom.window.document;

  doc.querySelectorAll("script, style, iframe, form, input, button, noscript, svg").forEach((el) => el.remove());

  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value || "";

      if (name.startsWith("on")) el.removeAttribute(attr.name);
      if (name === "style") el.removeAttribute(attr.name);
      if ((name === "href" || name === "src") && value.trim().toLowerCase().startsWith("javascript:")) {
        el.removeAttribute(attr.name);
      }
    }
  });

  doc.querySelectorAll("a[href]").forEach((a) => {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noreferrer");
  });

  return doc.querySelector("main")?.innerHTML || "";
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")?.trim() || "";

  if (!url || !isValidHttpUrl(url)) {
    return NextResponse.json<ReaderPayload>(
      { ok: false, error: "URL inválida o vacía." },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 BitlogReader/1.0",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    if (!res.ok) {
      return NextResponse.json<ReaderPayload>(
        { ok: false, url, error: `El sitio respondió con HTTP ${res.status}.` },
        { status: 502 }
      );
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return NextResponse.json<ReaderPayload>(
        { ok: false, url, error: "El recurso no parece ser una página HTML." },
        { status: 415 }
      );
    }

    const rawHtml = await res.text();
    const html = rawHtml.slice(0, MAX_HTML_BYTES);
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article?.textContent?.trim()) {
      return NextResponse.json<ReaderPayload>(
        { ok: false, url, error: "No se pudo extraer el modo lectura de este sitio." },
        { status: 422 }
      );
    }

    const cleanContent = sanitizeReaderHtml(article.content || "", url);

    return NextResponse.json<ReaderPayload>({
      ok: true,
      url,
      title: article.title || undefined,
      byline: article.byline || null,
      siteName: article.siteName || null,
      excerpt: article.excerpt || null,
      content: cleanContent,
      textContent: article.textContent || "",
      length: article.length || article.textContent.length,
    });
  } catch (err: any) {
    const message = err?.name === "AbortError" ? "Tiempo de espera agotado al descargar el artículo." : "No se pudo descargar o procesar el artículo.";
    return NextResponse.json<ReaderPayload>({ ok: false, url, error: message }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}
