"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TopNav from "@/components/TopNav";
import { supabase } from "@/lib/supabaseClient";

type SourceFilter = "REAL_TRADE" | "FAKE_TRADE" | "STUDY_CASE";
type HistoricalSource = "REAL_TRADE" | "FAKE_TRADE";
type PatternOutcome = "PENDING" | "MATCHED" | "FAILED";

type GalleryImage = {
  key: string;
  id: number;
  src: string;
  title: string | null;
  timeframe: string | null;
  note: string | null;
  notePriority: number;
  sortIndex: number;
  sourceKind: "HISTORICAL" | "STUDY_DIRECT";
  sourceType?: HistoricalSource;
  sourceImageId?: number;
  studyCaseImageId?: number;
};

type GalleryGroup = {
  key: string;
  type: SourceFilter;
  id: number;
  ticket?: string | null;
  symbol?: string | null;
  pattern: string | null;
  patternOutcome: PatternOutcome;
  notes?: string | null;
  sourceOriginType?: string | null;
  sourceOriginId?: number | null;
  images: GalleryImage[];
};

type HistoricalImageMeta = {
  timeframe: string | null;
  note: string | null;
  notePriority: number;
};

type PendingStudyImage = {
  localId: string;
  kind: "UPLOAD" | "URL";
  blob?: Blob;
  url?: string;
  preview: string;
  timeframe: string;
};

const TF_ORDER = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MNT1"] as const;
const TF_RANK: Record<string, number> = Object.fromEntries(TF_ORDER.map((tf, i) => [tf, (i + 1) * 10]));

function sortImages(images: GalleryImage[]) {
  return [...images].sort((a, b) => {
    const ra = a.timeframe ? (TF_RANK[a.timeframe] ?? 900) : 999;
    const rb = b.timeframe ? (TF_RANK[b.timeframe] ?? 900) : 999;
    if (ra !== rb) return ra - rb;
    if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
    return a.id - b.id;
  });
}

async function signedUrl(storagePath: string | null | undefined): Promise<string> {
  if (!storagePath) return "";
  const { data } = await supabase.storage.from("journal").createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? "";
}

export default function GalleryPage() {
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [patternFilter, setPatternFilter] = useState("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState<"ALL" | PatternOutcome>("ALL");
  const [sources, setSources] = useState<Record<SourceFilter, boolean>>({
    REAL_TRADE: true,
    FAKE_TRADE: false,
    STUDY_CASE: false,
  });
  const [groups, setGroups] = useState<GalleryGroup[]>([]);

  // Viewer
  const [viewerGroupKey, setViewerGroupKey] = useState<string | null>(null);
  const [viewerIdx, setViewerIdx] = useState(0);
  const [zoom, setZoom] = useState(1);

  // Nuevo caso de estudio
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [newCasePattern, setNewCasePattern] = useState("");
  const [newCaseNotes, setNewCaseNotes] = useState("");
  const [newCaseUrl, setNewCaseUrl] = useState("");
  const [newCaseImages, setNewCaseImages] = useState<PendingStudyImage[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [noteTarget, setNoteTarget] = useState<{ group: GalleryGroup; image: GalleryImage } | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [notePriority, setNotePriority] = useState(0);
  const [notesGroup, setNotesGroup] = useState<GalleryGroup | null>(null);

  const [manageCase, setManageCase] = useState<GalleryGroup | null>(null);
  const [manageCaseUrl, setManageCaseUrl] = useState("");
  const [manageCaseImages, setManageCaseImages] = useState<PendingStudyImage[]>([]);
  const manageFileRef = useRef<HTMLInputElement | null>(null);

  const enabledSources = useMemo(
    () => (Object.keys(sources) as SourceFilter[]).filter((k) => sources[k]),
    [sources]
  );

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? "";
      if (!uid) {
        window.location.href = "/login";
        return;
      }
      setUserId(uid);

      const { data: patData } = await supabase
        .from("catalog_items")
        .select("value")
        .eq("type", "pattern")
        .order("value", { ascending: true });
      setPatterns((patData || []).map((r: any) => String(r.value)).filter(Boolean));
      setLoading(false);
    })();
  }, []);

  const loadGallery = useCallback(async () => {
    if (!userId || enabledSources.length === 0) {
      setGroups([]);
      return;
    }

    setLoading(true);
    try {
      const nextGroups: GalleryGroup[] = [];

      const { data: metaRows, error: metaError } = await supabase
        .from("gallery_image_metadata")
        .select("source_type,source_image_id,timeframe,note,note_priority")
        .eq("user_id", userId);
      if (metaError) throw metaError;

      const meta = new Map<string, HistoricalImageMeta>();
      for (const m of metaRows || []) {
        meta.set(`${m.source_type}:${m.source_image_id}`, {
          timeframe: m.timeframe ?? null,
          note: m.note ?? null,
          notePriority: Number(m.note_priority ?? 0),
        });
      }

      const { data: groupMetaRows, error: groupMetaError } = await supabase
        .from("gallery_group_metadata")
        .select("source_type,source_id,pattern_outcome")
        .eq("user_id", userId);
      if (groupMetaError) throw groupMetaError;

      const groupMeta = new Map<string, PatternOutcome>();
      for (const m of groupMetaRows || []) {
        groupMeta.set(`${m.source_type}:${m.source_id}`, (m.pattern_outcome ?? "PENDING") as PatternOutcome);
      }

      // ---------------- REAL TRADES ----------------
      if (sources.REAL_TRADE) {
        let q = supabase
          .from("trades")
          .select("id,ticket,symbol,patron")
          .eq("user_id", userId)
          .order("id", { ascending: false });
        if (patternFilter !== "ALL") q = q.eq("patron", patternFilter);
        const { data: trades, error } = await q;
        if (error) throw error;

        const ids = (trades || []).map((t: any) => Number(t.id));
        if (ids.length) {
          const { data: imgs, error: imgError } = await supabase
            .from("trade_images")
            .select("id,trade_id,title,storage_path,external_url,sort_index")
            .eq("user_id", userId)
            .in("trade_id", ids)
            .order("sort_index", { ascending: true })
            .order("id", { ascending: true });
          if (imgError) throw imgError;

          const byTrade = new Map<number, any[]>();
          for (const im of imgs || []) {
            const tid = Number(im.trade_id);
            if (!byTrade.has(tid)) byTrade.set(tid, []);
            byTrade.get(tid)!.push(im);
          }

          for (const t of trades || []) {
            const raw = byTrade.get(Number(t.id)) || [];
            if (!raw.length) continue;
            const resolved: GalleryImage[] = [];
            for (const im of raw) {
              const src = im.external_url || (await signedUrl(im.storage_path));
              if (!src) continue;
              resolved.push({
                key: `REAL_TRADE:${im.id}`,
                id: Number(im.id),
                src,
                title: im.title ?? null,
                timeframe: meta.get(`REAL_TRADE:${im.id}`)?.timeframe ?? null,
                note: meta.get(`REAL_TRADE:${im.id}`)?.note ?? null,
                notePriority: meta.get(`REAL_TRADE:${im.id}`)?.notePriority ?? 0,
                sortIndex: Number(im.sort_index ?? 0),
                sourceKind: "HISTORICAL",
                sourceType: "REAL_TRADE",
                sourceImageId: Number(im.id),
              });
            }
            if (resolved.length) {
              nextGroups.push({
                key: `REAL_TRADE:${t.id}`,
                type: "REAL_TRADE",
                id: Number(t.id),
                ticket: t.ticket ?? null,
                symbol: t.symbol ?? null,
                pattern: t.patron ?? null,
                patternOutcome: groupMeta.get(`REAL_TRADE:${t.id}`) ?? "PENDING",
                images: sortImages(resolved),
              });
            }
          }
        }
      }

      // ---------------- FAKE TRADES ----------------
      if (sources.FAKE_TRADE) {
        let q = supabase
          .from("fake_trades")
          .select("id,symbol,pattern_name")
          .eq("user_id", userId)
          .order("id", { ascending: false });
        if (patternFilter !== "ALL") q = q.eq("pattern_name", patternFilter);
        const { data: fakeTrades, error } = await q;
        if (error) throw error;

        const ids = (fakeTrades || []).map((t: any) => Number(t.id));
        if (ids.length) {
          const { data: imgs, error: imgError } = await supabase
            .from("fake_trade_images")
            .select("id,fake_trade_id,title,storage_path,external_url,sort_index")
            .eq("user_id", userId)
            .in("fake_trade_id", ids)
            .order("sort_index", { ascending: true })
            .order("id", { ascending: true });
          if (imgError) throw imgError;

          const byTrade = new Map<number, any[]>();
          for (const im of imgs || []) {
            const tid = Number(im.fake_trade_id);
            if (!byTrade.has(tid)) byTrade.set(tid, []);
            byTrade.get(tid)!.push(im);
          }

          for (const t of fakeTrades || []) {
            const raw = byTrade.get(Number(t.id)) || [];
            if (!raw.length) continue;
            const resolved: GalleryImage[] = [];
            for (const im of raw) {
              const src = im.external_url || (await signedUrl(im.storage_path));
              if (!src) continue;
              resolved.push({
                key: `FAKE_TRADE:${im.id}`,
                id: Number(im.id),
                src,
                title: im.title ?? null,
                timeframe: meta.get(`FAKE_TRADE:${im.id}`)?.timeframe ?? null,
                note: meta.get(`FAKE_TRADE:${im.id}`)?.note ?? null,
                notePriority: meta.get(`FAKE_TRADE:${im.id}`)?.notePriority ?? 0,
                sortIndex: Number(im.sort_index ?? 0),
                sourceKind: "HISTORICAL",
                sourceType: "FAKE_TRADE",
                sourceImageId: Number(im.id),
              });
            }
            if (resolved.length) {
              nextGroups.push({
                key: `FAKE_TRADE:${t.id}`,
                type: "FAKE_TRADE",
                id: Number(t.id),
                symbol: t.symbol ?? null,
                pattern: t.pattern_name ?? null,
                patternOutcome: groupMeta.get(`FAKE_TRADE:${t.id}`) ?? "PENDING",
                images: sortImages(resolved),
              });
            }
          }
        }
      }

      // ---------------- STUDY CASES ----------------
      if (sources.STUDY_CASE) {
        let q = supabase
          .from("study_cases")
          .select("id,pattern_name,notes,source_origin_type,source_origin_id")
          .eq("user_id", userId)
          .order("id", { ascending: false });
        if (patternFilter !== "ALL") q = q.eq("pattern_name", patternFilter);
        const { data: cases, error } = await q;
        if (error) throw error;

        const caseIds = (cases || []).map((c: any) => Number(c.id));
        if (caseIds.length) {
          const { data: caseImgs, error: ciError } = await supabase
            .from("study_case_images")
            .select("id,study_case_id,source_kind,source_type,source_image_id,title,storage_path,external_url,timeframe,note,note_priority,sort_index")
            .eq("user_id", userId)
            .in("study_case_id", caseIds)
            .order("sort_index", { ascending: true })
            .order("id", { ascending: true });
          if (ciError) throw ciError;

          const realRefIds = (caseImgs || [])
            .filter((x: any) => x.source_kind === "SOURCE_REF" && x.source_type === "REAL_TRADE")
            .map((x: any) => Number(x.source_image_id));
          const fakeRefIds = (caseImgs || [])
            .filter((x: any) => x.source_kind === "SOURCE_REF" && x.source_type === "FAKE_TRADE")
            .map((x: any) => Number(x.source_image_id));

          const realMap = new Map<number, any>();
          const fakeMap = new Map<number, any>();

          if (realRefIds.length) {
            const { data } = await supabase
              .from("trade_images")
              .select("id,title,storage_path,external_url,sort_index")
              .eq("user_id", userId)
              .in("id", realRefIds);
            for (const r of data || []) realMap.set(Number(r.id), r);
          }
          if (fakeRefIds.length) {
            const { data } = await supabase
              .from("fake_trade_images")
              .select("id,title,storage_path,external_url,sort_index")
              .eq("user_id", userId)
              .in("id", fakeRefIds);
            for (const r of data || []) fakeMap.set(Number(r.id), r);
          }

          const byCase = new Map<number, any[]>();
          for (const im of caseImgs || []) {
            const cid = Number(im.study_case_id);
            if (!byCase.has(cid)) byCase.set(cid, []);
            byCase.get(cid)!.push(im);
          }

          for (const c of cases || []) {
            const raw = byCase.get(Number(c.id)) || [];
            const resolved: GalleryImage[] = [];

            for (const im of raw) {
              if (im.source_kind === "SOURCE_REF") {
                const st = im.source_type as HistoricalSource;
                const srcId = Number(im.source_image_id);
                const original = st === "REAL_TRADE" ? realMap.get(srcId) : fakeMap.get(srcId);
                if (!original) continue;
                const src = original.external_url || (await signedUrl(original.storage_path));
                if (!src) continue;
                resolved.push({
                  key: `SC:${im.id}:${st}:${srcId}`,
                  id: Number(im.id),
                  src,
                  title: original.title ?? im.title ?? null,
                  timeframe: meta.get(`${st}:${srcId}`)?.timeframe ?? null,
                  note: meta.get(`${st}:${srcId}`)?.note ?? null,
                  notePriority: meta.get(`${st}:${srcId}`)?.notePriority ?? 0,
                  sortIndex: Number(im.sort_index ?? original.sort_index ?? 0),
                  sourceKind: "HISTORICAL",
                  sourceType: st,
                  sourceImageId: srcId,
                  studyCaseImageId: Number(im.id),
                });
              } else {
                const src = im.external_url || (await signedUrl(im.storage_path));
                if (!src) continue;
                resolved.push({
                  key: `SC:${im.id}`,
                  id: Number(im.id),
                  src,
                  title: im.title ?? null,
                  timeframe: im.timeframe ?? null,
                  note: im.note ?? null,
                  notePriority: Number(im.note_priority ?? 0),
                  sortIndex: Number(im.sort_index ?? 0),
                  sourceKind: "STUDY_DIRECT",
                  studyCaseImageId: Number(im.id),
                });
              }
            }

            if (resolved.length) {
              nextGroups.push({
                key: `STUDY_CASE:${c.id}`,
                type: "STUDY_CASE",
                id: Number(c.id),
                pattern: c.pattern_name ?? null,
                patternOutcome: groupMeta.get(`STUDY_CASE:${c.id}`) ?? "PENDING",
                notes: c.notes ?? null,
                sourceOriginType: c.source_origin_type ?? null,
                sourceOriginId: c.source_origin_id ? Number(c.source_origin_id) : null,
                images: sortImages(resolved),
              });
            }
          }
        }
      }

      setGroups(outcomeFilter === "ALL" ? nextGroups : nextGroups.filter((g) => g.patternOutcome === outcomeFilter));
    } catch (e: any) {
      console.error(e);
      alert("Error cargando Gallery: " + (e?.message ?? String(e)));
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [userId, enabledSources.length, patternFilter, outcomeFilter, sources.REAL_TRADE, sources.FAKE_TRADE, sources.STUDY_CASE]);

  useEffect(() => {
    if (userId) loadGallery();
  }, [userId, loadGallery]);

  async function savePatternOutcome(group: GalleryGroup, patternOutcome: PatternOutcome) {
    try {
      const { error } = await supabase.from("gallery_group_metadata").upsert(
        {
          user_id: userId,
          source_type: group.type,
          source_id: group.id,
          pattern_outcome: patternOutcome,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,source_type,source_id" }
      );
      if (error) throw error;
      setGroups((current) => current.map((g) => g.key === group.key ? { ...g, patternOutcome } : g));
    } catch (e: any) {
      alert("No se pudo guardar el resultado del patrón: " + (e?.message ?? String(e)));
    }
  }

  async function saveImageTimeframe(image: GalleryImage, timeframe: string) {
    const tf = timeframe || null;
    try {
      if (image.sourceKind === "HISTORICAL") {
        if (!image.sourceType || !image.sourceImageId) return;
        const { error } = await supabase.from("gallery_image_metadata").upsert(
          {
            user_id: userId,
            source_type: image.sourceType,
            source_image_id: image.sourceImageId,
            timeframe: tf,
          },
          { onConflict: "user_id,source_type,source_image_id" }
        );
        if (error) throw error;
      } else {
        if (!image.studyCaseImageId) return;
        const { error } = await supabase
          .from("study_case_images")
          .update({ timeframe: tf })
          .eq("id", image.studyCaseImageId)
          .eq("user_id", userId);
        if (error) throw error;
      }
      await loadGallery();
    } catch (e: any) {
      alert("No se pudo guardar el timeframe: " + (e?.message ?? String(e)));
    }
  }

  async function convertToStudyCase(group: GalleryGroup) {
    if (group.type !== "REAL_TRADE" && group.type !== "FAKE_TRADE") return;
    if (!confirm(`¿Convertir este ${group.type === "REAL_TRADE" ? "Real Trade" : "Fake Trade"} en Caso de Estudio?`)) return;

    setWorking(true);
    try {
      const originType = group.type;
      const { data: existing } = await supabase
        .from("study_cases")
        .select("id")
        .eq("user_id", userId)
        .eq("source_origin_type", originType)
        .eq("source_origin_id", group.id)
        .maybeSingle();

      if (existing?.id) {
        alert(`Este trade ya fue convertido al Caso de Estudio #${existing.id}.`);
        setSources((s) => ({ ...s, STUDY_CASE: true }));
        return;
      }

      const { data: sc, error: scError } = await supabase
        .from("study_cases")
        .insert({
          user_id: userId,
          pattern_name: group.pattern,
          notes: "",
          source_origin_type: originType,
          source_origin_id: group.id,
        })
        .select("id")
        .single();
      if (scError) throw scError;

      const caseId = Number(sc.id);
      const rows = group.images.map((im, idx) => ({
        study_case_id: caseId,
        user_id: userId,
        source_kind: "SOURCE_REF",
        source_type: im.sourceType!,
        source_image_id: im.sourceImageId!,
        sort_index: idx,
      }));

      if (rows.length) {
        const { error } = await supabase.from("study_case_images").insert(rows);
        if (error) throw error;
      }

      alert(`Caso de Estudio #${caseId} creado sin duplicar imágenes.`);
      setSources((s) => ({ ...s, STUDY_CASE: true }));
      await loadGallery();
    } catch (e: any) {
      alert("No se pudo convertir: " + (e?.message ?? String(e)));
    } finally {
      setWorking(false);
    }
  }


  function noteDotColor(priority: number) {
    if (priority === 3) return "#ef4444";
    if (priority === 2) return "#f59e0b";
    if (priority === 1) return "#22c55e";
    return "#6b7280";
  }

  function openNote(group: GalleryGroup, image: GalleryImage) {
    setNoteTarget({ group, image });
    setNoteDraft(image.note ?? "");
    setNotePriority(image.note?.trim() ? Math.max(1, image.notePriority || 1) : 0);
  }

  async function saveImageNote() {
    if (!noteTarget) return;
    const image = noteTarget.image;
    const clean = noteDraft.trim();
    const priority = clean ? Math.max(1, notePriority || 1) : 0;

    setWorking(true);
    try {
      if (image.sourceKind === "HISTORICAL") {
        if (!image.sourceType || !image.sourceImageId) return;
        const { error } = await supabase.from("gallery_image_metadata").upsert(
          {
            user_id: userId,
            source_type: image.sourceType,
            source_image_id: image.sourceImageId,
            note: clean || null,
            note_priority: priority,
          },
          { onConflict: "user_id,source_type,source_image_id" }
        );
        if (error) throw error;
      } else {
        if (!image.studyCaseImageId) return;
        const { error } = await supabase
          .from("study_case_images")
          .update({ note: clean || null, note_priority: priority })
          .eq("id", image.studyCaseImageId)
          .eq("user_id", userId);
        if (error) throw error;
      }

      setNoteTarget(null);
      await loadGallery();
    } catch (e: any) {
      alert("No se pudo guardar la nota: " + (e?.message ?? String(e)));
    } finally {
      setWorking(false);
    }
  }

  async function removeImageFromStudyCase(group: GalleryGroup, image: GalleryImage) {
    if (group.type !== "STUDY_CASE" || !image.studyCaseImageId) return;
    if (!confirm("¿Quitar esta foto del Caso de Estudio?\n\nSi proviene de un Real/Fake Trade, la foto histórica NO se borrará.")) return;

    setWorking(true);
    try {
      const { data: row, error: readError } = await supabase
        .from("study_case_images")
        .select("id,source_kind,storage_path")
        .eq("id", image.studyCaseImageId)
        .eq("user_id", userId)
        .single();
      if (readError) throw readError;

      if (row?.source_kind === "UPLOAD" && row?.storage_path) {
        const rm = await supabase.storage.from("journal").remove([row.storage_path]);
        if (rm.error) throw rm.error;
      }

      const { error } = await supabase
        .from("study_case_images")
        .delete()
        .eq("id", image.studyCaseImageId)
        .eq("user_id", userId);
      if (error) throw error;

      await loadGallery();
    } catch (e: any) {
      alert("No se pudo quitar la foto: " + (e?.message ?? String(e)));
    } finally {
      setWorking(false);
    }
  }

  async function deleteStudyCase(group: GalleryGroup) {
    if (group.type !== "STUDY_CASE") return;
    if (!confirm(`¿Borrar el Caso de Estudio #${group.id}?\n\nLas fotos provenientes de Real/Fake Trades NO se borrarán.`)) return;

    setWorking(true);
    try {
      const { data: directUploads, error: readError } = await supabase
        .from("study_case_images")
        .select("storage_path")
        .eq("study_case_id", group.id)
        .eq("user_id", userId)
        .eq("source_kind", "UPLOAD");
      if (readError) throw readError;

      const paths = (directUploads || []).map((x: any) => x.storage_path).filter(Boolean);
      if (paths.length) {
        const rm = await supabase.storage.from("journal").remove(paths);
        if (rm.error) throw rm.error;
      }

      const { error } = await supabase
        .from("study_cases")
        .delete()
        .eq("id", group.id)
        .eq("user_id", userId);
      if (error) throw error;

      await loadGallery();
    } catch (e: any) {
      alert("No se pudo borrar el Caso de Estudio: " + (e?.message ?? String(e)));
    } finally {
      setWorking(false);
    }
  }

  function addManageBlobs(blobs: Blob[]) {
    if (!blobs.length) return;
    setManageCaseImages((prev) => [
      ...prev,
      ...blobs.map((blob) => ({
        localId: crypto.randomUUID(),
        kind: "UPLOAD" as const,
        blob,
        preview: URL.createObjectURL(blob),
        timeframe: "",
      })),
    ]);
  }

  function addManageUrl() {
    const url = manageCaseUrl.trim();
    if (!url) return;
    setManageCaseImages((prev) => [
      ...prev,
      { localId: crypto.randomUUID(), kind: "URL", url, preview: url, timeframe: "" },
    ]);
    setManageCaseUrl("");
  }

  async function appendImagesToStudyCase() {
    if (!manageCase || manageCase.type !== "STUDY_CASE" || !manageCaseImages.length) return;
    setWorking(true);
    try {
      const existingMax = manageCase.images.reduce((m, x) => Math.max(m, x.sortIndex), -1);
      for (let i = 0; i < manageCaseImages.length; i++) {
        const im = manageCaseImages[i];
        const sortIndex = existingMax + i + 1;

        if (im.kind === "UPLOAD" && im.blob) {
          const ext = (im.blob.type.split("/")[1] || "png").toLowerCase();
          const key = `u_${userId}/sc_${manageCase.id}/${crypto.randomUUID()}.${ext}`;
          const up = await supabase.storage.from("journal").upload(key, im.blob, {
            upsert: false,
            contentType: im.blob.type || "image/png",
          });
          if (up.error) throw up.error;

          const ins = await supabase.from("study_case_images").insert({
            study_case_id: manageCase.id,
            user_id: userId,
            source_kind: "UPLOAD",
            storage_path: key,
            timeframe: im.timeframe || null,
            sort_index: sortIndex,
            title: "image",
            note_priority: 0,
          });
          if (ins.error) throw ins.error;
        } else if (im.kind === "URL" && im.url) {
          const ins = await supabase.from("study_case_images").insert({
            study_case_id: manageCase.id,
            user_id: userId,
            source_kind: "URL",
            external_url: im.url,
            timeframe: im.timeframe || null,
            sort_index: sortIndex,
            title: "url",
            note_priority: 0,
          });
          if (ins.error) throw ins.error;
        }
      }

      setManageCase(null);
      setManageCaseImages([]);
      setManageCaseUrl("");
      await loadGallery();
    } catch (e: any) {
      alert("No se pudieron añadir las fotos: " + (e?.message ?? String(e)));
    } finally {
      setWorking(false);
    }
  }

  useEffect(() => {
    if (!manageCase) return;
    function onPasteManage(e: ClipboardEvent) {
      const blobs: Blob[] = [];
      for (const it of Array.from(e.clipboardData?.items || [])) {
        if (it.kind === "file") {
          const file = it.getAsFile();
          if (file?.type.startsWith("image/")) blobs.push(file);
        }
      }
      if (blobs.length) {
        e.preventDefault();
        addManageBlobs(blobs);
      }
    }
    window.addEventListener("paste", onPasteManage);
    return () => window.removeEventListener("paste", onPasteManage);
  }, [manageCase]);

  function addPendingBlobs(blobs: Blob[]) {
    if (!blobs.length) return;
    setNewCaseImages((prev) => [
      ...prev,
      ...blobs.map((blob) => ({
        localId: crypto.randomUUID(),
        kind: "UPLOAD" as const,
        blob,
        preview: URL.createObjectURL(blob),
        timeframe: "",
      })),
    ]);
  }

  function addPendingUrl() {
    const url = newCaseUrl.trim();
    if (!url) return;
    setNewCaseImages((prev) => [
      ...prev,
      { localId: crypto.randomUUID(), kind: "URL", url, preview: url, timeframe: "" },
    ]);
    setNewCaseUrl("");
  }

  useEffect(() => {
    if (!newCaseOpen) return;
    function onPaste(e: ClipboardEvent) {
      const blobs: Blob[] = [];
      for (const it of Array.from(e.clipboardData?.items || [])) {
        if (it.kind === "file") {
          const file = it.getAsFile();
          if (file?.type.startsWith("image/")) blobs.push(file);
        }
      }
      if (blobs.length) {
        e.preventDefault();
        addPendingBlobs(blobs);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [newCaseOpen]);

  async function createManualStudyCase() {
    if (!newCaseImages.length) {
      alert("Añade al menos una imagen al Caso de Estudio.");
      return;
    }
    setWorking(true);
    try {
      const { data: sc, error } = await supabase
        .from("study_cases")
        .insert({
          user_id: userId,
          pattern_name: newCasePattern || null,
          notes: newCaseNotes || null,
          source_origin_type: "MANUAL",
          source_origin_id: null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const caseId = Number(sc.id);

      for (let i = 0; i < newCaseImages.length; i++) {
        const im = newCaseImages[i];
        if (im.kind === "UPLOAD" && im.blob) {
          const ext = (im.blob.type.split("/")[1] || "png").toLowerCase();
          const key = `u_${userId}/sc_${caseId}/${crypto.randomUUID()}.${ext}`;
          const up = await supabase.storage.from("journal").upload(key, im.blob, {
            upsert: false,
            contentType: im.blob.type || "image/png",
          });
          if (up.error) throw up.error;
          const ins = await supabase.from("study_case_images").insert({
            study_case_id: caseId,
            user_id: userId,
            source_kind: "UPLOAD",
            storage_path: key,
            timeframe: im.timeframe || null,
            sort_index: i,
            title: "image",
          });
          if (ins.error) throw ins.error;
        } else if (im.kind === "URL" && im.url) {
          const ins = await supabase.from("study_case_images").insert({
            study_case_id: caseId,
            user_id: userId,
            source_kind: "URL",
            external_url: im.url,
            timeframe: im.timeframe || null,
            sort_index: i,
            title: "url",
          });
          if (ins.error) throw ins.error;
        }
      }

      setNewCaseOpen(false);
      setNewCasePattern("");
      setNewCaseNotes("");
      setNewCaseImages([]);
      setSources((s) => ({ ...s, STUDY_CASE: true }));
      alert(`Caso de Estudio #${caseId} creado.`);
      await loadGallery();
    } catch (e: any) {
      alert("No se pudo crear el Caso de Estudio: " + (e?.message ?? String(e)));
    } finally {
      setWorking(false);
    }
  }

  const viewerGroup = viewerGroupKey ? groups.find((g) => g.key === viewerGroupKey) ?? null : null;
  const viewerImages = viewerGroup?.images ?? [];
  const viewerImage = viewerImages[viewerIdx] ?? null;

  function openViewer(group: GalleryGroup, imageIdx: number) {
    setViewerGroupKey(group.key);
    setViewerIdx(imageIdx);
    setZoom(1);
    document.body.style.overflow = "hidden";
  }
  function closeViewer() {
    setViewerGroupKey(null);
    setZoom(1);
    document.body.style.overflow = "";
  }
  function viewerPrev() {
    if (!viewerImages.length) return;
    setViewerIdx((i) => (i - 1 + viewerImages.length) % viewerImages.length);
    setZoom(1);
  }
  function viewerNext() {
    if (!viewerImages.length) return;
    setViewerIdx((i) => (i + 1) % viewerImages.length);
    setZoom(1);
  }

  useEffect(() => {
    if (!viewerGroupKey) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeViewer();
      else if (e.key === "ArrowLeft") viewerPrev();
      else if (e.key === "ArrowRight") viewerNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerGroupKey, viewerImages.length]);

  if (loading && !userId) {
    return <div className="container"><div className="card" style={{ padding: 24 }}>Cargando Gallery…</div></div>;
  }

  return (
    <>
      <TopNav />
      <div className="container gallery-page">
        <div className="card" style={{ padding: 18 }}>
          <div className="gallery-head">
            <div>
              <h1 className="title" style={{ textAlign: "left" }}>Gallery</h1>
              <div className="hint">Biblioteca visual de Real Trades, Fake Trades y Casos de Estudio.</div>
            </div>
            <button className="btn" type="button" onClick={() => setNewCaseOpen(true)}>
              + Crear Nuevo Caso de Estudio
            </button>
          </div>

          <div className="gallery-filters">
            <div className="field">
              <label className="label">Fuentes</label>
              <div className="gallery-source-row">
                {([
                  ["REAL_TRADE", "Real Trades"],
                  ["FAKE_TRADE", "Fake Trades"],
                  ["STUDY_CASE", "Casos de Estudio"],
                ] as [SourceFilter, string][]).map(([key, label]) => (
                  <label key={key} className={`gallery-source-chip ${sources[key] ? "active" : ""}`}>
                    <input
                      type="checkbox"
                      checked={sources[key]}
                      onChange={(e) => setSources((s) => ({ ...s, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="field">
              <label className="label">Patrón</label>
              <select className="select" value={patternFilter} onChange={(e) => setPatternFilter(e.target.value)}>
                <option value="ALL">Todos los patrones</option>
                {patterns.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="field">
              <label className="label">Resultado del patrón</label>
              <select className="select" value={outcomeFilter} onChange={(e) => setOutcomeFilter(e.target.value as "ALL" | PatternOutcome)}>
                <option value="ALL">Todos los resultados</option>
                <option value="MATCHED">Cumplido</option>
                <option value="FAILED">No cumplido</option>
                <option value="PENDING">Sin evaluar</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          {loading && <div className="card" style={{ padding: 18 }}>Cargando fotografías…</div>}
          {!loading && groups.length === 0 && (
            <div className="card" style={{ padding: 18 }}>
              <div className="hint">No hay grupos con fotografías para estos filtros.</div>
            </div>
          )}

          {!loading && groups.map((group) => (
            <section className="card gallery-group" key={group.key}>
              <div className="gallery-group-head">
                <div>
                  <div className="gallery-group-title">
                    {group.type === "REAL_TRADE" && (
                      <a className="gallery-origin-link" href={`/trades/${group.id}`} title="Abrir Real Trade original">
                        {`Trade #${group.ticket || "—"} / Bitlog ID: #${group.id}`}
                      </a>
                    )}
                    {group.type === "FAKE_TRADE" && (
                      <a className="gallery-origin-link" href={`/fake-trades/${group.id}`} title="Abrir Fake Trade original">
                        {`Fake Trade #${group.id}${group.symbol ? ` / ${group.symbol}` : ""}`}
                      </a>
                    )}
                    {group.type === "STUDY_CASE" && `Caso de Estudio #${group.id}`}
                  </div>
                  <div className="hint">
                    {group.images.length} foto{group.images.length === 1 ? "" : "s"}
                    {group.pattern ? ` · Patrón: ${group.pattern}` : ""}
                  </div>
                  <div className="gallery-outcome-row">
                    <span className="hint">Resultado del patrón:</span>
                    <select
                      className={`select gallery-outcome-select outcome-${group.patternOutcome.toLowerCase()}`}
                      value={group.patternOutcome}
                      onChange={(e) => savePatternOutcome(group, e.target.value as PatternOutcome)}
                    >
                      <option value="PENDING">⚪ Sin evaluar</option>
                      <option value="MATCHED">🟢 Cumplido</option>
                      <option value="FAILED">🔴 No cumplido</option>
                    </select>
                  </div>
                  {group.type === "STUDY_CASE" && group.sourceOriginType && group.sourceOriginType !== "MANUAL" && (
                    <div className="hint" style={{ marginTop: 4 }}>
                      Origen: {group.sourceOriginType === "REAL_TRADE" ? "Real Trade" : "Fake Trade"} #{group.sourceOriginId}
                    </div>
                  )}
                </div>

                {(group.type === "REAL_TRADE" || group.type === "FAKE_TRADE") && (
                  <button className="btn secondary" disabled={working} onClick={() => convertToStudyCase(group)}>
                    Convertir este trade en Caso de Estudio
                  </button>
                )}

                {group.type === "STUDY_CASE" && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn secondary" disabled={working} onClick={() => { setManageCase(group); setManageCaseImages([]); setManageCaseUrl(""); }}>
                      + Añadir fotos
                    </button>
                    <button className="btn danger" disabled={working} onClick={() => deleteStudyCase(group)}>
                      Borrar Caso de Estudio
                    </button>
                  </div>
                )}
              </div>

              <div className="gallery-grid">
                {group.images.map((image, idx) => (
                  <div className="gallery-photo" key={image.key}>
                    {group.type === "STUDY_CASE" && (
                      <button
                        type="button"
                        className="gallery-remove-photo"
                        title="Quitar foto de este Caso de Estudio"
                        onClick={() => removeImageFromStudyCase(group, image)}
                      >
                        ×
                      </button>
                    )}
                    <button
                      type="button"
                      className="gallery-note-dot"
                      aria-label="Nota de esta fotografía"
                      title={image.note?.trim() ? "Esta fotografía tiene una nota" : "Añadir nota a esta fotografía"}
                      style={{ background: noteDotColor(image.note?.trim() ? Math.max(1, image.notePriority || 1) : 0) }}
                      onClick={() => openNote(group, image)}
                    />
                    <img src={image.src} alt={image.title ?? ""} onClick={() => openViewer(group, idx)} />
                    <div className="gallery-photo-foot">
                      <strong>{image.timeframe || "SIN TF"}</strong>
                      <select
                        className="select gallery-tf-select"
                        value={image.timeframe || ""}
                        onChange={(e) => saveImageTimeframe(image, e.target.value)}
                        title="Timeframe visible solamente en Gallery"
                      >
                        <option value="">— Sin TF —</option>
                        {TF_ORDER.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="gallery-group-foot">
                <button className="btn secondary" type="button" onClick={() => setNotesGroup(group)}>
                  Notas
                </button>
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* NUEVO CASO DE ESTUDIO */}
      {newCaseOpen && (
        <div className="gallery-backdrop" onMouseDown={() => !working && setNewCaseOpen(false)}>
          <div className="gallery-study-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="gallery-study-modal-head">
              <div>
                <div className="form-title">Crear Nuevo Caso de Estudio</div>
                <div className="hint">Cada foto puede tener su propia temporalidad.</div>
              </div>
              <button className="btn secondary" disabled={working} onClick={() => setNewCaseOpen(false)}>Cerrar</button>
            </div>

            <div className="gallery-study-modal-body">
              <div className="grid-2">
                <div className="field">
                  <label className="label">Patrón</label>
                  <select className="select" value={newCasePattern} onChange={(e) => setNewCasePattern(e.target.value)}>
                    <option value="">— Selecciona —</option>
                    {patterns.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label">Añadir por URL</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="input" value={newCaseUrl} onChange={(e) => setNewCaseUrl(e.target.value)} placeholder="https://..." />
                    <button className="btn" type="button" onClick={addPendingUrl}>Añadir</button>
                  </div>
                </div>
              </div>

              <div className="field" style={{ marginTop: 12 }}>
                <label className="label">Nota personal</label>
                <textarea className="textarea" rows={5} value={newCaseNotes} onChange={(e) => setNewCaseNotes(e.target.value)} />
              </div>

              <div className="gallery-add-row">
                <button className="btn" type="button" onClick={() => fileRef.current?.click()}>Elegir fotos</button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []) as File[];
                    addPendingBlobs(files);
                    e.target.value = "";
                  }}
                />
                <span className="hint">También puedes pegar imágenes con Ctrl+V mientras esta ventana está abierta.</span>
              </div>

              <div className="gallery-grid" style={{ marginTop: 14 }}>
                {newCaseImages.map((im) => (
                  <div className="gallery-photo" key={im.localId}>
                    <img src={im.preview} alt="" />
                    <div className="gallery-photo-foot">
                      <strong>{im.timeframe || "SIN TF"}</strong>
                      <select
                        className="select gallery-tf-select"
                        value={im.timeframe}
                        onChange={(e) => setNewCaseImages((list) => list.map((x) => x.localId === im.localId ? { ...x, timeframe: e.target.value } : x))}
                      >
                        <option value="">— Sin TF —</option>
                        {TF_ORDER.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
                      </select>
                      <button className="btn danger" type="button" onClick={() => setNewCaseImages((list) => list.filter((x) => x.localId !== im.localId))}>
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="gallery-study-modal-foot">
              <button className="btn secondary" disabled={working} onClick={() => setNewCaseOpen(false)}>Cancelar</button>
              <button className="btn" disabled={working || !newCaseImages.length} onClick={createManualStudyCase}>
                {working ? "Guardando…" : "Crear Caso de Estudio"}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* NOTA POR FOTOGRAFÍA */}
      {noteTarget && (
        <div className="gallery-backdrop" onMouseDown={() => !working && setNoteTarget(null)}>
          <div className="gallery-note-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="gallery-study-modal-head">
              <div>
                <div className="form-title">Nota de fotografía</div>
                <div className="hint">
                  {noteTarget.group.type === "REAL_TRADE" ? `Real Trade #${noteTarget.group.id}` :
                   noteTarget.group.type === "FAKE_TRADE" ? `Fake Trade #${noteTarget.group.id}` :
                   `Caso de Estudio #${noteTarget.group.id}`}
                  {" · "}
                  {noteTarget.image.timeframe || "SIN TF"}
                </div>
              </div>
              <button className="btn secondary" disabled={working} onClick={() => setNoteTarget(null)}>Cerrar</button>
            </div>

            <div style={{ padding: 14 }}>
              <div className="field">
                <label className="label">Importancia</label>
                <select className="select" value={notePriority} onChange={(e) => setNotePriority(Number(e.target.value))}>
                  <option value={0}>⚪ Sin nota</option>
                  <option value={1}>🟢 Normal</option>
                  <option value={2}>🟠 Importante</option>
                  <option value={3}>🔴 Crítica</option>
                </select>
              </div>

              <div className="field" style={{ marginTop: 12 }}>
                <label className="label">Nota personal</label>
                <textarea
                  className="textarea"
                  rows={8}
                  value={noteDraft}
                  onChange={(e) => {
                    setNoteDraft(e.target.value);
                    if (e.target.value.trim() && notePriority === 0) setNotePriority(1);
                  }}
                  placeholder="Qué observas específicamente en esta fotografía..."
                />
              </div>
            </div>

            <div className="gallery-study-modal-foot">
              <button className="btn secondary" disabled={working} onClick={() => setNoteTarget(null)}>Cancelar</button>
              <button className="btn" disabled={working} onClick={saveImageNote}>
                {working ? "Guardando…" : "Guardar nota"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESUMEN DE NOTAS DEL TRADE / CASO */}
      {notesGroup && (
        <div className="gallery-backdrop" onMouseDown={() => setNotesGroup(null)}>
          <div className="gallery-notes-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="gallery-study-modal-head">
              <div>
                <div className="form-title">Notas</div>
                <div className="hint">
                  {notesGroup.type === "REAL_TRADE" && `Trade #${notesGroup.ticket || "—"} / Bitlog ID: #${notesGroup.id}`}
                  {notesGroup.type === "FAKE_TRADE" && `Fake Trade #${notesGroup.id}${notesGroup.symbol ? ` / ${notesGroup.symbol}` : ""}`}
                  {notesGroup.type === "STUDY_CASE" && `Caso de Estudio #${notesGroup.id}`}
                </div>
              </div>
              <button className="btn secondary" onClick={() => setNotesGroup(null)}>Cerrar</button>
            </div>

            <div className="gallery-notes-list">
              {sortImages(notesGroup.images).filter((x) => x.note?.trim()).length === 0 ? (
                <div className="hint" style={{ padding: 14 }}>Este grupo todavía no tiene notas en sus fotografías.</div>
              ) : (
                sortImages(notesGroup.images).map((image, idx) => {
                  if (!image.note?.trim()) return null;
                  return (
                    <div className="gallery-note-summary-row" key={image.key}>
                      <div className="gallery-note-summary-head">
                        <div><strong>Foto {idx + 1}, TF {image.timeframe || "SIN TF"}</strong></div>
                        <span
                          className="gallery-note-summary-dot"
                          style={{ background: noteDotColor(Math.max(1, image.notePriority || 1)) }}
                        />
                      </div>
                      <div className="gallery-note-summary-label">Nota:</div>
                      <div className="gallery-note-summary-text">{image.note}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* AÑADIR FOTOS A CASO DE ESTUDIO EXISTENTE */}
      {manageCase && (
        <div className="gallery-backdrop" onMouseDown={() => !working && setManageCase(null)}>
          <div className="gallery-study-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="gallery-study-modal-head">
              <div>
                <div className="form-title">Añadir fotos · Caso de Estudio #{manageCase.id}</div>
                <div className="hint">Archivo, Ctrl+V o URL. Cada foto puede tener su propio TF.</div>
              </div>
              <button className="btn secondary" disabled={working} onClick={() => setManageCase(null)}>Cerrar</button>
            </div>

            <div className="gallery-study-modal-body">
              <div className="grid-2">
                <div className="field">
                  <label className="label">Subir desde dispositivo</label>
                  <button className="btn" type="button" onClick={() => manageFileRef.current?.click()}>Elegir fotos</button>
                  <input
                    ref={manageFileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []) as File[];
                      addManageBlobs(files);
                      e.target.value = "";
                    }}
                  />
                </div>
                <div className="field">
                  <label className="label">Añadir por URL</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="input" value={manageCaseUrl} onChange={(e) => setManageCaseUrl(e.target.value)} placeholder="https://..." />
                    <button className="btn" type="button" onClick={addManageUrl}>Añadir</button>
                  </div>
                </div>
              </div>

              <div className="hint" style={{ marginTop: 10 }}>También puedes pegar capturas con Ctrl+V mientras esta ventana esté abierta.</div>

              <div className="gallery-grid" style={{ marginTop: 14 }}>
                {manageCaseImages.map((im) => (
                  <div className="gallery-photo" key={im.localId}>
                    <img src={im.preview} alt="" />
                    <div className="gallery-photo-foot">
                      <strong>{im.timeframe || "SIN TF"}</strong>
                      <select
                        className="select gallery-tf-select"
                        value={im.timeframe}
                        onChange={(e) => setManageCaseImages((list) => list.map((x) => x.localId === im.localId ? { ...x, timeframe: e.target.value } : x))}
                      >
                        <option value="">— Sin TF —</option>
                        {TF_ORDER.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
                      </select>
                      <button className="btn danger" type="button" onClick={() => setManageCaseImages((list) => list.filter((x) => x.localId !== im.localId))}>
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="gallery-study-modal-foot">
              <button className="btn secondary" disabled={working} onClick={() => setManageCase(null)}>Cancelar</button>
              <button className="btn" disabled={working || !manageCaseImages.length} onClick={appendImagesToStudyCase}>
                {working ? "Guardando…" : "Añadir al Caso de Estudio"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEWER POR TRADE/CASO */}
      {viewerGroup && viewerImage && (
        <div className="gallery-backdrop" onMouseDown={closeViewer}>
          <div className="gallery-viewer" onMouseDown={(e) => e.stopPropagation()}>
            <div className="gallery-viewer-head">
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={viewerPrev}>←</button>
                <button className="btn" onClick={() => setZoom((z) => Math.max(1, z - 0.25))}>−</button>
                <button className="btn" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
                <button className="btn" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>+</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <strong>{viewerImage.timeframe || "SIN TF"}</strong>
                <span className="hint">{viewerIdx + 1} / {viewerImages.length}</span>
                <button className="btn" onClick={viewerNext}>→</button>
                <button className="btn secondary" onClick={closeViewer}>Cerrar</button>
              </div>
            </div>
            <div className="gallery-viewer-body">
              <img
                src={viewerImage.src}
                alt=""
                onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                style={{ width: zoom === 1 ? "auto" : `${zoom * 100}%`, maxWidth: zoom === 1 ? "100%" : "none", maxHeight: zoom === 1 ? "100%" : "none" }}
              />
            </div>
            <div className="gallery-viewer-foot">{viewerImage.title || viewerImage.timeframe || "imagen"}</div>
          </div>
        </div>
      )}

      <style>{`
        .gallery-page { max-width: 1400px; }
        .gallery-head, .gallery-group-head, .gallery-study-modal-head, .gallery-study-modal-foot, .gallery-viewer-head {
          display:flex; align-items:center; justify-content:space-between; gap:14px;
        }
        .gallery-filters { display:grid; grid-template-columns: 2fr 1fr 1fr; gap:16px; margin-top:18px; }
        .gallery-source-row { display:flex; flex-wrap:wrap; gap:8px; }
        .gallery-source-chip { display:flex; gap:7px; align-items:center; padding:9px 12px; border:1px solid #233041; background:#0d1117; cursor:pointer; }
        .gallery-source-chip.active { border-color:#1f6feb; background:#111d31; }
        .gallery-group { padding:18px; margin-bottom:18px; }
        .gallery-group-title { font-size:17px; font-weight:800; }
        .gallery-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; margin-top:14px; }
        .gallery-photo { position:relative; border:1px solid #233041; background:#0d1117; overflow:hidden; min-width:0; }
        .gallery-origin-link { color:#e8eef6; text-decoration:none; border-bottom:1px dotted #64748b; }
        .gallery-origin-link:hover { color:#60a5fa; border-bottom-color:#60a5fa; }
        .gallery-note-dot { position:absolute; top:8px; right:8px; width:17px; height:17px; border-radius:999px !important; border:2px solid rgba(255,255,255,.85); padding:0; z-index:4; cursor:pointer; box-shadow:0 1px 6px rgba(0,0,0,.7); }
        .gallery-remove-photo { position:absolute; top:7px; left:7px; width:25px; height:25px; border-radius:999px !important; border:1px solid rgba(255,255,255,.45); background:rgba(127,29,29,.92); color:#fff; z-index:4; cursor:pointer; font-size:18px; line-height:20px; padding:0; }
        .gallery-group-foot { display:flex; justify-content:flex-end; margin-top:12px; padding-top:12px; border-top:1px solid #1e2630; }
        .gallery-note-modal { width:min(700px,94vw); background:#0b0f15; border:1px solid #223144; }
        .gallery-notes-modal { width:min(900px,94vw); max-height:88vh; background:#0b0f15; border:1px solid #223144; display:flex; flex-direction:column; }
        .gallery-notes-list { overflow:auto; }
        .gallery-note-summary-row { padding:14px 16px; }
        .gallery-note-summary-row:nth-child(odd) { background:#0f141a; }
        .gallery-note-summary-row:nth-child(even) { background:#0b1016; }
        .gallery-note-summary-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .gallery-note-summary-dot { width:12px; height:12px; border-radius:999px; flex:0 0 12px; }
        .gallery-note-summary-label { margin-top:8px; color:#92a4bc; font-size:12px; }
        .gallery-note-summary-text { white-space:pre-wrap; line-height:1.55; margin-top:3px; }
        .gallery-photo img { width:100%; aspect-ratio:16/10; object-fit:cover; display:block; cursor:pointer; }
        .gallery-photo-foot { padding:8px; display:grid; gap:7px; text-align:center; }
        .gallery-photo-foot strong { font-size:13px; letter-spacing:.4px; color:#fff; }
        .gallery-tf-select { padding:6px 7px; font-size:12px; }
        .gallery-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.82); z-index:1000; display:flex; align-items:center; justify-content:center; padding:18px; }
        .gallery-study-modal { width:min(1250px,96vw); max-height:94vh; background:#0b0f15; border:1px solid #223144; display:flex; flex-direction:column; }
        .gallery-study-modal-head, .gallery-study-modal-foot { padding:14px; border-bottom:1px solid #1e2630; }
        .gallery-study-modal-foot { border-bottom:0; border-top:1px solid #1e2630; justify-content:flex-end; }
        .gallery-study-modal-body { padding:14px; overflow:auto; }
        .gallery-add-row { display:flex; align-items:center; gap:12px; margin-top:14px; }
        .gallery-viewer { width:min(1500px,96vw); height:min(96vh,1050px); background:#0b0f15; border:1px solid #223144; display:flex; flex-direction:column; }
        .gallery-viewer-head { flex:0 0 auto; padding:10px 12px; border-bottom:1px solid #1e2630; }
        .gallery-viewer-body { flex:1 1 auto; overflow:auto; display:flex; align-items:center; justify-content:center; padding:10px; }
        .gallery-viewer-body img { object-fit:contain; display:block; cursor:zoom-in; user-select:none; }
        .gallery-viewer-foot { flex:0 0 auto; padding:10px; text-align:center; border-top:1px solid #1e2630; }
        @media (max-width:1100px) { .gallery-grid { grid-template-columns:repeat(4,minmax(0,1fr)); } }

        .gallery-outcome-row { display:flex; align-items:center; gap:8px; margin-top:8px; flex-wrap:wrap; }
        .gallery-outcome-select { width:auto; min-width:160px; padding:6px 9px; font-weight:700; }
        .gallery-outcome-select.outcome-matched { border-color:#16a34a; }
        .gallery-outcome-select.outcome-failed { border-color:#dc2626; }
        @media (max-width:850px) { .gallery-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } .gallery-filters { grid-template-columns:1fr; } .gallery-group-head { align-items:flex-start; flex-direction:column; } }
        @media (max-width:600px) { .gallery-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .gallery-head { align-items:flex-start; flex-direction:column; } }
      `}</style>
    </>
  );
}
