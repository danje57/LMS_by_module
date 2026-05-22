"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function CertificateSearch({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) router.push(`/dashboard/admin/certificates?id=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADADB8]" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Coller le numéro de certificat…"
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#ADADB8] dark:placeholder:text-[#636366] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 font-mono transition-all"
        />
      </div>
      <button
        type="submit"
        disabled={!value.trim()}
        className="h-11 px-5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium disabled:opacity-40 transition-colors"
      >
        Vérifier
      </button>
    </form>
  );
}
