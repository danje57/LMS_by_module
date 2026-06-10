"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSignature, Award, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

interface PdfReaderClientProps {
  courseId: string;
  title: string;
  canSign: boolean;
  alreadySigned: boolean;
  signedAt: string | null;
  certificateId: string | null;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function PdfCanvas({ page, scale }: { page: PDFPageProxy; scale: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const viewport = page.getViewport({ scale });
    canvas.width  = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task = page.render({ canvasContext: ctx, viewport, canvas } as any);
    task.promise.catch((e) => { if (!cancelled) console.error(e); });
    return () => { cancelled = true; task.cancel(); };
  }, [page, scale]);

  return <canvas ref={canvasRef} className="max-w-full shadow-md" />;
}

export function PdfReaderClient({
  courseId, title, canSign, alreadySigned, signedAt: initialSignedAt, certificateId: initialCertId,
}: PdfReaderClientProps) {
  const router = useRouter();
  const [pdfDoc,   setPdfDoc]   = useState<PDFDocumentProxy | null>(null);
  const [page,     setPage]     = useState<PDFPageProxy | null>(null);
  const [pageNum,  setPageNum]  = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale,    setScale]    = useState(1.2);
  const [loadErr,  setLoadErr]  = useState("");

  const [checked,  setChecked]  = useState(false);
  const [signing,  setSigning]  = useState(false);
  const [signErr,  setSignErr]  = useState("");
  const [signed,   setSigned]   = useState(alreadySigned);
  const [signedAt, setSignedAt] = useState(initialSignedAt);
  const [certId,   setCertId]   = useState(initialCertId);

  /* ---- Load PDF via authenticated fetch (pas d'URL exposée) ---- */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
        GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const res = await fetch(`/api/documents/${courseId}/serve`);
        if (!res.ok) { setLoadErr("Impossible de charger le document."); return; }
        const buffer = await res.arrayBuffer();
        if (cancelled) return;

        const doc = await getDocument({ data: buffer }).promise;
        if (cancelled) { doc.destroy(); return; }
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      } catch (e) {
        if (!cancelled) setLoadErr("Erreur lors du chargement du PDF.");
        console.error(e);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [courseId]);

  /* ---- Charger la page courante ---- */
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    pdfDoc.getPage(pageNum).then((p) => { if (!cancelled) setPage(p); });
    return () => { cancelled = true; };
  }, [pdfDoc, pageNum]);

  const goTo = useCallback((n: number) => {
    if (!pdfDoc) return;
    setPageNum(Math.max(1, Math.min(n, numPages)));
  }, [pdfDoc, numPages]);

  /* ---- Signature ---- */
  async function handleSign() {
    if (!checked) return;
    setSigning(true);
    setSignErr("");
    const res  = await fetch(`/api/documents/${courseId}/sign`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) { setSignErr(data.error ?? "Erreur lors de la signature"); setSigning(false); return; }
    setSigned(true);
    setSignedAt(data.signedAt);
    if (data.certificateId) setCertId(data.certificateId);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C]">
        <div className="flex items-center gap-1">
          <button onClick={() => goTo(pageNum - 1)} disabled={pageNum <= 1 || !pdfDoc}
            className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] min-w-[70px] text-center">
            {numPages > 0 ? `${pageNum} / ${numPages}` : "—"}
          </span>
          <button onClick={() => goTo(pageNum + 1)} disabled={pageNum >= numPages || !pdfDoc}
            className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <span className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] truncate max-w-[200px]">{title}</span>

        <div className="flex items-center gap-1">
          <button onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(1)))}
            className="p-1.5 rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors" title="Dézoomer">
            <ZoomOut className="w-4 h-4 text-[#6E6E73]" />
          </button>
          <span className="text-[12px] text-[#ADADB8] w-10 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale((s) => Math.min(3, +(s + 0.2).toFixed(1)))}
            className="p-1.5 rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors" title="Zoomer">
            <ZoomIn className="w-4 h-4 text-[#6E6E73]" />
          </button>
        </div>
      </div>

      {/* Visionneuse */}
      <div className="rounded-2xl overflow-auto border border-[#E5E5EA] dark:border-[#3A3A3C] bg-[#F5F5F7] dark:bg-[#2C2C2E] flex justify-center items-start p-4"
        style={{ minHeight: "calc(100vh - 320px)" }}>
        {loadErr ? (
          <p className="text-[13px] text-red-500 mt-8">{loadErr}</p>
        ) : !page ? (
          <div className="flex flex-col items-center gap-3 mt-16">
            <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin" />
            <p className="text-[13px] text-[#6E6E73]">Chargement…</p>
          </div>
        ) : (
          <PdfCanvas page={page} scale={scale} />
        )}
      </div>

      {/* Zone signature */}
      {canSign && (
        signed ? (
          <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
              <div className="flex-1">
                <p className="text-[15px] font-semibold text-green-800 dark:text-green-300">Document signé</p>
                {signedAt && (
                  <p className="text-[13px] text-green-700 dark:text-green-400">
                    Attestation enregistrée le {formatDateTime(signedAt)}
                  </p>
                )}
              </div>
              {certId && (
                <a href={`/dashboard/certificates/${certId}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-[13px] font-medium rounded-xl transition-colors">
                  <Award className="w-4 h-4" />
                  Attestation
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1C1C1E] border border-[#E5E5EA] dark:border-[#3A3A3C] rounded-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <button type="button" onClick={() => setChecked((v) => !v)}
                className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border-2 transition-colors shrink-0 ${
                  checked ? "bg-[#0071E3] border-[#0071E3]" : "border-[#D2D2D7] dark:border-[#3A3A3C]"
                }`}>
                {checked && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <label onClick={() => setChecked((v) => !v)}
                className="text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] cursor-pointer select-none">
                J'ai lu et j'accepte ce document dans son intégralité.
                <span className="block text-[12px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
                  Cette signature électronique est horodatée et conservée à des fins de conformité.
                </span>
              </label>
            </div>
            {signErr && <p className="text-[13px] text-red-600">{signErr}</p>}
            <button onClick={handleSign} disabled={!checked || signing}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[14px] font-medium rounded-xl transition-colors">
              <FileSignature className="w-4 h-4" />
              {signing ? "Signature en cours…" : "Signer ce document"}
            </button>
          </div>
        )
      )}
    </div>
  );
}
