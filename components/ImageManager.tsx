// ===================== [IM-1] components/ImageManager.tsx =====================
// Carrusel centrado fijo + títulos editables en thumbnails
//  - Modal SIEMPRE centrado (fixed + translate).
//  - Header y footer fijos en el modal.
//  - Cada thumbnail muestra: [IMG] -> [INPUT de nombre editable] -> [Botón Borrar].
//  - Guardado de nombre: Enter o blur. NEW=estado local; EDIT=UPDATE en DB.
// ==============================================================================

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ImgRow = {
  id?: number;
  title?: string | null;
  storage_path?: string | null;
  external_url?: string | null;
  sort_index?: number | null;
  signed?: string | null;
  blobUrl?: string; // preview local (NEW)
};

type Props = {
  tradeId: number | null;            // null = NEW (cola local)
  userId: string;
  readOnly?: boolean;
  onQueueChange?: (blobs: Blob[]) => void;
  onQueuedUrlsChange?: (urls: string[]) => void;
};

export default function ImageManager({
  tradeId,
  userId,
  readOnly = false,
  onQueueChange,
  onQueuedUrlsChange,
}: Props) {
  const [rows, setRows] = useState<ImgRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  // Carrusel
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIdx, setViewerIdx] = useState(0);

  // Control de título editable por índice (siempre visible)
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});

  // Colas (modo NEW)
  const [queue, setQueue] = useState<Blob[]>([]);
  const [queuedUrls, setQueuedUrls] = useState<string[]>([]);

  const fileRef = useRef<HTMLInputElement | null>(null);

  // ===================== [IM-2] Carga =====================
  const rebuildLocalRows = useCallback(() => {
    if (tradeId) return;
    const blobItems: ImgRow[] = queue.map((b) => ({
      blobUrl: URL.createObjectURL(b),
      title: "local",
    }));
    const urlItems: ImgRow[] = queuedUrls.map((u) => ({
      external_url: u,
      title: "url",
    }));
    const list = [...blobItems, ...urlItems];
    setRows(list);
    // precargar drafts
    const drafts: Record<string, string> = {};
    list.forEach((r, i) => {
      const key = draftKey(r, i);
      drafts[key] = r.title ?? (r.storage_path ? "archivo" : r.external_url ? "url" : "local");
    });
    setTitleDrafts(drafts);
  }, [queue, queuedUrls, tradeId]);

  const loadFromDb = useCallback(async () => {
    if (!tradeId) return;
    const { data, error } = await supabase
      .from("trade_images")
      .select("id,title,storage_path,external_url,sort_index")
      .eq("trade_id", tradeId)
      .order("sort_index", { ascending: true })
      .order("id", { ascending: true });
    if (error) {
      alert("Error cargando imágenes: " + error.message);
      return;
    }
    const list = (data || []) as ImgRow[];
    for (const r of list) {
      if (r.storage_path) {
        const su = await supabase.storage.from("journal").createSignedUrl(r.storage_path, 3600);
        r.signed = su.data?.signedUrl ?? null;
      }
    }
    setRows(list);
    // precargar drafts
    const drafts: Record<string, string> = {};
    list.forEach((r, i) => {
      const key = draftKey(r, i);
      drafts[key] = r.title ?? (r.storage_path ? "archivo" : r.external_url ? "url" : "local");
    });
    setTitleDrafts(drafts);
  }, [tradeId]);

  useEffect(() => {
    if (readOnly) {
      if (tradeId) loadFromDb();
      else setRows([]);
      return;
    }
    if (!tradeId) rebuildLocalRows();
    else loadFromDb();
  }, [readOnly, tradeId, rebuildLocalRows, loadFromDb]);

  useEffect(() => onQueueChange?.(queue), [queue, onQueueChange]);
  useEffect(() => onQueuedUrlsChange?.(queuedUrls), [queuedUrls, onQueuedUrlsChange]);

  // ===================== [IM-3] Inputs subir/pegar/url =====================
  function onChooseFiles() {
    if (readOnly) return;
    fileRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (readOnly) return;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      const blobs = await Promise.all(
        files.map(async (f) => new Blob([await f.arrayBuffer()], { type: f.type || "image/png" }))
      );
      await handleBlobs(blobs);
    } finally {
      e.target.value = "";
    }
  }

  async function handleBlobs(blobs: Blob[]) {
    if (!blobs.length) return;

    if (!tradeId) {
      setQueue((q) => [...q, ...blobs]);
      rebuildLocalRows();
      return;
    }

    setUploading(true);
    try {
      for (const blob of blobs) {
        const ext = (blob.type.split("/")[1] || "png").toLowerCase();
        const key = `u_${userId}/t_${tradeId}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("journal").upload(key, blob, {
          upsert: false,
          contentType: blob.type || "image/png",
        });
        if (up.error) throw up.error;

        const ins = await supabase.from("trade_images").insert({
          user_id: userId,
          trade_id: tradeId,
          title: "image",
          storage_path: key,
        });
        if (ins.error) throw ins.error;
      }
      await loadFromDb();
    } catch (e: any) {
      alert("No se pudo subir la imagen: " + (e?.message ?? e));
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    if (readOnly) return;

    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const blobs: Blob[] = [];
      for (const it of items) {
        if (it.kind === "file") {
          const f = it.getAsFile();
          if (f) blobs.push(f);
        }
      }
      if (blobs.length) {
        e.preventDefault();
        handleBlobs(blobs);
      }
    }

    function onDrop(e: DragEvent) {
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files || []);
      (async () => {
        const blobs = await Promise.all(
          files.map(async (f) => new Blob([await f.arrayBuffer()], { type: f.type || "image/png" }))
        );
        handleBlobs(blobs);
      })();
    }

    function noDefault(e: DragEvent) { e.preventDefault(); }

    window.addEventListener("paste", onPaste as any);
    window.addEventListener("dragover", noDefault as any);
    window.addEventListener("drop", onDrop as any);
    return () => {
      window.removeEventListener("paste", onPaste as any);
      window.removeEventListener("dragover", noDefault as any);
      window.removeEventListener("drop", onDrop as any);
    };
  }, [readOnly]);

  async function addByUrl() {
    if (readOnly) return;
    const src = urlInput.trim();
    if (!src) return;

    if (!tradeId) {
      setQueuedUrls((u) => [...u, src]);
      setUrlInput("");
      rebuildLocalRows();
      return;
    }

    try {
      const { error } = await supabase.from("trade_images").insert({
        user_id: userId,
        trade_id: tradeId,
        title: "url",
        external_url: src,
      });
      if (error) throw error;
      setUrlInput("");
      await loadFromDb();
    } catch (e: any) {
      alert("No se pudo añadir por URL: " + (e?.message ?? e));
    }
  }

  // ===================== [IM-4] Borrar/renombrar =====================
  async function remove(id?: number, src?: string) {
    if (readOnly) return;

    if (!tradeId) {
      if (src) {
        setQueuedUrls((prev) => prev.filter((u) => u !== src));
        setQueue((prev) => prev.filter((b) => `local://${b.size}_${b.type}` !== src));
        rebuildLocalRows();
      }
      return;
    }

    if (!id) return;
    if (!confirm("¿Borrar imagen?")) return;
    const { error } = await supabase.from("trade_images").delete().eq("id", id);
    if (error) return alert("No se pudo borrar: " + error.message);
    await loadFromDb();
  }

  function draftKey(r: ImgRow, i: number) {
    return `${r.id ?? "local"}_${i}`;
  }

  function onTitleChange(i: number, value: string) {
    const r = rows[i];
    const key = draftKey(r, i);
    setTitleDrafts((d) => ({ ...d, [key]: value }));
  }

  async function saveTitle(i: number) {
    const r = rows[i];
    const key = draftKey(r, i);
    const newTitle = (titleDrafts[key] ?? "").trim();

    // NEW: guardar en memoria
    if (!tradeId) {
      setRows((list) => {
        const copy = [...list];
        if (copy[i]) copy[i].title = newTitle || null;
        return copy;
      });
      return;
    }

    // EDIT: persistir en DB
    if (!r?.id) return;
    const { error } = await supabase
      .from("trade_images")
      .update({ title: newTitle || null })
      .eq("id", r.id);
    if (error) {
      alert("No se pudo renombrar: " + error.message);
      return;
    }
    await loadFromDb();
  }

  // ===================== [IM-5] Carrusel =====================
  function openViewer(i: number) {
    setViewerIdx(i);
    setViewerOpen(true);
    document.body.style.overflow = "hidden";
  }
  function closeViewer() {
    setViewerOpen(false);
    document.body.style.overflow = "";
  }
  function prev() {
    setViewerIdx((i) => (i - 1 + rows.length) % rows.length);
  }
  function next() {
    setViewerIdx((i) => (i + 1) % rows.length);
  }

  useEffect(() => {
    if (!viewerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeViewer();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerOpen]);

  // ===================== [IM-6] Render =====================
  return (
    <div>
      {!readOnly && (
        <div className="grid-3" style={{ gap: 8 }}>
          <div className="field">
            <label className="label">Subir</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn" onClick={onChooseFiles} disabled={uploading}>
                {uploading ? "Subiendo..." : "Elegir archivos"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={onFileChange}
              />
            </div>
            <div className="hint">También puedes pegar (Ctrl+V) o arrastrar/soltar en la ventana.</div>
          </div>

          <div className="field">
            <label className="label">Añadir por URL</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                placeholder="https://..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
              <button type="button" className="btn" onClick={addByUrl}>
                Añadir
              </button>
            </div>
          </div>

          <div className="field" />
        </div>
      )}

      {/* Grid de thumbnails */}
      <div className="img-grid" style={{ marginTop: 12 }}>
        {rows.length === 0 ? (
          <div className="hint">Sin imágenes.</div>
        ) : (
          rows.map((r, i) => {
            const src = r.signed ?? r.external_url ?? r.blobUrl ?? "";
            const key = draftKey(r, i);
            const currentDraft = titleDrafts[key] ?? (r.title ?? (r.storage_path ? "archivo" : r.external_url ? "url" : "local"));
            return (
              <div className="img-card" key={r.id ?? `${src}-${i}`}>
                <img
                  src={src}
                  alt={r.title ?? ""}
                  onClick={() => openViewer(i)}
                  style={{ cursor: "pointer" }}
                />
                {!readOnly && (
                  <div className="img-meta" style={{ display: "grid", gap: 6 }}>
                    {/* Input SIEMPRE visible debajo de la foto */}
                    <input
                      className="input"
                      value={currentDraft}
                      onChange={(e) => onTitleChange(i, e.target.value)}
                      onBlur={() => saveTitle(i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur(); // dispara onBlur -> guardar
                        }
                      }}
                      placeholder="Nombre de la imagen"
                    />
                    {/* Botón Borrar debajo del input (pegadito) */}
                    <button
                      className="btn danger"
                      onClick={() => (tradeId ? remove(r.id) : remove(undefined, r.external_url ?? r.blobUrl))}
                    >
                      Borrar
                    </button>
                  </div>
                )}
                {readOnly && (
                  <div className="img-meta">
                    <span>{r.title ?? (r.storage_path ? "archivo" : r.external_url ? "url" : "local")}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ===================== POPUP CENTRADO FIJO ===================== */}
      {viewerOpen && rows.length > 0 && (
        <>
          {/* Backdrop */}
          <div
            onClick={closeViewer}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              zIndex: 1000,
            }}
          />
          {/* Contenedor del modal: 100% centrado SIEMPRE */}
          <div
            onClick={closeViewer}
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(1000px, 92vw)",
              height: "min(90vh, 820px)",
              zIndex: 1001,
            }}
          >
            <div
              className="modal"
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "var(--card-bg, #111)",
                borderRadius: 12,
                boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* HEADER FIJO */}
              <div
                className="modal-head"
                style={{
                  flex: "0 0 56px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "10px 12px",
                  background: "var(--card-bg, #111)",
                  borderBottom: "1px solid rgba(255,255,255,0.12)",
                }}
              >
              
              
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button className="btn" onClick={prev} aria-label="Anterior">←</button>
                  
                </div>
                
                
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button className="btn" onClick={next} aria-label="Siguiente">→</button>
                  <button className="btn" onClick={closeViewer} aria-label="Cerrar">Cerrar</button>
                </div>
              </div>

              {/* BODY (scrollea solo la imagen) */}
              <div
                className="modal-body"
                style={{
                  flex: "1 1 auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "auto",
                  padding: 10,
                }}
              >
                <img
                  src={rows[viewerIdx].signed ?? rows[viewerIdx].external_url ?? rows[viewerIdx].blobUrl ?? ""}
                  alt=""
                  style={{
                    maxWidth: "calc(100% - 20px)",
                    maxHeight: "calc(100% - 20px)",
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              </div>

              {/* NOMBRE DE LA IMG */}
                   <div className="modal-title" style={{ opacity: 0.85 }}>
                      {rows[viewerIdx].title ?? "imagen"}
                  </div>
              {/* FOOTER FIJO (contador) */}
              
              <div
                className="modal-foot"
                style={{
                  flex: "0 0 42px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "8px 12px",
                  borderTop: "1px solid rgba(255,255,255,0.12)",
                  background: "var(--card-bg, #111)",
                  fontSize: 14,
                  opacity: 0.85,
                }}
              >
                               
                {`${viewerIdx + 1} / ${rows.length}`}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

