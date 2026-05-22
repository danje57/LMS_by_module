"use client";

import { useState, useEffect } from "react";
import { Download, FileText, Archive } from "lucide-react";

interface User { id: string; name: string | null; email: string }
interface Team { id: string; name: string }

export function ExportPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [userId, setUserId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [year, setYear] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/users").then(r => r.json()).then(setUsers).catch(() => {});
    fetch("/api/admin/teams").then(r => r.json()).then(setTeams).catch(() => {});
  }, []);

  const buildUrl = (format: "csv" | "zip") => {
    const p = new URLSearchParams({ format });
    if (userId) p.set("userId", userId);
    if (teamId) p.set("teamId", teamId);
    if (year) p.set("year", year);
    return `/api/admin/certificates/export?${p}`;
  };

  const handleDownload = (format: "csv" | "zip") => {
    setLoading(true);
    const a = document.createElement("a");
    a.href = buildUrl(format);
    a.click();
    setTimeout(() => setLoading(false), 2000);
  };

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Exporter les certificats</h2>
        <p className="text-[14px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
          Téléchargez les certificats filtrés en CSV ou en archive ZIP avec les PDFs.
        </p>
      </div>

      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* User filter */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-[#3C3C43] dark:text-[#AEAEB2]">Apprenant</label>
            <select
              value={userId}
              onChange={e => { setUserId(e.target.value); if (e.target.value) setTeamId(""); }}
              className="w-full h-9 rounded-lg border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] px-3 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/40"
            >
              <option value="">Tous les apprenants</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
              ))}
            </select>
          </div>

          {/* Team filter */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-[#3C3C43] dark:text-[#AEAEB2]">Département</label>
            <select
              value={teamId}
              onChange={e => { setTeamId(e.target.value); if (e.target.value) setUserId(""); }}
              className="w-full h-9 rounded-lg border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] px-3 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/40"
            >
              <option value="">Tous les départements</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Year filter */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-[#3C3C43] dark:text-[#AEAEB2]">Année</label>
            <select
              value={year}
              onChange={e => setYear(e.target.value)}
              className="w-full h-9 rounded-lg border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] px-3 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/40"
            >
              <option value="">Toutes les années</option>
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            onClick={() => handleDownload("csv")}
            disabled={loading}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] transition-colors disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            Exporter CSV
          </button>

          <button
            onClick={() => handleDownload("zip")}
            disabled={loading}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#0071E3] text-[13px] font-medium text-white hover:bg-[#0077ED] transition-colors disabled:opacity-50"
          >
            <Archive className="w-4 h-4" />
            {loading ? "Génération…" : "Exporter ZIP (PDFs)"}
          </button>

          {(userId || teamId || year) && (
            <button
              onClick={() => { setUserId(""); setTeamId(""); setYear(""); }}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] transition-colors"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>

        <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">
          <Download className="w-3.5 h-3.5 inline mr-1" />
          Le ZIP contient un PDF par certificat avec le logo de l&apos;application.
          La génération peut prendre quelques secondes.
        </p>
      </div>
    </div>
  );
}
