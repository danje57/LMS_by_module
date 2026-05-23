"use client";

import { useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { Plus, Trash2, GripVertical, Clock, Upload, Loader2, Check, PlusCircle, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type QuestionType = "qcm" | "vrai_faux";
const LETTERS = ["A","B","C","D","E","F","G","H","I","J"] as const;

interface Choice { id: string; text: string; correct: boolean; }
interface Question {
  id: string;
  timestamp: number;
  question: string;
  choices: Choice[];
  order: number;
  type: QuestionType;
  allowMultiple: boolean;
  explanation: string | null;
}

type PartialQuestion = Omit<Question, "type" | "allowMultiple" | "explanation"> & {
  type?: QuestionType;
  allowMultiple?: boolean;
  explanation?: string | null;
};

interface Props {
  courseId: string;
  initialVideoId?: string;
  initialQuestions?: PartialQuestion[];
  onSaved?: () => void;
}

const fieldCls = "w-full text-[13px] border border-[#E5E5EA] dark:border-[#3A3A3C] rounded-xl px-3 py-2 bg-white dark:bg-[#2C2C2E] dark:text-[#F5F5F7] focus:outline-none focus:border-[#0071E3] transition-colors";
const labelCls = "block text-[11px] font-medium text-[#6E6E73] dark:text-[#8E8E93] uppercase tracking-wide mb-1";

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function newChoice(text = "", correct = false): Choice {
  return { id: uid(), text, correct };
}

function newQuestion(timestamp: number, order: number): Question {
  return {
    id: uid(),
    timestamp,
    question: "",
    choices: [newChoice(), newChoice(), newChoice(), newChoice()],
    order,
    type: "qcm",
    allowMultiple: false,
    explanation: null,
  };
}

export interface NativeVideoEditorHandle {
  save: () => Promise<boolean>;
}

export const NativeVideoEditor = forwardRef<NativeVideoEditorHandle, Props>(function NativeVideoEditor({ courseId, initialVideoId, initialQuestions, onSaved }, ref) {
  const t = useTranslations("nativeVideoEditor");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(
    initialVideoId ? `/api/native-video/${initialVideoId}/stream` : null
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>(
    (initialQuestions ?? []).map(q => ({
      ...q,
      type: q.type ?? "qcm",
      allowMultiple: q.allowMultiple ?? false,
      explanation: q.explanation ?? null,
    }))
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeQ = questions.find(q => q.id === activeId) ?? null;

  const handleVideoUpload = useCallback(async (file: File) => {
    setUploading(true);
    const form = new FormData();
    form.append("video", file);
    const res = await fetch(`/api/courses/${courseId}/native-video`, { method: "POST", body: form });
    const data = await res.json();
    if (res.ok) {
      setVideoSrc(`/api/native-video/${data.id}/stream`);
    }
    setUploading(false);
  }, [courseId]);

  function addQuestion() {
    const ts = videoRef.current?.currentTime ?? 0;
    const q = newQuestion(ts, questions.length);
    setQuestions(prev => [...prev, q].sort((a, b) => a.timestamp - b.timestamp));
    setActiveId(q.id);
  }

  function removeQuestion(id: string) {
    setQuestions(prev => prev.filter(q => q.id !== id));
    if (activeId === id) setActiveId(null);
  }

  function updateQuestion(id: string, patch: Partial<Question>) {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
  }

  function changeType(qId: string, type: QuestionType) {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q;
      if (type === "vrai_faux") {
        return { ...q, type, allowMultiple: false, choices: [newChoice("Vrai"), newChoice("Faux")] };
      }
      const wasVraiFaux = q.choices.length === 2 && q.choices.every(c => c.text === "Vrai" || c.text === "Faux");
      return { ...q, type, choices: wasVraiFaux ? [newChoice(), newChoice(), newChoice(), newChoice()] : q.choices };
    }));
  }

  function toggleCorrect(qId: string, cId: string, allowMultiple: boolean) {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q;
      if (allowMultiple) {
        return { ...q, choices: q.choices.map(c => c.id === cId ? { ...c, correct: !c.correct } : c) };
      }
      return { ...q, choices: q.choices.map(c => ({ ...c, correct: c.id === cId })) };
    }));
  }

  function setVraiFauxCorrect(qId: string, cId: string) {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q;
      return { ...q, choices: q.choices.map(c => ({ ...c, correct: c.id === cId })) };
    }));
  }

  function updateChoice(qId: string, cId: string, patch: Partial<Choice>) {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q;
      return { ...q, choices: q.choices.map(c => c.id === cId ? { ...c, ...patch } : c) };
    }));
  }

  function addChoice(qId: string) {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId || q.choices.length >= 10) return q;
      return { ...q, choices: [...q.choices, newChoice()] };
    }));
  }

  function removeChoice(qId: string, cId: string) {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId || q.choices.length <= 2) return q;
      return { ...q, choices: q.choices.filter(c => c.id !== cId) };
    }));
  }

  function validate(): string | null {
    for (const q of questions) {
      if (!q.question.trim()) return `Question à ${formatTime(q.timestamp)} : le texte est vide.`;
      if (q.type === "qcm") {
        if (q.choices.some(c => !c.text.trim())) return `Question à ${formatTime(q.timestamp)} : tous les choix doivent être remplis.`;
        if (!q.choices.some(c => c.correct)) return `Question à ${formatTime(q.timestamp)} : aucune bonne réponse sélectionnée.`;
      }
      if (q.type === "vrai_faux") {
        if (!q.choices.some(c => c.correct)) return `Question à ${formatTime(q.timestamp)} : sélectionnez Vrai ou Faux comme bonne réponse.`;
      }
    }
    return null;
  }

  async function save(): Promise<boolean> {
    if (questions.length === 0) return true;
    const err = validate();
    if (err) { setSaveError(err); return false; }
    setSaveError(null);
    setSaving(true);
    const duration = videoRef.current?.duration ?? null;
    await fetch(`/api/courses/${courseId}/native-video`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions, duration }),
    });
    setSaving(false);
    onSaved?.();
    return true;
  }

  useImperativeHandle(ref, () => ({ save }));

  return (
    <div className="space-y-4">
      {/* Zone vidéo */}
      <div className="relative bg-black rounded-2xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
        {videoSrc ? (
          <video ref={videoRef} src={videoSrc} controls className="w-full h-full" preload="metadata" />
        ) : (
          <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer gap-3 text-white/60 hover:text-white/80 transition-colors">
            <Upload className="w-10 h-10" />
            <span className="text-[13px]">{t("uploadVideo")}</span>
            <input
              type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleVideoUpload(e.target.files[0]); }}
            />
          </label>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Remplacer vidéo */}
      {videoSrc && (
        <label className="flex items-center gap-2 text-[12px] text-[#6E6E73] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] cursor-pointer w-fit">
          <Upload className="w-3.5 h-3.5" />
          {t("replaceVideo")}
          <input
            type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleVideoUpload(e.target.files[0]); }}
          />
        </label>
      )}

      {/* Barre questions */}
      {videoSrc && (
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            {t("questions", { count: questions.length })}
          </h3>
          <button
            onClick={addQuestion}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[12px] font-medium rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("addQuestion")}
          </button>
        </div>
      )}

      {/* Liste questions */}
      {questions.length > 0 && (
        <div className="space-y-1">
          {questions.map(q => (
            <button
              key={q.id}
              onClick={() => { setActiveId(q.id === activeId ? null : q.id); videoRef.current && (videoRef.current.currentTime = q.timestamp); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border",
                activeId === q.id
                  ? "bg-blue-50 dark:bg-[#0071E3]/10 border-[#0071E3]/30"
                  : "bg-white dark:bg-[#1C1C1E] border-[#E5E5EA] dark:border-[#3A3A3C] hover:border-[#ADADB8]"
              )}
            >
              <GripVertical className="w-3.5 h-3.5 text-[#ADADB8] shrink-0" />
              <Clock className="w-3.5 h-3.5 text-[#6E6E73] shrink-0" />
              <span className="text-[12px] text-[#6E6E73] font-mono shrink-0">{formatTime(q.timestamp)}</span>
              <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0",
                q.type === "qcm"
                  ? "bg-blue-50 dark:bg-[#0071E3]/10 text-blue-600"
                  : "bg-purple-50 dark:bg-purple-500/10 text-purple-600")}>
                {q.type === "qcm" ? (q.allowMultiple ? "QCM multi" : "QCM") : "V/F"}
              </span>
              <span className="text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] truncate flex-1">
                {q.question || <span className="italic text-[#ADADB8]">{t("emptyQuestion")}</span>}
              </span>
              <button
                onClick={e => { e.stopPropagation(); removeQuestion(q.id); }}
                className="text-[#ADADB8] hover:text-red-500 transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </button>
          ))}
        </div>
      )}

      {/* Éditeur question active */}
      {activeQ && (
        <div className="bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-[#E5E5EA] dark:border-[#3A3A3C] rounded-2xl p-5 space-y-4">
          {/* Timestamp */}
          <div className="flex items-center gap-2 text-[12px] text-[#6E6E73]">
            <Clock className="w-3.5 h-3.5" />
            {t("at")} {formatTime(activeQ.timestamp)}
          </div>

          {/* Sélecteur type */}
          <div className="flex gap-2 flex-wrap">
            {(["qcm", "vrai_faux"] as const).map(type => (
              <button key={type} type="button" onClick={() => changeType(activeQ.id, type)}
                className={cn("px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all",
                  activeQ.type === type
                    ? "bg-[#0071E3] text-white"
                    : "bg-white dark:bg-[#1C1C1E] border border-[#D2D2D7] dark:border-[#3A3A3C] text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]")}>
                {type === "qcm" ? "QCM" : "Vrai / Faux"}
              </button>
            ))}
            {activeQ.type === "qcm" && (
              <label className="ml-auto flex items-center gap-2 text-[13px] text-[#6E6E73] dark:text-[#8E8E93] cursor-pointer select-none">
                <input type="checkbox" checked={activeQ.allowMultiple}
                  onChange={e => updateQuestion(activeQ.id, { allowMultiple: e.target.checked })}
                  className="w-4 h-4 rounded accent-[#0071E3]" />
                Plusieurs réponses
              </label>
            )}
          </div>

          {/* Texte question */}
          <div>
            <label className={labelCls}>Question *</label>
            <textarea
              value={activeQ.question}
              onChange={e => updateQuestion(activeQ.id, { question: e.target.value })}
              placeholder={t("questionPlaceholder")}
              rows={2}
              className="w-full text-[13px] border border-[#D2D2D7] dark:border-[#3A3A3C] rounded-xl px-3 py-2 bg-white dark:bg-[#1C1C1E] dark:text-[#F5F5F7] resize-none focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-colors"
            />
          </div>

          {/* Choix QCM */}
          {activeQ.type === "qcm" && (
            <div className="space-y-2">
              <label className={labelCls}>
                Choix ({activeQ.choices.length} / 10) — {activeQ.allowMultiple ? "cliquez les badges pour sélectionner les bonnes réponses" : "cliquez le badge pour marquer la bonne réponse"}
              </label>
              {activeQ.choices.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2">
                  <button type="button"
                    onClick={() => toggleCorrect(activeQ.id, c.id, activeQ.allowMultiple)}
                    className={cn(
                      "w-7 h-7 rounded-lg text-[12px] font-bold flex items-center justify-center shrink-0 transition-all relative",
                      c.correct ? "bg-[#0071E3] text-white" : "bg-[#E5E5EA] dark:bg-[#3A3A3C] text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#D2D2D7]"
                    )}>
                    {LETTERS[i]}
                    {activeQ.allowMultiple && c.correct && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="w-2 h-2 text-white" />
                      </span>
                    )}
                  </button>
                  <input
                    value={c.text}
                    onChange={e => updateChoice(activeQ.id, c.id, { text: e.target.value })}
                    placeholder={`Option ${LETTERS[i]}`}
                    className={fieldCls}
                  />
                  {activeQ.choices.length > 2 && (
                    <button type="button" onClick={() => removeChoice(activeQ.id, c.id)}
                      className="p-1.5 rounded-lg text-[#ADADB8] hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                      <MinusCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {activeQ.choices.length < 10 && (
                <button type="button" onClick={() => addChoice(activeQ.id)}
                  className="flex items-center gap-1.5 text-[13px] text-[#0071E3] hover:text-[#0077ED] font-medium transition-colors mt-1">
                  <PlusCircle className="w-4 h-4" /> Ajouter un choix
                </button>
              )}
            </div>
          )}

          {/* Vrai / Faux */}
          {activeQ.type === "vrai_faux" && (
            <div>
              <label className={labelCls}>Bonne réponse</label>
              <div className="flex gap-2">
                {activeQ.choices.map(c => (
                  <button key={c.id} type="button" onClick={() => setVraiFauxCorrect(activeQ.id, c.id)}
                    className={cn(
                      "px-6 py-2 rounded-xl text-[14px] font-medium transition-all",
                      c.correct
                        ? "bg-[#0071E3] text-white shadow-sm"
                        : "bg-white dark:bg-[#1C1C1E] border border-[#D2D2D7] dark:border-[#3A3A3C] text-[#6E6E73] dark:text-[#8E8E93] hover:border-[#0071E3]"
                    )}>
                    {c.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Explication */}
          <div>
            <label className={labelCls}>Explication (optionnelle)</label>
            <input
              value={activeQ.explanation ?? ""}
              onChange={e => updateQuestion(activeQ.id, { explanation: e.target.value || null })}
              placeholder="Affichée après la bonne réponse…"
              className={fieldCls}
            />
          </div>
        </div>
      )}

      {/* Bouton sauvegarder */}
      {saveError && (
        <p className="text-[12px] text-red-600 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl px-3 py-2">
          {saveError}
        </p>
      )}

      {videoSrc && (
        <button
          onClick={save}
          disabled={saving || questions.length === 0}
          title={questions.length === 0 ? "Ajoutez au moins une question avant d'enregistrer" : undefined}
          className="flex items-center gap-2 px-4 py-2 bg-[#1D1D1F] dark:bg-[#F5F5F7] hover:bg-[#333] dark:hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-white dark:text-[#1D1D1F] text-[13px] font-medium rounded-xl transition-colors"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {saving ? t("saving") : t("save")}
        </button>
      )}
    </div>
  );
});

