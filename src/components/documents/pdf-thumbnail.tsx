"use client";

import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";

export function PdfThumbnail({ docId }: { docId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const pdf = await pdfjsLib.getDocument(`/api/documents/${docId}/serve`).promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const containerWidth = canvas.parentElement?.clientWidth ?? 300;
        const viewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / viewport.width;
        const scaled = page.getViewport({ scale });

        canvas.width  = scaled.width;
        canvas.height = scaled.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        await page.render({ canvasContext: ctx, canvas, viewport: scaled }).promise;
        if (!cancelled) setState("done");
      } catch {
        if (!cancelled) setState("error");
      }
    }

    render();
    return () => { cancelled = true; };
  }, [docId]);

  if (state === "error") {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#F5F5F7] dark:bg-[#2C2C2E]">
        <FileText className="w-10 h-10 text-[#D2D2D7]" />
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#F5F5F7] dark:bg-[#2C2C2E]">
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-[#D2D2D7] border-t-[#0071E3] animate-spin" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover object-top"
        style={{ display: state === "done" ? "block" : "none" }}
      />
    </div>
  );
}
