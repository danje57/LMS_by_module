"use client";

import { useState, useEffect } from "react";

interface MigrateStatus {
  pending: { courses: number; documents: number; videos: number };
  encrypted: { courses: number; documents: number; videos: number };
}

export function EncryptMigratePanel() {
  const [status, setStatus] = useState<MigrateStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/admin/encrypt-migrate");
      if (res.ok) setStatus(await res.json());
    } catch { /* ignore */ }
  }

  useEffect(() => { fetchStatus(); }, []);

  const totalPending = status
    ? status.pending.courses + status.pending.documents + status.pending.videos
    : null;

  async function runMigration() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/encrypt-migrate", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setResult(`Chiffré : ${data.courses} cours, ${data.documents} documents, ${data.videos} vidéos. Erreurs : ${data.errors}`);
        await fetchStatus();
      } else {
        setResult("Erreur lors de la migration");
      }
    } catch {
      setResult("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#1C1C1E] p-6 space-y-4">
      <div>
        <h2 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
          Protection du contenu (licencing)
        </h2>
        <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] mt-1">
          Chiffrement AES-256 + signature RSA. Les fichiers sont liés à cette instance — illisibles sur un autre système.
        </p>
      </div>

      {status && (
        <div className="grid grid-cols-3 gap-3 text-sm">
          {(["courses", "documents", "videos"] as const).map((key) => {
            const enc = status.encrypted[key];
            const pend = status.pending[key];
            const total = enc + pend;
            const label = key === "courses" ? "Cours H5P" : key === "documents" ? "Documents GRC" : "Vidéos natives";
            return (
              <div key={key} className="rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] p-3 text-center">
                <div className="text-[22px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {total === 0 ? "—" : `${enc}/${total}`}
                </div>
                <div className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">{label}</div>
                {pend > 0 && (
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">{pend} en attente</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {result && (
        <p className="text-[13px] text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
          {result}
        </p>
      )}

      <button
        onClick={runMigration}
        disabled={loading || totalPending === 0}
        className="w-full rounded-xl bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F] text-[14px] font-medium py-2.5 disabled:opacity-40 hover:opacity-80 transition-opacity"
      >
        {loading
          ? "Chiffrement en cours…"
          : totalPending === 0
          ? "Tout le contenu est chiffré"
          : `Chiffrer ${totalPending} fichier${totalPending !== 1 ? "s" : ""} en attente`}
      </button>

      <p className="text-[11px] text-[#8E8E93] dark:text-[#6E6E73]">
        La clé RSA de cette instance est générée automatiquement et stockée chiffrée en base. Les nouveaux uploads sont chiffrés automatiquement.
      </p>
    </div>
  );
}
