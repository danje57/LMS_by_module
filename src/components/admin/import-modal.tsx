"use client";

import { useState, useRef } from "react";
import { X, Upload, Download, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type ImportResult = {
  created: number;
  updated: number;
  errors: { line: number; email: string; message: string }[];
};

const TEMPLATE = [
  "prenom;nom;email;mot_de_passe;role;equipe",
  "Jean;Martin;jean.martin@company.com;MotDePasse1!;manager;Équipe A",
  "Marie;Dupont;marie.dupont@company.com;MotDePasse1!;apprenant;Équipe A",
  "Pierre;Laurent;pierre.laurent@company.com;MotDePasse1!;createur;Équipe B",
  "Astrid;Acosta;astrid@company.com;MotDePasse1!;apprenant;",
].join("\n");

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // retire accents
  );

  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const vals = line.split(sep);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? "").trim(); });
    return {
      prenom: row["prenom"] ?? "",
      nom: row["nom"] ?? "",
      email: row["email"] ?? "",
      mot_de_passe: row["mot_de_passe"] ?? row["mot de passe"] ?? row["password"] ?? "",
      role: row["role"] ?? row["fonction"] ?? "",
      equipe: row["equipe"] ?? row["équipe"] ?? row["team"] ?? "",
    };
  });
}

export function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ReturnType<typeof parseCsv>>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setFile(f);
    setResult(null);
    setParseError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseCsv(e.target?.result as string);
        if (parsed.length === 0) { setParseError("Aucune ligne détectée. Vérifiez le format du fichier."); return; }
        setRows(parsed);
      } catch {
        setParseError("Impossible de lire le fichier.");
      }
    };
    reader.readAsText(f, "utf-8");
  }

  async function handleImport() {
    if (rows.length === 0) return;
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
      setParseError("Erreur lors de l'import.");
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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5EA]">
          <div className="flex items-center gap-2.5">
            <Upload className="w-5 h-5 text-[#0071E3]" />
            <p className="text-[15px] font-semibold text-[#1D1D1F]">Import CSV</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F5F5F7] transition-colors">
            <X className="w-4 h-4 text-[#6E6E73]" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Template download */}
          <button
            onClick={downloadTemplate}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-[#D2D2D7] hover:border-[#0071E3] hover:bg-blue-50/40 transition-all group"
          >
            <Download className="w-4 h-4 text-[#6E6E73] group-hover:text-[#0071E3]" />
            <div className="text-left">
              <p className="text-[13px] font-medium text-[#1D1D1F]">Télécharger le modèle CSV</p>
              <p className="text-[11px] text-[#6E6E73]">prenom ; nom ; email ; mot_de_passe ; role ; equipe</p>
            </div>
          </button>

          {/* Rôles acceptés */}
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="text-[#6E6E73]">Rôles acceptés :</span>
            {[["manager","bg-purple-50 text-purple-600"],["createur","bg-amber-50 text-amber-600"],["apprenant","bg-blue-50 text-blue-600"],["admin","bg-red-50 text-red-600"]].map(([r, c]) => (
              <span key={r} className={cn("px-2 py-0.5 rounded-md font-medium", c)}>{r}</span>
            ))}
          </div>

          {/* Zone de dépôt */}
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className="border-2 border-dashed border-[#D2D2D7] hover:border-[#0071E3] rounded-xl p-6 text-center cursor-pointer transition-colors"
          >
            <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="w-5 h-5 text-[#0071E3]" />
                <p className="text-[13px] font-medium text-[#1D1D1F]">{file.name}</p>
                <span className="text-[12px] text-[#6E6E73]">— {rows.length} ligne{rows.length > 1 ? "s" : ""} détectée{rows.length > 1 ? "s" : ""}</span>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-[#ADADB8] mx-auto mb-2" />
                <p className="text-[13px] text-[#6E6E73]">Glissez votre fichier CSV ou <span className="text-[#0071E3] font-medium">parcourir</span></p>
              </>
            )}
          </div>

          {parseError && (
            <div className="flex items-center gap-2 text-[13px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {parseError}
            </div>
          )}

          {/* Résultats */}
          {result && (
            <div className="space-y-3">
              <div className="flex gap-3">
                {result.created > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[13px] font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    {result.created} créé{result.created > 1 ? "s" : ""}
                  </div>
                )}
                {result.updated > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[13px] font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    {result.updated} mis à jour
                  </div>
                )}
                {result.errors.length > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[13px] font-medium">
                    <AlertCircle className="w-4 h-4" />
                    {result.errors.length} erreur{result.errors.length > 1 ? "s" : ""}
                  </div>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {result.errors.map((e, i) => (
                    <div key={i} className="text-[12px] text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
                      Ligne {e.line} ({e.email || "—"}) : {e.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-[#D2D2D7] text-[14px] font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors">
              {result ? "Fermer" : "Annuler"}
            </button>
            {!result && (
              <button
                onClick={handleImport}
                disabled={rows.length === 0 || loading}
                className="flex-1 h-10 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Import en cours…" : `Importer ${rows.length > 0 ? rows.length + " utilisateur" + (rows.length > 1 ? "s" : "") : ""}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
