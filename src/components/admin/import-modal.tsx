"use client";

import { useState, useRef } from "react";
import { X, Upload, Download, CheckCircle2, AlertCircle, FileText, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type CsvRow = {
  prenom: string;
  nom: string;
  email: string;
  mot_de_passe: string;
  role: string;
  equipe: string;
};

type ImportResult = {
  created: number;
  updated: number;
  errors: { line: number; email: string; message: string }[];
};

const ROLES = ["apprenant", "createur", "manager", "admin"];

const ROLE_COLORS: Record<string, string> = {
  manager:  "bg-purple-50 text-purple-600",
  createur: "bg-amber-50 text-amber-600",
  apprenant:"bg-blue-50 text-blue-600",
  admin:    "bg-red-50 text-red-600",
};

const TEMPLATE = [
  "prenom;nom;email;mot_de_passe;role;equipe",
  "Jean;Martin;jean.martin@company.com;MotDePasse1!;manager;Équipe A",
  "Marie;Dupont;marie.dupont@company.com;MotDePasse1!;apprenant;Équipe A",
  "Pierre;Laurent;pierre.laurent@company.com;MotDePasse1!;createur;Équipe B",
  "Astrid;Acosta;astrid@company.com;MotDePasse1!;apprenant;",
].join("\n");

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) =>
    h.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  );
  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const vals = line.split(sep);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? "").trim(); });
    return {
      prenom:       row["prenom"] ?? "",
      nom:          row["nom"] ?? "",
      email:        row["email"] ?? "",
      mot_de_passe: row["mot_de_passe"] ?? row["mot de passe"] ?? row["password"] ?? "",
      role:         row["role"] ?? row["fonction"] ?? "apprenant",
      equipe:       row["equipe"] ?? row["équipe"] ?? row["team"] ?? "",
    };
  });
}

function hasError(row: CsvRow, tImport: ReturnType<typeof useTranslations>): string | null {
  if (!row.email.trim()) return tImport("emailMissing");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return tImport("emailInvalid");
  if (!ROLES.includes(row.role.toLowerCase())) return tImport("invalidRole", { role: row.role });
  return null;
}

export function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useTranslations("importCsv");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setResult(null);
    setParseError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCsv(e.target?.result as string);
      if (parsed.length === 0) { setParseError(t("noLinesDetected")); return; }
      setRows(parsed);
    };
    reader.readAsText(f, "utf-8");
  }

  function updateRow(i: number, field: keyof CsvRow, value: string) {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function deleteRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addRow() {
    setRows((prev) => [...prev, { prenom: "", nom: "", email: "", mot_de_passe: "", role: "apprenant", equipe: "" }]);
  }

  async function handleImport() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      setResult(data);
      if (data.created > 0 || data.updated > 0) onDone();
    } catch {
      setParseError(t("importError"));
    } finally {
      setLoading(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob(["﻿" + TEMPLATE], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "modele_import_utilisateurs.csv";
    a.click();
  }

  const errorCount = rows.filter((r) => hasError(r, t)).length;
  const canImport = rows.length > 0 && errorCount === 0 && !loading;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={cn(
        "bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full flex flex-col transition-all",
        rows.length > 0 ? "max-w-5xl max-h-[90vh]" : "max-w-lg"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5EA] dark:border-[#3A3A3C] shrink-0">
          <div className="flex items-center gap-2.5">
            <Upload className="w-5 h-5 text-[#0071E3]" />
            <p className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              {t("title")}
              {rows.length > 0 && (
                <span className="ml-2 text-[13px] font-normal text-[#6E6E73] dark:text-[#8E8E93]">
                  — {rows.length} ligne{rows.length > 1 ? "s" : ""}
                  {errorCount > 0 && <span className="text-red-500 ml-1">· {errorCount} erreur{errorCount > 1 ? "s" : ""}</span>}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadTemplate} title={t("downloadTemplate")} className="p-1.5 rounded-lg text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] hover:text-[#0071E3] transition-colors">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors">
              <X className="w-4 h-4 text-[#6E6E73] dark:text-[#8E8E93]" />
            </button>
          </div>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden p-6 gap-5">

          {/* Zone upload — visible si pas encore de lignes */}
          {rows.length === 0 && (
            <>
              <button
                onClick={downloadTemplate}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-[#D2D2D7] dark:border-[#3A3A3C] hover:border-[#0071E3] hover:bg-blue-50/40 dark:hover:bg-[#0071E3]/10 transition-all group"
              >
                <Download className="w-4 h-4 text-[#6E6E73] dark:text-[#8E8E93] group-hover:text-[#0071E3]" />
                <div className="text-left">
                  <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{t("downloadTemplateCSV")}</p>
                  <p className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93]">prenom ; nom ; email ; mot_de_passe ; role ; equipe</p>
                </div>
              </button>

              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <span className="text-[#6E6E73] dark:text-[#8E8E93]">{t("rolesLabel")}</span>
                {ROLES.map((r) => (
                  <span key={r} className={cn("px-2 py-0.5 rounded-md font-medium", ROLE_COLORS[r] ?? "bg-[#F5F5F7] text-[#6E6E73]")}>{r}</span>
                ))}
              </div>

              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                className="border-2 border-dashed border-[#D2D2D7] dark:border-[#3A3A3C] hover:border-[#0071E3] rounded-xl p-8 text-center cursor-pointer transition-colors"
              >
                <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                <Upload className="w-8 h-8 text-[#ADADB8] mx-auto mb-2" />
                <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">
                  {t("dragOrBrowse")} <span className="text-[#0071E3] font-medium">{t("browse")}</span>
                </p>
              </div>

              {parseError && (
                <div className="flex items-center gap-2 text-[13px] text-red-600 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />{parseError}
                </div>
              )}
            </>
          )}

          {/* Table éditable */}
          {rows.length > 0 && !result && (
            <>
              <div className="flex-1 overflow-auto rounded-xl border border-[#E5E5EA] dark:border-[#3A3A3C]">
                <table className="w-full text-[12px] border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#F5F5F7] dark:bg-[#2C2C2E] border-b border-[#E5E5EA] dark:border-[#3A3A3C]">
                      {[t("firstName"), t("lastName"), "Email", t("password"), t("role"), t("team"), ""].map((h) => (
                        <th key={h} className="text-left text-[11px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] px-3 py-2.5 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F5F7] dark:divide-[#3A3A3C]">
                    {rows.map((row, i) => {
                      const err = hasError(row, t);
                      return (
                        <tr key={i} className={cn("group hover:bg-[#FAFAFA] dark:hover:bg-[#2C2C2E]", err && "bg-red-50/50 dark:bg-red-500/10")}>
                          {/* Prénom */}
                          <td className="px-2 py-1.5">
                            <input value={row.prenom} onChange={(e) => updateRow(i, "prenom", e.target.value)}
                              className="w-full h-7 px-2 rounded-lg border border-transparent hover:border-[#D2D2D7] dark:hover:border-[#636366] focus:border-[#0071E3] focus:outline-none bg-transparent focus:bg-white dark:focus:bg-[#2C2C2E] text-[12px] dark:text-[#F5F5F7] transition-all" />
                          </td>
                          {/* Nom */}
                          <td className="px-2 py-1.5">
                            <input value={row.nom} onChange={(e) => updateRow(i, "nom", e.target.value)}
                              className="w-full h-7 px-2 rounded-lg border border-transparent hover:border-[#D2D2D7] dark:hover:border-[#636366] focus:border-[#0071E3] focus:outline-none bg-transparent focus:bg-white dark:focus:bg-[#2C2C2E] text-[12px] dark:text-[#F5F5F7] transition-all" />
                          </td>
                          {/* Email */}
                          <td className="px-2 py-1.5">
                            <input value={row.email} onChange={(e) => updateRow(i, "email", e.target.value)}
                              className={cn("w-full h-7 px-2 rounded-lg border focus:outline-none bg-transparent focus:bg-white dark:focus:bg-[#2C2C2E] text-[12px] dark:text-[#F5F5F7] transition-all",
                                !row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)
                                  ? "border-red-300 bg-red-50/50 dark:bg-red-500/10"
                                  : "border-transparent hover:border-[#D2D2D7] dark:hover:border-[#636366] focus:border-[#0071E3]"
                              )} />
                          </td>
                          {/* Mot de passe */}
                          <td className="px-2 py-1.5">
                            <input type="text" value={row.mot_de_passe} onChange={(e) => updateRow(i, "mot_de_passe", e.target.value)}
                              placeholder="(inchangé si vide)"
                              className="w-full h-7 px-2 rounded-lg border border-transparent hover:border-[#D2D2D7] dark:hover:border-[#636366] focus:border-[#0071E3] focus:outline-none bg-transparent focus:bg-white dark:focus:bg-[#2C2C2E] text-[12px] dark:text-[#F5F5F7] placeholder:text-[#ADADB8] dark:placeholder:text-[#636366] transition-all" />
                          </td>
                          {/* Rôle */}
                          <td className="px-2 py-1.5">
                            <select value={row.role.toLowerCase()} onChange={(e) => updateRow(i, "role", e.target.value)}
                              className={cn("h-7 px-2 rounded-lg border border-transparent hover:border-[#D2D2D7] focus:border-[#0071E3] focus:outline-none text-[11px] font-medium transition-all cursor-pointer",
                                ROLE_COLORS[row.role.toLowerCase()] ?? "bg-[#F5F5F7] text-[#6E6E73]"
                              )}>
                              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </td>
                          {/* Équipe */}
                          <td className="px-2 py-1.5">
                            <input value={row.equipe} onChange={(e) => updateRow(i, "equipe", e.target.value)}
                              placeholder="(optionnel)"
                              className="w-full h-7 px-2 rounded-lg border border-transparent hover:border-[#D2D2D7] dark:hover:border-[#636366] focus:border-[#0071E3] focus:outline-none bg-transparent focus:bg-white dark:focus:bg-[#2C2C2E] text-[12px] dark:text-[#F5F5F7] placeholder:text-[#ADADB8] dark:placeholder:text-[#636366] transition-all" />
                          </td>
                          {/* Supprimer */}
                          <td className="px-2 py-1.5 w-8">
                            <button onClick={() => deleteRow(i)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-[#ADADB8] hover:bg-red-50 hover:text-red-500 transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Ajouter une ligne */}
              <button onClick={addRow}
                className="flex items-center gap-2 text-[13px] text-[#6E6E73] hover:text-[#0071E3] transition-colors w-fit">
                <Plus className="w-3.5 h-3.5" />
                {t("addLine")}
              </button>
            </>
          )}

          {/* Résultats */}
          {result && (
            <div className="space-y-3">
              <div className="flex gap-3 flex-wrap">
                {result.created > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 rounded-lg text-[13px] font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    {result.created} créé{result.created > 1 ? "s" : ""}
                  </div>
                )}
                {result.updated > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-[#0071E3]/10 text-blue-700 rounded-lg text-[13px] font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    {result.updated} mis à jour
                  </div>
                )}
                {result.errors.length > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-lg text-[13px] font-medium">
                    <AlertCircle className="w-4 h-4" />
                    {result.errors.length} erreur{result.errors.length > 1 ? "s" : ""}
                  </div>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {result.errors.map((e, i) => (
                    <div key={i} className="text-[12px] text-red-600 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 rounded-lg">
                      {t("lineError", { line: e.line, email: e.email || "—", message: e.message })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions bas */}
          <div className="flex items-center gap-3 shrink-0">
            {rows.length > 0 && !result && (
              <button onClick={() => { setRows([]); inputRef.current && (inputRef.current.value = ""); }}
                className="flex items-center gap-1.5 h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] text-[13px] text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors">
                <FileText className="w-3.5 h-3.5" />
                {t("changeFile")}
              </button>
            )}
            <div className="flex-1" />
            <button onClick={onClose}
              className="h-10 px-4 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors">
              {result ? "Fermer" : "Annuler"}
            </button>
            {!result && rows.length > 0 && (
              <button onClick={handleImport} disabled={!canImport}
                title={errorCount > 0 ? "Corrigez les erreurs avant d'importer" : ""}
                className="h-10 px-5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {loading ? "Import en cours…" : t("importButton", { n: rows.length })}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
