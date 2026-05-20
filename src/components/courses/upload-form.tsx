"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileCheck, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full h-11 px-3.5 rounded-xl border border-[#D2D2D7] bg-white text-[15px] text-[#1D1D1F] outline-none transition-all focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20";
const labelClass = "block text-[13px] font-medium text-[#1D1D1F] mb-1.5";

interface Creator { id: string; name: string | null; email: string }

interface SharedFields {
  title: string;
  duration: string;
  hasQuiz: boolean;
  passingScore: string;
}

function QuizToggle({
  hasQuiz,
  setHasQuiz,
  passingScore,
  setPassingScore,
}: {
  hasQuiz: boolean;
  setHasQuiz: (v: boolean) => void;
  passingScore: string;
  setPassingScore: (v: string) => void;
}) {
  return (
    <>
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
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${hasQuiz ? "translate-x-5" : ""}`}
          />
        </button>
      </div>
      {hasQuiz && (
        <div>
          <label className={labelClass}>Score de passage (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={passingScore}
            onChange={(e) => setPassingScore(e.target.value)}
            className={fieldClass}
          />
        </div>
      )}
    </>
  );
}

function FileDropZone({
  accept,
  label,
  hint,
  selectedFile,
  onFileChange,
}: {
  accept: string;
  label: string;
  hint: string;
  selectedFile: File | null;
  onFileChange: (f: File | null) => void;
}) {
  return (
    <label
      htmlFor="file"
      className={cn(
        "flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-colors",
        selectedFile
          ? "border-[#0071E3]/40 bg-blue-50/40"
          : "border-[#D2D2D7] hover:border-[#0071E3]/40 hover:bg-[#F5F5F7]"
      )}
    >
      {selectedFile ? (
        <>
          <FileCheck className="w-8 h-8 text-[#0071E3]" />
          <div className="text-center">
            <p className="text-[14px] font-medium text-[#1D1D1F]">{selectedFile.name}</p>
            <p className="text-[12px] text-[#6E6E73]">{(selectedFile.size / 1024 / 1024).toFixed(1)} Mo</p>
          </div>
        </>
      ) : (
        <>
          <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] flex items-center justify-center">
            <Upload className="w-5 h-5 text-[#8E8E93]" />
          </div>
          <div className="text-center">
            <p className="text-[14px] font-medium text-[#1D1D1F]">Cliquez pour sélectionner</p>
            <p className="text-[12px] text-[#6E6E73] mt-0.5">{hint}</p>
          </div>
        </>
      )}
      <input
        id="file"
        name="file"
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        required
      />
    </label>
  );
}

function ProgressBar({ progress, label }: { progress: number; label: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[13px] text-[#6E6E73]">
        <span>{label}</span>
        <span className="font-medium text-[#0071E3]">{progress}%</span>
      </div>
      <div className="h-1.5 bg-[#F5F5F7] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#0071E3] rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

type DuplicateInfo = { existingTitle: string; existingId: string };

// ─── Formulaire H5P ──────────────────────────────────────────────────────────
function H5PForm({ onSuccess, isAdmin, userId, creators }: { onSuccess: () => void; isAdmin: boolean; userId: string; creators: Creator[] }) {
  const [hasQuiz, setHasQuiz] = useState(false);
  const [passingScore, setPassingScore] = useState("70");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  function handleFileChange(f: File | null) {
    if (f && !f.name.endsWith(".h5p")) {
      setError("Seuls les fichiers .h5p sont acceptés.");
      setSelectedFile(null);
      return;
    }
    setError(null);
    setDuplicate(null);
    setSelectedFile(f);
  }

  async function submit(force = false) {
    if (!selectedFile || !formRef.current) return;
    setLoading(true);
    setError(null);
    setDuplicate(null);
    setProgress(0);

    const form = new FormData(formRef.current);
    form.set("hasQuiz", hasQuiz ? "on" : "");
    form.set("passingScore", passingScore);
    if (force) form.set("force", "true");

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText);
            if (data.duplicate) {
              setDuplicate({ existingTitle: data.existingTitle, existingId: data.existingId });
              setLoading(false);
              reject(null);
            } else {
              resolve();
            }
          } else {
            try { reject(new Error(JSON.parse(xhr.responseText).error ?? "Erreur serveur")); }
            catch { reject(new Error("Erreur serveur")); }
          }
        });
        xhr.addEventListener("error", () => reject(new Error("Erreur réseau")));
        xhr.open("POST", "/api/admin/courses/upload");
        xhr.send(form);
      });
      onSuccess();
    } catch (err) {
      if (err !== null) { setError(err instanceof Error ? err.message : "Erreur inconnue"); setLoading(false); }
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFile) { setError("Veuillez sélectionner un fichier .h5p."); return; }
    await submit(false);
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      {isAdmin ? (
        <div>
          <label className={labelClass}>Créateur du cours</label>
          <select name="createdById" required className={fieldClass}>
            <option value="">— Sélectionner un manager / créateur —</option>
            {creators.map((c) => (
              <option key={c.id} value={c.id}>{c.name ?? c.email}</option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="createdById" value={userId} />
      )}
      <div>
        <label className={labelClass}>Titre du cours</label>
        <input name="title" required maxLength={255} placeholder="Ex : Introduction à la sécurité" className={fieldClass} />
      </div>
      <div>
        <label className={labelClass}>Durée (minutes)</label>
        <input name="duration" type="number" min="1" required placeholder="30" className={fieldClass} />
      </div>
      <QuizToggle hasQuiz={hasQuiz} setHasQuiz={setHasQuiz} passingScore={passingScore} setPassingScore={setPassingScore} />
      <div>
        <label className={labelClass}>Fichier H5P</label>
        <FileDropZone accept=".h5p" label="Fichier .h5p" hint="Fichier .h5p · max 600 Mo" selectedFile={selectedFile} onFileChange={handleFileChange} />
      </div>
      {loading && <ProgressBar progress={progress} label="Upload en cours…" />}
      {duplicate && <DuplicateWarning info={duplicate} onConfirm={() => submit(true)} onCancel={() => setDuplicate(null)} />}
      {error && <ErrorBox message={error} />}
      <FormButtons loading={loading} label="Uploader le cours" onCancel={() => history.back()} />
    </form>
  );
}

// ─── Formulaire PPTX ─────────────────────────────────────────────────────────
function PPTXForm({ onSuccess, isAdmin, userId, creators }: { onSuccess: () => void; isAdmin: boolean; userId: string; creators: Creator[] }) {
  const [hasQuiz, setHasQuiz] = useState(false);
  const [passingScore, setPassingScore] = useState("70");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);
  const [createdById, setCreatedById] = useState(isAdmin ? "" : userId);
  const durationRef = React.useRef<HTMLInputElement>(null);

  function handleFileChange(f: File | null) {
    if (f && !f.name.toLowerCase().endsWith(".pptx")) {
      setError("Seuls les fichiers .pptx sont acceptés.");
      setSelectedFile(null);
      return;
    }
    setError(null);
    setDuplicate(null);
    setSelectedFile(f);
    if (f && !title) setTitle(f.name.replace(/\.pptx$/i, "").replace(/[_-]/g, " "));
  }

  async function submit(force = false) {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    setDuplicate(null);
    setProgress(0);
    setStatus("Upload…");

    const form = new FormData();
    form.append("file", selectedFile);
    form.append("title", title);
    form.append("duration", durationRef.current?.value ?? "30");
    form.append("hasQuiz", hasQuiz ? "on" : "");
    form.append("passingScore", passingScore);
    form.append("createdById", createdById);
    if (force) form.append("force", "true");

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (ev) => {
          if (ev.lengthComputable) {
            const p = Math.round((ev.loaded / ev.total) * 80);
            setProgress(p);
            if (p >= 80) setStatus("Conversion des slides en cours…");
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText);
            if (data.duplicate) {
              setDuplicate({ existingTitle: data.existingTitle, existingId: data.existingId });
              setLoading(false);
              reject(null);
            } else {
              setProgress(100);
              resolve();
            }
          } else {
            try { reject(new Error(JSON.parse(xhr.responseText).error ?? "Erreur serveur")); }
            catch { reject(new Error("Erreur serveur")); }
          }
        });
        xhr.addEventListener("error", () => reject(new Error("Erreur réseau")));
        xhr.open("POST", "/api/admin/courses/convert-pptx");
        xhr.send(form);
      });
      onSuccess();
    } catch (err) {
      if (err !== null) { setError(err instanceof Error ? err.message : "Erreur inconnue"); setLoading(false); }
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFile) { setError("Veuillez sélectionner un fichier .pptx."); return; }
    if (isAdmin && !createdById) { setError("Veuillez sélectionner un créateur."); return; }
    await submit(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <p className="text-[13px] text-blue-700 font-medium">Conversion automatique</p>
        <p className="text-[12px] text-blue-600 mt-0.5">
          Chaque slide devient une page interactive. Durée de conversion&nbsp;: ~30s/slide.
        </p>
      </div>
      {isAdmin && (
        <div>
          <label className={labelClass}>Créateur du cours</label>
          <select
            value={createdById}
            onChange={(e) => setCreatedById(e.target.value)}
            required
            className={fieldClass}
          >
            <option value="">— Sélectionner un manager / créateur —</option>
            {creators.map((c) => (
              <option key={c.id} value={c.id}>{c.name ?? c.email}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className={labelClass}>Titre du cours</label>
        <input
          name="title"
          required
          maxLength={255}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex : Formation sécurité réseau"
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass}>Durée estimée (minutes)</label>
        <input ref={durationRef} name="duration" type="number" min="1" required placeholder="30" className={fieldClass} />
      </div>
      <QuizToggle hasQuiz={hasQuiz} setHasQuiz={setHasQuiz} passingScore={passingScore} setPassingScore={setPassingScore} />
      <div>
        <label className={labelClass}>Fichier PowerPoint</label>
        <FileDropZone accept=".pptx" label="Fichier .pptx" hint="Fichier .pptx · max 200 Mo" selectedFile={selectedFile} onFileChange={handleFileChange} />
      </div>
      {loading && <ProgressBar progress={progress} label={status} />}
      {duplicate && <DuplicateWarning info={duplicate} onConfirm={() => submit(true)} onCancel={() => setDuplicate(null)} />}
      {error && <ErrorBox message={error} />}
      <FormButtons loading={loading} label={loading ? "Conversion en cours…" : "Convertir et publier"} onCancel={() => history.back()} />
    </form>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function DuplicateWarning({ info, onConfirm, onCancel }: { info: DuplicateInfo; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-3">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
        <div>
          <p className="text-[13px] font-medium text-amber-800">Ce fichier a déjà été uploadé</p>
          <p className="text-[12px] text-amber-700 mt-0.5">
            Il existe déjà sous le nom : <span className="font-semibold">« {info.existingTitle} »</span>
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 h-9 bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-medium rounded-lg transition-colors"
        >
          Publier quand même
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-9 border border-amber-300 text-amber-800 text-[13px] font-medium rounded-lg hover:bg-amber-100 transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
      <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
      <p className="text-[13px] text-red-600">{message}</p>
    </div>
  );
}

function FormButtons({ loading, label, onCancel }: { loading: boolean; label: string; onCancel: () => void }) {
  return (
    <div className="flex gap-3 pt-1">
      <button
        type="submit"
        disabled={loading}
        className="flex-1 h-11 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[15px] font-medium rounded-xl transition-colors disabled:opacity-60"
      >
        {label}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={loading}
        className="px-5 h-11 border border-[#D2D2D7] text-[#1D1D1F] text-[15px] font-medium rounded-xl hover:bg-[#F5F5F7] transition-colors disabled:opacity-60"
      >
        Annuler
      </button>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export function UploadForm({ isAdmin, userId, creators }: { isAdmin: boolean; userId: string; creators: Creator[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"h5p" | "pptx">("pptx");

  function onSuccess() {
    router.push("/dashboard/courses");
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-[#E5E5EA]">
        {(["pptx", "h5p"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex items-center gap-2 px-6 py-4 text-[14px] font-medium transition-all border-b-2",
              tab === t
                ? "border-[#0071E3] text-[#0071E3]"
                : "border-transparent text-[#6E6E73] hover:text-[#1D1D1F]"
            )}
          >
            {t === "h5p" ? (
              <><Upload className="w-4 h-4" /> Fichier H5P</>
            ) : (
              <><Presentation className="w-4 h-4" /> Importer un PPTX</>
            )}
          </button>
        ))}
      </div>

      <div className="p-7">
        <p className="text-[13px] text-[#6E6E73] mb-6">
          {tab === "h5p"
            ? "Uploadez un fichier .h5p existant."
            : "Convertissez un PowerPoint (.pptx) en cours interactif automatiquement."}
        </p>
        {tab === "h5p"
          ? <H5PForm onSuccess={onSuccess} isAdmin={isAdmin} userId={userId} creators={creators} />
          : <PPTXForm onSuccess={onSuccess} isAdmin={isAdmin} userId={userId} creators={creators} />}
      </div>
    </div>
  );
}
