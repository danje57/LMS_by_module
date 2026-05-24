"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { QuizEditor } from "@/components/courses/quiz-editor";
import { NativeVideoEditor, type NativeVideoEditorHandle } from "@/components/courses/native-video-editor";
import { ArrowLeft, Save, Upload, FileCheck } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface CourseData {
  id: string;
  title: string;
  category: string | null;
  duration: number;
  passingScore: number | null;
  hasQuiz: boolean;
  scoreVideoQuestions: boolean;
  showVideoAnswers: boolean;
  courseType: string;
  originalFileName: string;
  createdById: string | null;
}

interface NativeVideoData {
  id: string;
  videoPath: string;
  duration: number | null;
  questions: { id: string; timestamp: number; question: string; choices: { id: string; text: string; correct: boolean }[]; order: number; type?: "qcm" | "vrai_faux"; allowMultiple?: boolean; explanation?: string | null }[];
}

interface Creator { id: string; name: string | null; email: string }

const inputCls = "w-full h-10 px-3 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] text-[14px] dark:text-[#F5F5F7] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all";
const labelCls = "block text-[12px] font-medium text-[#6E6E73] dark:text-[#8E8E93] mb-1";

export function EditCourseForm({ isAdmin }: { isAdmin: boolean }) {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("courseStats");
  const [course, setCourse] = useState<CourseData | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState(0);
  const [hasQuiz, setHasQuiz] = useState(false);
  const [passingScore, setPassingScore] = useState(80);
  const [scoreVideoQuestions, setScoreVideoQuestions] = useState(false);
  const [showVideoAnswers, setShowVideoAnswers] = useState(true);
  const [createdById, setCreatedById] = useState<string>("");
  const [creators, setCreators] = useState<Creator[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [nativeVideo, setNativeVideo] = useState<NativeVideoData | null | undefined>(undefined);
  const nativeVideoEditorRef = useRef<NativeVideoEditorHandle>(null);
  const [h5pFile, setH5pFile] = useState<File | null>(null);
  const [h5pUploading, setH5pUploading] = useState(false);
  const [h5pProgress, setH5pProgress] = useState(0);
  const [h5pUploaded, setH5pUploaded] = useState(false);
  const [h5pError, setH5pError] = useState<string | null>(null);
  const [h5pDuplicate, setH5pDuplicate] = useState<{ existingTitle: string; existingId: string } | null>(null);
  const [pptxFile, setPptxFile] = useState<File | null>(null);
  const [pptxUploading, setPptxUploading] = useState(false);
  const [pptxProgress, setPptxProgress] = useState(0);
  const [pptxStatus, setPptxStatus] = useState("");
  const [pptxUploaded, setPptxUploaded] = useState(false);
  const [pptxError, setPptxError] = useState<string | null>(null);
  const [pptxDuplicate, setPptxDuplicate] = useState<{ existingTitle: string; existingId: string } | null>(null);

  useEffect(() => {
    fetch(`/api/admin/courses/${id}`)
      .then((r) => r.json())
      .then((data: CourseData) => {
        setCourse(data);
        setTitle(data.title);
        setCategory(data.category ?? "");
        setDuration(data.duration);
        setHasQuiz(data.hasQuiz);
        setPassingScore(data.passingScore ?? 80);
        setScoreVideoQuestions(data.scoreVideoQuestions ?? false);
        setShowVideoAnswers(data.showVideoAnswers ?? true);
        setCreatedById(data.createdById ?? "");
        if (data.courseType === "native_video") {
          fetch(`/api/courses/${id}/native-video`)
            .then(r => r.json())
            .then(d => setNativeVideo(d ?? null));
        } else {
          setNativeVideo(null);
        }
      });

    if (isAdmin) {
      fetch("/api/admin/users/creators")
        .then((r) => r.json())
        .then((data: Creator[]) => setCreators(data));
    }

  }, [id, isAdmin]);

  async function handleSave() {
    setSaving(true);
    await Promise.all([
      fetch(`/api/admin/courses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, duration, hasQuiz, passingScore: (hasQuiz || scoreVideoQuestions) ? passingScore : null, scoreVideoQuestions, showVideoAnswers, createdById }),
      }),
      nativeVideoEditorRef.current?.save(),
    ]);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleH5pReupload(force = false) {
    if (!h5pFile) return;
    setH5pUploading(true);
    setH5pProgress(0);
    setH5pError(null);
    setH5pDuplicate(null);

    const form = new FormData();
    form.append("file", h5pFile);
    if (force) form.append("force", "true");

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (ev) => {
      if (ev.lengthComputable) setH5pProgress(Math.round((ev.loaded / ev.total) * 100));
    });
    xhr.addEventListener("load", () => {
      setH5pUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        if (data.duplicate) { setH5pDuplicate({ existingTitle: data.existingTitle, existingId: data.existingId }); return; }
        setH5pUploaded(true);
        setH5pFile(null);
        setH5pProgress(0);
        setTimeout(() => setH5pUploaded(false), 3000);
      } else {
        try { setH5pError(JSON.parse(xhr.responseText).error ?? "Erreur serveur"); }
        catch { setH5pError("Erreur serveur"); }
      }
    });
    xhr.addEventListener("error", () => { setH5pUploading(false); setH5pError("Erreur réseau"); });
    xhr.open("POST", `/api/admin/courses/${id}/reupload-h5p`);
    xhr.send(form);
  }

  function handlePptxReupload(force = false) {
    if (!pptxFile) return;
    setPptxUploading(true);
    setPptxProgress(0);
    setPptxStatus("Upload en cours…");
    setPptxError(null);
    setPptxDuplicate(null);

    const form = new FormData();
    form.append("file", pptxFile);
    if (force) form.append("force", "true");

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (ev) => {
      if (ev.lengthComputable) {
        const pct = Math.round((ev.loaded / ev.total) * 80);
        setPptxProgress(pct);
        if (pct >= 80) setPptxStatus("Conversion en cours…");
      }
    });
    xhr.addEventListener("load", () => {
      setPptxUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        if (data.duplicate) { setPptxDuplicate({ existingTitle: data.existingTitle, existingId: data.existingId }); return; }
        setPptxProgress(100);
        setPptxUploaded(true);
        setPptxFile(null);
        setTimeout(() => { setPptxUploaded(false); setPptxProgress(0); }, 3000);
      } else {
        try { setPptxError(JSON.parse(xhr.responseText).error ?? "Erreur serveur"); }
        catch { setPptxError("Erreur serveur"); }
      }
    });
    xhr.addEventListener("error", () => { setPptxUploading(false); setPptxError("Erreur réseau"); });
    xhr.open("POST", `/api/admin/courses/${id}/reupload-pptx`);
    xhr.send(form);
  }

  const quizMissingQuestions = hasQuiz && questionCount === 0;

  function minQuestionsForScore(score: number): number {
    for (let n = 1; n <= 100; n++) {
      if (Math.round((Math.ceil((n * score) / 100) / n) * 100) === score) return n;
    }
    return 100;
  }
  const minQ = (hasQuiz || scoreVideoQuestions) ? minQuestionsForScore(passingScore) : null;

  if (!course) {
    return <div className="py-20 text-center text-[13px] text-[#6E6E73]">Chargement…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/courses"
          className="p-2 rounded-xl border border-[#D2D2D7] dark:border-[#3A3A3C] text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-[#ADADB8] dark:text-[#636366] font-medium">Édition du cours</p>
          <h1 className="text-[18px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">{course.title}</h1>
        </div>
      </div>


      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] divide-y divide-[#F5F5F7] dark:divide-[#3A3A3C]">
        <div className="p-6 space-y-4">
          <h2 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Informations</h2>
          {isAdmin && (
            <div>
              <label className={labelCls}>Créateur du cours</label>
              <select value={createdById} onChange={(e) => setCreatedById(e.target.value)} className={inputCls}>
                <option value="">— Aucun —</option>
                {creators.map((c) => (
                  <option key={c.id} value={c.id}>{c.name ?? c.email}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={labelCls}>Titre</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </div>
          {category && (
            <div>
              <label className={labelCls}>Département</label>
              <p className="text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] h-10 flex items-center px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E]">
                {category}
              </p>
            </div>
          )}
          <div>
            <label className={labelCls}>Durée (minutes)</label>
            <input type="number" min={1} value={duration}
              onChange={(e) => setDuration(Number(e.target.value))} className={inputCls} />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={hasQuiz} onChange={(e) => setHasQuiz(e.target.checked)}
              className="w-4 h-4 rounded accent-[#0071E3]" />
            <span className="text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] font-medium">Ce cours contient un quiz (fin de vidéo)</span>
          </label>

          {course.courseType === "native_video" && (
            <>
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setScoreVideoQuestions(v => !v)}
                  className={cn(
                    "relative shrink-0 w-11 h-6 rounded-full transition-colors mt-0.5",
                    scoreVideoQuestions ? "bg-[#0071E3]" : "bg-[#D2D2D7] dark:bg-[#3A3A3C]"
                  )}
                  aria-pressed={scoreVideoQuestions}
                >
                  <span className={cn(
                    "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform",
                    scoreVideoQuestions && "translate-x-5"
                  )} />
                </button>
                <div>
                  <p className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">Comptabiliser le score des questions vidéo</p>
                  <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
                    Score calculé sur les questions dans la vidéo, comparé au seuil. Les bonnes réponses ne sont pas révélées (✓ / ✗ uniquement).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setShowVideoAnswers(v => !v)}
                  className={cn(
                    "relative shrink-0 w-11 h-6 rounded-full transition-colors mt-0.5",
                    showVideoAnswers ? "bg-[#0071E3]" : "bg-[#D2D2D7] dark:bg-[#3A3A3C]"
                  )}
                  aria-pressed={showVideoAnswers}
                >
                  <span className={cn(
                    "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform",
                    showVideoAnswers && "translate-x-5"
                  )} />
                </button>
                <div>
                  <p className="text-[14px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">Révéler les bonnes réponses dans la vidéo</p>
                  <p className="text-[12px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
                    Activé : la bonne réponse est colorée en vert/rouge et l&apos;apprenant peut réessayer. Désactivé : seul ✓ ou ✗ est affiché, sans possibilité de réessayer.
                  </p>
                </div>
              </div>
            </>
          )}

          {(hasQuiz || scoreVideoQuestions) && (
            <div className="max-w-[220px]">
              <label className={labelCls}>Seuil de passage (%)</label>
              <input type="number" min={0} max={100} value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value))} className={inputCls} />
            </div>
          )}

          {(() => {
            const videoCount = nativeVideo?.questions?.length ?? 0;
            if (!scoreVideoQuestions || videoCount === 0) return null;
            // Quand hasQuiz+scoreVideoQuestions : seuil calculé sur le total combiné
            const combined = hasQuiz && questionCount > 0;
            const totalCount = combined ? videoCount + questionCount : videoCount;
            const minCorrect = Math.ceil(totalCount * passingScore / 100);
            const effective = Math.round((minCorrect / totalCount) * 100);
            const diff = effective - passingScore;
            const minQTotal = minQuestionsForScore(passingScore);
            if (diff === 0) return (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 dark:bg-emerald-500/10 border border-green-100 dark:border-emerald-500/20 rounded-xl text-[12px] text-green-700 dark:text-emerald-400">
                <span className="font-medium">{combined ? "Score combiné (vidéo + quiz)" : "Questions vidéo"} :</span>
                {" "}{minCorrect}/{totalCount} correctes requises — seuil effectif {effective}%.
              </div>
            );
            return (
              <div className={cn("px-4 py-2.5 rounded-xl border text-[12px] space-y-0.5",
                diff >= 10
                  ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-400"
                  : "bg-blue-50 dark:bg-[#0071E3]/10 border-blue-100 dark:border-[#0071E3]/20 text-blue-800 dark:text-blue-400"
              )}>
                <p>
                  <span className="font-semibold">
                    {combined ? `Score combiné (${videoCount} vidéo + ${questionCount} quiz)` : `Questions vidéo`} — seuil effectif : {effective}%
                  </span>
                  {" "}— il faut <span className="font-semibold">{minCorrect}/{totalCount}</span> bonne{minCorrect > 1 ? "s" : ""} réponse{minCorrect > 1 ? "s" : ""}.
                </p>
                {minQTotal > totalCount && (
                  <p className="text-[11px] opacity-80">
                    Pour {passingScore}% exact, ajoutez{" "}
                    <span className="font-semibold">{minQTotal - totalCount} question{minQTotal - totalCount > 1 ? "s" : ""}</span>
                    {combined ? " (dans la vidéo ou dans le quiz)" : " dans la vidéo"} ({minQTotal} au total).
                  </p>
                )}
              </div>
            );
          })()}
          <div className="flex items-center justify-between pt-1">
            {quizMissingQuestions && (
              <p className="text-[12px] text-amber-700">Ajoutez au moins une question pour activer le quiz.</p>
            )}
            <div className="ml-auto">
              <button onClick={handleSave} disabled={saving}
                className={cn(
                  "flex items-center gap-1.5 px-5 h-9 text-[13px] font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                  saved ? "bg-green-500 text-white" : "bg-[#0071E3] hover:bg-[#0077ED] text-white"
                )}>
                <Save className="w-3.5 h-3.5" />
                {saving ? "Enregistrement…" : saved ? "Enregistré !" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>

        {course.courseType === "h5p" && course.originalFileName.toLowerCase().endsWith(".pptx") && (
          <div className="p-6 space-y-4">
            <h2 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Fichier PowerPoint</h2>
            <label className={cn(
              "flex items-center gap-3 cursor-pointer border-2 border-dashed rounded-xl px-4 py-4 transition-colors",
              pptxUploading && "pointer-events-none opacity-50",
              pptxFile ? "border-[#0071E3] bg-blue-50 dark:bg-[#0071E3]/10" : "border-[#D2D2D7] dark:border-[#3A3A3C] hover:border-[#0071E3]"
            )}>
              {pptxFile ? <FileCheck className="w-5 h-5 text-[#0071E3] shrink-0" /> : <Upload className="w-5 h-5 text-[#ADADB8] shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] truncate">
                  {pptxFile ? pptxFile.name : "Sélectionner un nouveau fichier .pptx"}
                </p>
                {pptxFile && <p className="text-[11px] text-[#ADADB8] mt-0.5">{(pptxFile.size / 1024 / 1024).toFixed(1)} Mo</p>}
              </div>
              <input type="file" accept=".pptx" className="hidden" disabled={pptxUploading}
                onChange={e => { setPptxFile(e.target.files?.[0] ?? null); setPptxError(null); setPptxUploaded(false); }} />
            </label>

            {pptxUploading && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[12px] text-[#6E6E73]">
                  <span>{pptxStatus}</span>
                  <span className="font-medium text-[#0071E3]">{pptxProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-[#F2F2F7] rounded-full overflow-hidden">
                  <div className="h-full bg-[#0071E3] rounded-full transition-all duration-300" style={{ width: `${pptxProgress}%` }} />
                </div>
              </div>
            )}

            {pptxUploaded && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-100 rounded-xl text-[13px] text-green-700 font-medium">
                ✓ Fichier PowerPoint reconverti avec succès
              </div>
            )}

            {pptxDuplicate && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 space-y-3">
                <p className="text-[13px] font-medium text-amber-800">Ce fichier est déjà utilisé par le cours <span className="font-semibold">« {pptxDuplicate.existingTitle} »</span>.</p>
                <div className="flex gap-2">
                  <button onClick={() => handlePptxReupload(true)} className="flex-1 h-9 bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-medium rounded-lg transition-colors">Reconvertir quand même</button>
                  <button onClick={() => setPptxDuplicate(null)} className="flex-1 h-9 border border-amber-300 text-amber-800 text-[13px] font-medium rounded-lg hover:bg-amber-100 transition-colors">Annuler</button>
                </div>
              </div>
            )}

            {pptxError && (
              <div className="px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-[12px] text-red-600">{pptxError}</div>
            )}

            {pptxFile && !pptxUploading && !pptxDuplicate && (
              <button onClick={() => handlePptxReupload()}
                className="flex items-center gap-1.5 px-5 h-9 text-[13px] font-medium rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white transition-colors">
                <Upload className="w-3.5 h-3.5" />
                Reconvertir et remplacer
              </button>
            )}
          </div>
        )}

        {course.courseType === "native_video" && (
          <div className="p-6 space-y-4">
            <h2 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Vidéo &amp; Questions</h2>

            {nativeVideo === undefined ? (
              <p className="text-[13px] text-[#6E6E73]">Chargement…</p>
            ) : (
              <NativeVideoEditor
                ref={nativeVideoEditorRef}
                key={nativeVideo?.id ?? "new"}
                courseId={id}
                initialVideoId={nativeVideo?.id}
                initialQuestions={nativeVideo?.questions ?? []}
                onSaved={() => { setSaved(true); setTimeout(() => setSaved(false), 2500); }}
              />
            )}
          </div>
        )}

        {course.courseType === "h5p" && course.originalFileName.toLowerCase().endsWith(".h5p") && (
          <div className="p-6 space-y-4">
            <h2 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Fichier H5P</h2>
            <label className={cn(
              "flex items-center gap-3 cursor-pointer border-2 border-dashed rounded-xl px-4 py-4 transition-colors",
              h5pUploading && "pointer-events-none opacity-50",
              h5pFile ? "border-[#0071E3] bg-blue-50 dark:bg-[#0071E3]/10" : "border-[#D2D2D7] dark:border-[#3A3A3C] hover:border-[#0071E3]"
            )}>
              {h5pFile ? <FileCheck className="w-5 h-5 text-[#0071E3] shrink-0" /> : <Upload className="w-5 h-5 text-[#ADADB8] shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] truncate">
                  {h5pFile ? h5pFile.name : "Sélectionner un nouveau fichier .h5p"}
                </p>
                {h5pFile && <p className="text-[11px] text-[#ADADB8] mt-0.5">{(h5pFile.size / 1024 / 1024).toFixed(1)} Mo</p>}
              </div>
              <input type="file" accept=".h5p" className="hidden" disabled={h5pUploading}
                onChange={e => { setH5pFile(e.target.files?.[0] ?? null); setH5pError(null); setH5pUploaded(false); }} />
            </label>

            {h5pUploading && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[12px] text-[#6E6E73]">
                  <span>Upload en cours…</span>
                  <span className="font-medium text-[#0071E3]">{h5pProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-[#F2F2F7] rounded-full overflow-hidden">
                  <div className="h-full bg-[#0071E3] rounded-full transition-all duration-300" style={{ width: `${h5pProgress}%` }} />
                </div>
              </div>
            )}

            {h5pUploaded && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-100 rounded-xl text-[13px] text-green-700 font-medium">
                ✓ Fichier H5P mis à jour avec succès
              </div>
            )}

            {h5pDuplicate && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 space-y-3">
                <p className="text-[13px] font-medium text-amber-800">Ce fichier est déjà utilisé par le cours <span className="font-semibold">« {h5pDuplicate.existingTitle} »</span>.</p>
                <div className="flex gap-2">
                  <button onClick={() => handleH5pReupload(true)} className="flex-1 h-9 bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-medium rounded-lg transition-colors">Remplacer quand même</button>
                  <button onClick={() => setH5pDuplicate(null)} className="flex-1 h-9 border border-amber-300 text-amber-800 text-[13px] font-medium rounded-lg hover:bg-amber-100 transition-colors">Annuler</button>
                </div>
              </div>
            )}

            {h5pError && (
              <div className="px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-[12px] text-red-600">{h5pError}</div>
            )}

            {h5pFile && !h5pUploading && !h5pDuplicate && (
              <button onClick={() => handleH5pReupload()}
                className="flex items-center gap-1.5 px-5 h-9 text-[13px] font-medium rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white transition-colors">
                <Upload className="w-3.5 h-3.5" />
                Remplacer le fichier H5P
              </button>
            )}
          </div>
        )}

        <div className="p-6 space-y-4">
            <h2 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Questions du quiz</h2>
            <QuizEditor courseId={id} passingScore={passingScore} onCountChange={(n) => { setQuestionCount(n); if (n > 0 && !hasQuiz) setHasQuiz(true); }} />
            <div className="flex items-center justify-between pt-2 border-t border-[#F5F5F7] dark:border-[#3A3A3C] mt-4">
              <div className="ml-auto">
                <button onClick={handleSave} disabled={saving}
                  className={cn(
                    "flex items-center gap-1.5 px-5 h-9 text-[13px] font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                    saved ? "bg-green-500 text-white" : "bg-[#0071E3] hover:bg-[#0077ED] text-white"
                  )}>
                  <Save className="w-3.5 h-3.5" />
                  {saving ? "Enregistrement…" : saved ? "Enregistré !" : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
