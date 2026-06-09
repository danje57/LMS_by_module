"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

export function PdfThumbnail({ docId }: { docId: string }) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#F5F5F7] dark:bg-[#2C2C2E]">
        <FileText className="w-10 h-10 text-[#D2D2D7]" />
      </div>
    );
  }

  return (
    <img
      src={`/api/documents/${docId}/thumbnail`}
      alt=""
      className="w-full h-full object-cover object-top"
      draggable={false}
      onError={() => setError(true)}
    />
  );
}
