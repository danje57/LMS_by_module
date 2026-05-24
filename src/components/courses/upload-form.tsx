"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileCheck, Presentation, ExternalLink, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const fieldClass =
  "w-full h-11 px-3.5 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] outline-none transition-all focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20";
const labelClass = "block text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] mb-1.5";

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
  const t = useTranslations("upload");
  return (
    <>
      <div className="flex items-center justify-between bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-xl px-4 py-3">
        <div>
          <p className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{t("hasQuiz")}</p>
          <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">{t("passingScoreRequired")}</p>
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
          <label className={labelClass}>{t("passingScore")}</label>
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
  const t = useTranslations("upload");
  return (
    <label
      htmlFor="file"
      className={cn(
        "flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-colors",
        selectedFile
          ? "border-[#0071E3]/40 bg-blue-50/40 dark:bg-[#0071E3]/10"
          : "border-[#D2D2D7] dark:border-[#3A3A3C] hover:border-[#0071E3]/40 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]"
      )}
    >
      {selectedFile ? (
        <>
          <FileCheck className="w-8 h-8 text-[#0071E3]" />
          <div className="text-center">
            <p className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{selectedFile.name}</p>
            <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">{(selectedFile.size / 1024 / 1024).toFixed(1)} Mo</p>
          </div>
        </>
      ) : (
        <>
          <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center justify-center">
            <Upload className="w-5 h-5 text-[#8E8E93]" />
          </div>
          <div className="text-center">
            <p className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{t("clickToSelect")}</p>
            <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">{hint}</p>
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
      <div className="flex justify-between text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">
        <span>{label}</span>
        <span className="font-medium text-[#0071E3]">{progress}%</span>
      </div>
      <div className="h-1.5 bg-[#F5F5F7] dark:bg-[#3A3A3C] rounded-full overflow-hidden">
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
function H5PForm({ onSuccess, isAdmin, userId, creators }: { onSuccess: (courseId: string) => void; isAdmin: boolean; userId: string; creators: Creator[] }) {
  const t = useTranslations("upload");
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
      setError(t("onlyH5p"));
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
      const courseId = await new Promise<string>((resolve, reject) => {
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
              resolve(data.courseId as string);
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
      onSuccess(courseId);
    } catch (err) {
      if (err !== null) { setError(err instanceof Error ? err.message : "Erreur inconnue"); setLoading(false); }
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFile) { setError(t("selectH5p")); return; }
    await submit(false);
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      {isAdmin ? (
        <div>
          <label className={labelClass}>{t("courseCreator")}</label>
          <select name="createdById" required className={fieldClass}>
            <option value="">{t("selectCreator")}</option>
            {creators.map((c) => (
              <option key={c.id} value={c.id}>{c.name ?? c.email}</option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="createdById" value={userId} />
      )}
      <div>
        <label className={labelClass}>{t("courseTitle")}</label>
        <input name="title" required maxLength={255} placeholder={t("titlePlaceholder")} className={fieldClass} />
      </div>
      <div>
        <label className={labelClass}>{t("duration")}</label>
        <input name="duration" type="number" min="1" required placeholder="30" className={fieldClass} />
      </div>
      <QuizToggle hasQuiz={hasQuiz} setHasQuiz={setHasQuiz} passingScore={passingScore} setPassingScore={setPassingScore} />

      {/* Tip Lumi Desktop */}
      <div className="flex items-start gap-3 bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-xl px-4 py-3">
        <div className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] leading-relaxed">
          {t("lumiTip")}{" "}
          <a
            href="https://lumi.education"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[#0071E3] hover:underline font-medium"
          >
            {t("lumiDownload")}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("uploadFile")}</label>
        <FileDropZone accept=".h5p" label={t("uploadFile")} hint={t("h5pFile")} selectedFile={selectedFile} onFileChange={handleFileChange} />
      </div>
      {loading && <ProgressBar progress={progress} label={t("uploading")} />}
      {duplicate && <DuplicateWarning info={duplicate} onConfirm={() => submit(true)} onCancel={() => setDuplicate(null)} />}
      {error && <ErrorBox message={error} />}
      <FormButtons loading={loading} label={t("uploadCourse")} onCancel={() => history.back()} />
    </form>
  );
}

// ─── Formulaire PPTX ─────────────────────────────────────────────────────────
function PPTXForm({ onSuccess, isAdmin, userId, creators }: { onSuccess: (courseId: string) => void; isAdmin: boolean; userId: string; creators: Creator[] }) {
  const t = useTranslations("upload");
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
      setError(t("onlyPptx"));
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
      const courseId = await new Promise<string>((resolve, reject) => {
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
              resolve(data.courseId as string);
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
      onSuccess(courseId);
    } catch (err) {
      if (err !== null) { setError(err instanceof Error ? err.message : "Erreur inconnue"); setLoading(false); }
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFile) { setError(t("selectPptx")); return; }
    if (isAdmin && !createdById) { setError(t("selectCreatorError")); return; }
    await submit(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-blue-50 dark:bg-[#0071E3]/10 border border-blue-100 dark:border-[#0071E3]/20 rounded-xl px-4 py-3">
        <p className="text-[13px] text-blue-700 dark:text-blue-400 font-medium">{t("autoConversion")}</p>
        <p className="text-[12px] text-blue-600 dark:text-blue-400 mt-0.5">
          {t("conversionDesc")}
        </p>
      </div>
      {isAdmin && (
        <div>
          <label className={labelClass}>{t("courseCreator")}</label>
          <select
            value={createdById}
            onChange={(e) => setCreatedById(e.target.value)}
            required
            className={fieldClass}
          >
            <option value="">{t("selectCreator")}</option>
            {creators.map((c) => (
              <option key={c.id} value={c.id}>{c.name ?? c.email}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className={labelClass}>{t("courseTitle")}</label>
        <input
          name="title"
          required
          maxLength={255}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("titlePlaceholderPptx")}
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass}>{t("estimatedDuration")}</label>
        <input ref={durationRef} name="duration" type="number" min="1" required placeholder="30" className={fieldClass} />
      </div>
      <QuizToggle hasQuiz={hasQuiz} setHasQuiz={setHasQuiz} passingScore={passingScore} setPassingScore={setPassingScore} />
      <div>
        <label className={labelClass}>{t("powerpointFile")}</label>
        <FileDropZone accept=".pptx" label={t("powerpointFile")} hint={t("pptxFile")} selectedFile={selectedFile} onFileChange={handleFileChange} />
      </div>
      {loading && <ProgressBar progress={progress} label={status} />}
      {duplicate && <DuplicateWarning info={duplicate} onConfirm={() => submit(true)} onCancel={() => setDuplicate(null)} />}
      {error && <ErrorBox message={error} />}
      <FormButtons loading={loading} label={loading ? t("converting") : t("convertAndPublish")} onCancel={() => history.back()} />
    </form>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function DuplicateWarning({ info, onConfirm, onCancel }: { info: DuplicateInfo; onConfirm: () => void; onCancel: () => void }) {
  const t = useTranslations("upload");
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 space-y-3">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
        <div>
          <p className="text-[13px] font-medium text-amber-800">{t("duplicateFile")}</p>
          <p className="text-[12px] text-amber-700 mt-0.5">
            {t("existsAs", { title: info.existingTitle })}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 h-9 bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-medium rounded-lg transition-colors"
        >
          {t("publishAnyway")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-9 border border-amber-300 text-amber-800 text-[13px] font-medium rounded-lg hover:bg-amber-100 transition-colors"
        >
          {t("cancel") ?? "Annuler"}
        </button>
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl px-4 py-3">
      <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
      <p className="text-[13px] text-red-600">{message}</p>
    </div>
  );
}

function FormButtons({ loading, label, onCancel }: { loading: boolean; label: string; onCancel: () => void }) {
  const t = useTranslations("upload");
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
        className="px-5 h-11 border border-[#D2D2D7] dark:border-[#3A3A3C] text-[#1D1D1F] dark:text-[#F5F5F7] text-[15px] font-medium rounded-xl hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors disabled:opacity-60"
      >
        {t("cancel") ?? "Annuler"}
      </button>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
function NativeVideoForm({ onSuccess, isAdmin, userId, creators }: { onSuccess: (courseId: string) => void; isAdmin: boolean; userId: string; creators: Creator[] }) {
  const t = useTranslations("upload");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("30");
  const [createdById, setCreatedById] = useState(userId);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);
  const [scoreVideoQuestions, setScoreVideoQuestions] = useState(false);
  const [showVideoAnswers, setShowVideoAnswers] = useState(true);
  const [passingScore, setPassingScore] = useState("70");
  const pendingCourseId = React.useRef<string | null>(null);

  async function uploadVideo(courseId: string, force = false) {
    if (!videoFile) return;
    setStep(t("uploadingVideo"));
    const form = new FormData();
    form.append("video", videoFile);
    if (force) form.append("force", "true");
    const res = await fetch(`/api/courses/${courseId}/native-video`, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) { setError(t("videoUploadError")); setLoading(false); return; }
    if (data.duplicate) {
      pendingCourseId.current = courseId;
      setDuplicate({ existingTitle: data.existingTitle, existingId: data.existingId });
      setLoading(false);
      return;
    }
    setLoading(false);
    onSuccess(courseId);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!videoFile) { setError(t("selectVideo")); return; }
    setLoading(true);
    setError("");
    setDuplicate(null);

    setStep(t("creating"));
    const res = await fetch("/api/admin/courses/create-native-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, duration, createdById, scoreVideoQuestions, showVideoAnswers, passingScore: scoreVideoQuestions ? passingScore : undefined }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Erreur"); setLoading(false); return; }

    await uploadVideo(data.courseId);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {isAdmin && (
        <div>
          <label className={labelClass}>{t("creator")}</label>
          <select value={createdById} onChange={e => setCreatedById(e.target.value)} className={fieldClass}>
            {creators.map(c => <option key={c.id} value={c.id}>{c.name ?? c.email}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className={labelClass}>{t("courseTitle")}</label>
        <input required value={title} onChange={e => setTitle(e.target.value)} className={fieldClass} placeholder={t("courseTitlePlaceholder")} />
      </div>
      <div>
        <label className={labelClass}>{t("duration")}</label>
        <input type="number" min={1} required value={duration} onChange={e => setDuration(e.target.value)} className={fieldClass} />
      </div>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setScoreVideoQuestions(v => !v)}
          className={`relative shrink-0 w-11 h-6 rounded-full transition-colors mt-0.5 ${scoreVideoQuestions ? "bg-[#0071E3]" : "bg-[#D2D2D7] dark:bg-[#3A3A3C]"}`}
          aria-pressed={scoreVideoQuestions}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${scoreVideoQuestions ? "translate-x-5" : ""}`} />
        </button>
        <div>
          <p className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">Comptabiliser le score des questions vidéo</p>
          <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
            Le score est calculé sur les questions dans la vidéo et comparé au seuil de passage. Les bonnes réponses ne sont pas révélées.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setShowVideoAnswers(v => !v)}
          className={`relative shrink-0 w-11 h-6 rounded-full transition-colors mt-0.5 ${showVideoAnswers ? "bg-[#0071E3]" : "bg-[#D2D2D7] dark:bg-[#3A3A3C]"}`}
          aria-pressed={showVideoAnswers}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${showVideoAnswers ? "translate-x-5" : ""}`} />
        </button>
        <div>
          <p className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">Révéler les bonnes réponses dans la vidéo</p>
          <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
            Activé : la bonne réponse est colorée et l&apos;apprenant peut réessayer. Désactivé : seul ✓ ou ✗ est affiché, sans possibilité de réessayer.
          </p>
        </div>
      </div>
      {scoreVideoQuestions && (
        <div className="max-w-[200px]">
          <label className={labelClass}>Seuil de passage (%)</label>
          <input
            type="number" min={0} max={100} value={passingScore}
            onChange={e => setPassingScore(e.target.value)}
            className={fieldClass}
          />
        </div>
      )}
      <div>
        <label className={labelClass}>{t("videoFile")}</label>
        <label className={`flex items-center gap-3 cursor-pointer border-2 border-dashed rounded-xl px-4 py-5 transition-colors ${videoFile ? "border-[#0071E3] bg-blue-50 dark:bg-blue-500/10" : "border-[#D2D2D7] dark:border-[#3A3A3C] hover:border-[#0071E3]"}`}>
          <FileCheck className={`w-5 h-5 shrink-0 ${videoFile ? "text-[#0071E3]" : "text-[#ADADB8]"}`} />
          <span className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] truncate">
            {videoFile ? videoFile.name : t("clickToSelectVideo")}
          </span>
          <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden"
            onChange={e => { setVideoFile(e.target.files?.[0] ?? null); setError(""); }} />
        </label>
        <p className="text-[11px] text-[#ADADB8] mt-1">{t("videoFormats")}</p>
      </div>
      {error && <p className="text-[13px] text-red-600">{error}</p>}
      {duplicate && (
        <DuplicateWarning
          info={duplicate}
          onConfirm={() => {
            setDuplicate(null);
            setLoading(true);
            void uploadVideo(pendingCourseId.current!, true);
          }}
          onCancel={() => setDuplicate(null)}
        />
      )}
      <button type="submit" disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-50 text-white text-[14px] font-medium rounded-xl transition-colors">
        {loading ? step : t("createAndEdit")}
      </button>
    </form>
  );
}

export function UploadForm({ isAdmin, userId, creators }: { isAdmin: boolean; userId: string; creators: Creator[] }) {
  const t = useTranslations("upload");
  const router = useRouter();
  const [tab, setTab] = useState<"h5p" | "pptx" | "native_video">("pptx");

  function onSuccess(courseId: string) {
    router.push(`/dashboard/admin/courses/${courseId}/edit`);
    router.refresh();
  }

  const tabs = [
    { key: "pptx" as const, label: t("importPptx"), icon: <Presentation className="w-4 h-4" /> },
    { key: "h5p" as const, label: t("uploadFile"), icon: <Upload className="w-4 h-4" /> },
    { key: "native_video" as const, label: t("nativeVideo"), icon: <Video className="w-4 h-4" /> },
  ];

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-[#E5E5EA] dark:border-[#3A3A3C]">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 px-6 py-4 text-[14px] font-medium transition-all border-b-2",
              tab === key
                ? "border-[#0071E3] text-[#0071E3]"
                : "border-transparent text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
            )}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      <div className="p-7">
        <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] mb-6">
          {tab === "h5p" ? t("uploadExistingH5p") : tab === "pptx" ? t("convertPptx") : t("nativeVideoDesc")}
        </p>
        {tab === "h5p" && <H5PForm onSuccess={onSuccess} isAdmin={isAdmin} userId={userId} creators={creators} />}
        {tab === "pptx" && <PPTXForm onSuccess={onSuccess} isAdmin={isAdmin} userId={userId} creators={creators} />}
        {tab === "native_video" && <NativeVideoForm onSuccess={onSuccess} isAdmin={isAdmin} userId={userId} creators={creators} />}
      </div>
    </div>
  );
}
