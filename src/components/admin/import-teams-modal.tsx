"use client";

import { useState, useRef } from "react";
import { X, Upload, Download, AlertCircle, CheckCircle2, FileText, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type CsvRow = { team: string; email: string; role: "manager" | "membre"; _error?: string };

type ImportResult = { teamsCreated: number; teamsUpdated: number; membersAdded: number };

const TEMPLATE = [
  "equipe;email;role",
  "Équipe A;jean.martin@company.com;manager",
  "Équipe A;marie.dupont@company.com;membre",
  "Équipe B;pierre.laurent@company.com;manager",
  "Équipe B;alice.durand@company.com;membre",
].join("\n");

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const vals = line.split(sep);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? "").trim(); });
    const role = (row["role"] ?? "membre").toLowerCase();
    const r: CsvRow = {
      team: row["equipe"] ?? row["équipe"] ?? row["team"] ?? "",
      email: row["email"] ?? "",
      role: role === "manager" ? "manager" : "membre",
    };
    if (!r.team) r._error = "Équipe manquante";
    else if (!r.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) r._error = "Email invalide";
    return r;
  });
}

export function ImportTeamsModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [apiErrors, setApiErrors] = useState<{ line: number; email: string; message: string }[]>([]);
  const [parseError, setParseError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setResult(null);
    setApiErrors([]);
    setParseError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsv(text);
      if (!parsed.length) { setParseError("Aucune ligne détectée. Vérifiez le format."); return; }
      setRows(parsed);
    };
    reader.readAsText(f, "utf-8");
  }

  function downloadTemplate() {
    const blob = new Blob(["﻿" + TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "import_equipes.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    const valid = rows.filter((r) => !r._error);
    if (!valid.length) return;
    setLoading(true);
    setApiErrors([]);
    const res = await fetch("/api/admin/teams/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: valid.map((r) => ({ team: r.team, email: r.email, role: r.role })) }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      if (json.errors) setApiErrors(json.errors);
      return;
    }
    setResult(json);
    onDone();
  }

  const validRows = rows.filter((r) => !r._error);
  const errorRows = rows.filter((r) => r._error);
  const teamNames = [...new Set(validRows.map((r) => r.team))];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#E5E5EA] dark:border-[#3A3A3C]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Importer des équipes</p>
              <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">Format CSV : equipe ; email ; role</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] text-[#6E6E73]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={downloadTemplate} className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] text-[13px] text-[#3C3C43] dark:text-[#AEAEB2] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors">
              <Download className="w-3.5 h-3.5" />
              Télécharger le modèle
            </button>
            <button onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] text-[13px] text-[#3C3C43] dark:text-[#AEAEB2] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors">
              <FileText className="w-3.5 h-3.5" />
              {rows.length ? "Changer de fichier" : "Sélectionner un fichier CSV"}
            </button>
            <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          </div>

          {/* Format info */}
          {!rows.length && (
            <div className="rounded-xl border border-[#E5E5EA] dark:border-[#3A3A3C] bg-[#F5F5F7] dark:bg-[#2C2C2E] p-4 text-[13px] text-[#3C3C43] dark:text-[#AEAEB2] space-y-1">
              <p className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7] mb-2">Format attendu</p>
              <p>• Colonnes : <code className="bg-white dark:bg-[#1C1C1E] px-1.5 py-0.5 rounded text-[12px]">equipe ; email ; role</code></p>
              <p>• Rôle : <code className="bg-white dark:bg-[#1C1C1E] px-1.5 py-0.5 rounded text-[12px]">manager</code> ou <code className="bg-white dark:bg-[#1C1C1E] px-1.5 py-0.5 rounded text-[12px]">membre</code></p>
              <p>• Les utilisateurs doivent déjà exister dans l&apos;application</p>
              <p>• Les équipes inexistantes sont créées automatiquement</p>
            </div>
          )}

          {parseError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[13px]">
              <AlertCircle className="w-4 h-4 shrink-0" /> {parseError}
            </div>
          )}

          {/* Résultat import */}
          {result && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[13px]">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Import réussi</p>
                <p>{result.teamsCreated} équipe(s) créée(s), {result.teamsUpdated} mise(s) à jour, {result.membersAdded} membre(s) ajouté(s).</p>
              </div>
            </div>
          )}

          {/* Erreurs API */}
          {apiErrors.length > 0 && (
            <div className="space-y-1">
              {apiErrors.map((e, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[12px]">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Ligne {e.line} ({e.email}) : {e.message}
                </div>
              ))}
            </div>
          )}

          {/* Prévisualisation */}
          {rows.length > 0 && !result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Prévisualisation — {teamNames.length} équipe(s), {validRows.length} ligne(s) valide(s)
                  {errorRows.length > 0 && <span className="text-red-500"> · {errorRows.length} erreur(s)</span>}
                </p>
              </div>
              <div className="rounded-xl border border-[#E5E5EA] dark:border-[#3A3A3C] overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#F5F5F7] dark:bg-[#2C2C2E] border-b border-[#E5E5EA] dark:border-[#3A3A3C]">
                      <th className="text-left px-3 py-2 font-medium text-[#6E6E73] dark:text-[#8E8E93]">Équipe</th>
                      <th className="text-left px-3 py-2 font-medium text-[#6E6E73] dark:text-[#8E8E93]">Email</th>
                      <th className="text-left px-3 py-2 font-medium text-[#6E6E73] dark:text-[#8E8E93]">Rôle</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={cn("border-b border-[#F5F5F7] dark:border-[#2C2C2E] last:border-0", r._error && "bg-red-50/50 dark:bg-red-500/5")}>
                        <td className="px-3 py-2 text-[#1D1D1F] dark:text-[#F5F5F7] font-medium">{r.team || <span className="text-red-400">—</span>}</td>
                        <td className="px-3 py-2 text-[#3C3C43] dark:text-[#AEAEB2]">{r.email || <span className="text-red-400">—</span>}</td>
                        <td className="px-3 py-2">
                          <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-md", r.role === "manager" ? "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400" : "bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#8E8E93]")}>
                            {r.role}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r._error && <span className="text-[11px] text-red-500">{r._error}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {rows.length > 0 && !result && (
          <div className="flex gap-3 px-6 py-4 border-t border-[#E5E5EA] dark:border-[#3A3A3C]">
            <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors">
              Annuler
            </button>
            <button
              onClick={handleImport}
              disabled={loading || validRows.length === 0}
              className="flex-1 h-10 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {loading ? "Import en cours…" : `Importer ${validRows.length} ligne(s)`}
            </button>
          </div>
        )}

        {result && (
          <div className="px-6 py-4 border-t border-[#E5E5EA] dark:border-[#3A3A3C]">
            <button onClick={onClose} className="w-full h-10 rounded-xl bg-[#1D1D1F] dark:bg-[#F5F5F7] dark:text-[#1D1D1F] text-white text-[14px] font-medium transition-colors">
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
