"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileCheck } from "lucide-react";

export function UploadForm() {
  const router = useRouter();
  const [hasQuiz, setHasQuiz] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      if (!file.name.endsWith(".h5p")) {
        setError("Seuls les fichiers .h5p sont acceptés.");
        e.target.value = "";
        setSelectedFile(null);
        return;
      }
      setError(null);
      setSelectedFile(file);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFile) { setError("Veuillez sélectionner un fichier .h5p."); return; }
    setLoading(true);
    setError(null);
    setProgress(0);

    const form = new FormData(e.currentTarget);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (ev) => {
        if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
      });
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else {
          try { reject(new Error(JSON.parse(xhr.responseText).error ?? "Erreur serveur")); }
          catch { reject(new Error("Erreur serveur")); }
        }
      });
      xhr.addEventListener("error", () => reject(new Error("Erreur réseau")));
      xhr.open("POST", "/api/admin/courses/upload");
      xhr.send(form);
    }).catch((err: Error) => { setError(err.message); setLoading(false); });

    if (!error) { router.push("/dashboard/courses"); router.refresh(); }
  }

  const fieldClass = "w-full h-11 px-3.5 rounded-xl border border-[#D2D2D7] bg-white text-[15px] text-[#1D1D1F] outline-none transition-all focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20";
  const labelClass = "block text-[13px] font-medium text-[#1D1D1F] mb-1.5";

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5EA] p-7">
      <h2 className="text-[17px] font-semibold text-[#1D1D1F] mb-1">Nouveau cours H5P</h2>
      <p className="text-[13px] text-[#6E6E73] mb-6">Renseignez les informations et uploadez votre fichier.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="title" className={labelClass}>Titre du cours</label>
          <input id="title" name="title" required maxLength={255}
            placeholder="Ex : Introduction à la sécurité"
            className={fieldClass} />
        </div>

        <div>
          <label htmlFor="duration" className={labelClass}>Durée (minutes)</label>
          <input id="duration" name="duration" type="number" min="1" required
            placeholder="30"
            className={fieldClass} />
        </div>

        {/* Quiz toggle */}
        <div className="flex items-center justify-between bg-[#F5F5F7] rounded-xl px-4 py-3">
          <div>
            <p className="text-[14px] font-medium text-[#1D1D1F]">Ce cours contient un quiz</p>
            <p className="text-[12px] text-[#6E6E73]">Un score de passage sera requis</p>
          </div>
          <button
            type="button"
            onClick={() => setHasQuiz(!hasQuiz)}
            className={`relative w-11 h-6 rounded-full transition-colors ${hasQuiz ? "bg-[#0071E3]" : "bg-[#D2D2D7]"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${hasQuiz ? "translate-x-5" : ""}`} />
          </button>
          <input type="hidden" name="hasQuiz" value={hasQuiz ? "on" : ""} />
        </div>

        {hasQuiz && (
          <div>
            <label htmlFor="passingScore" className={labelClass}>Score de passage (%)</label>
            <input id="passingScore" name="passingScore" type="number" min="0" max="100" defaultValue="70"
              className={fieldClass} />
          </div>
        )}

        {/* File drop */}
        <div>
          <label className={labelClass}>Fichier H5P</label>
          <label
            htmlFor="file"
            className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-colors ${
              selectedFile
                ? "border-[#0071E3]/40 bg-blue-50/40"
                : "border-[#D2D2D7] hover:border-[#0071E3]/40 hover:bg-[#F5F5F7]"
            }`}
          >
            {selectedFile ? (
              <>
                <FileCheck className="w-8 h-8 text-[#0071E3]" />
                <div className="text-center">
                  <p className="text-[14px] font-medium text-[#1D1D1F]">{selectedFile.name}</p>
                  <p className="text-[12px] text-[#6E6E73]">
                    {(selectedFile.size / 1024 / 1024).toFixed(1)} Mo
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] flex items-center justify-center">
                  <Upload className="w-5 h-5 text-[#8E8E93]" />
                </div>
                <div className="text-center">
                  <p className="text-[14px] font-medium text-[#1D1D1F]">
                    Cliquez pour sélectionner
                  </p>
                  <p className="text-[12px] text-[#6E6E73] mt-0.5">Fichier .h5p · max 600 Mo</p>
                </div>
              </>
            )}
            <input id="file" name="file" type="file" accept=".h5p" className="hidden" onChange={handleFileChange} required />
          </label>
        </div>

        {/* Progress */}
        {loading && (
          <div className="space-y-2">
            <div className="flex justify-between text-[13px] text-[#6E6E73]">
              <span>Upload en cours…</span>
              <span className="font-medium text-[#0071E3]">{progress}%</span>
            </div>
            <div className="h-1.5 bg-[#F5F5F7] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0071E3] rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
            <p className="text-[13px] text-red-600">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 h-11 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[15px] font-medium rounded-xl transition-colors disabled:opacity-60"
          >
            {loading ? "Upload en cours…" : "Uploader le cours"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={loading}
            className="px-5 h-11 border border-[#D2D2D7] text-[#1D1D1F] text-[15px] font-medium rounded-xl hover:bg-[#F5F5F7] transition-colors disabled:opacity-60"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
