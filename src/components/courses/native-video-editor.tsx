"use client";

import { useRef, useState, useCallback } from "react";
import { Plus, Trash2, GripVertical, Clock, Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface Choice { id: string; text: string; correct: boolean; }
interface Question { id: string; timestamp: number; question: string; choices: Choice[]; order: number; }

interface Props {
  courseId: string;
  initialVideoId?: string;
  initialQuestions?: Question[];
  onSaved?: () => void;
}

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
  };
}

export function NativeVideoEditor({ courseId, initialVideoId, initialQuestions = [], onSaved }: Props) {
  const t = useTranslations("nativeVideoEditor");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(
    initialVideoId ? `/api/native-video/${initialVideoId}/stream` : null
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeQ = questions.find(q => q.id === activeId) ?? null;

  // Upload vidéo
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

  // Ajouter une question au timestamp courant
  function addQuestion() {
    const t = videoRef.current?.currentTime ?? 0;
    const q = newQuestion(t, questions.length);
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

  function updateChoice(qId: string, cId: string, patch: Partial<Choice>) {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q;
      return { ...q, choices: q.choices.map(c => c.id === cId ? { ...c, ...patch } : c) };
    }));
  }

  function setCorrect(qId: string, cId: string) {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q;
      return { ...q, choices: q.choices.map(c => ({ ...c, correct: c.id === cId })) };
    }));
  }

  function addChoice(qId: string) {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId || q.choices.length >= 6) return q;
      return { ...q, choices: [...q.choices, newChoice()] };
    }));
  }

  function removeChoice(qId: string, cId: string) {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId || q.choices.length <= 2) return q;
      return { ...q, choices: q.choices.filter(c => c.id !== cId) };
    }));
  }

  async function save() {
    setSaving(true);
    const duration = videoRef.current?.duration ?? null;
    await fetch(`/api/courses/${courseId}/native-video`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions, duration }),
    });
    setSaving(false);
    onSaved?.();
  }

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
        <label className="flex items-center gap-2 text-[12px] text-[#6E6E73] hover:text-[#1D1D1F] cursor-pointer w-fit">
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
          <h3 className="text-[13px] font-semibold text-[#1D1D1F]">
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
                  ? "bg-blue-50 border-[#0071E3]/30"
                  : "bg-white border-[#E5E5EA] hover:border-[#ADADB8]"
              )}
            >
              <GripVertical className="w-3.5 h-3.5 text-[#ADADB8] shrink-0" />
              <Clock className="w-3.5 h-3.5 text-[#6E6E73] shrink-0" />
              <span className="text-[12px] text-[#6E6E73] font-mono shrink-0">{formatTime(q.timestamp)}</span>
              <span className="text-[13px] text-[#1D1D1F] truncate flex-1">
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
        <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#6E6E73]" />
            <span className="text-[12px] text-[#6E6E73]">{t("at")} {formatTime(activeQ.timestamp)}</span>
          </div>

          <textarea
            value={activeQ.question}
            onChange={e => updateQuestion(activeQ.id, { question: e.target.value })}
            placeholder={t("questionPlaceholder")}
            rows={2}
            className="w-full text-[13px] border border-[#E5E5EA] rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-[#0071E3] transition-colors"
          />

          <div className="space-y-2">
            <p className="text-[11px] text-[#6E6E73] font-medium uppercase tracking-wide">{t("choices")}</p>
            {activeQ.choices.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2">
                <input
                  type="radio" name={`correct-${activeQ.id}`} checked={c.correct}
                  onChange={() => setCorrect(activeQ.id, c.id)}
                  className="accent-[#0071E3] shrink-0"
                  title={t("markCorrect")}
                />
                <input
                  value={c.text}
                  onChange={e => updateChoice(activeQ.id, c.id, { text: e.target.value })}
                  placeholder={`${t("choice")} ${i + 1}`}
                  className="flex-1 text-[13px] border border-[#E5E5EA] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#0071E3] transition-colors"
                />
                {activeQ.choices.length > 2 && (
                  <button onClick={() => removeChoice(activeQ.id, c.id)} className="text-[#ADADB8] hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            {activeQ.choices.length < 6 && (
              <button
                onClick={() => addChoice(activeQ.id)}
                className="text-[12px] text-[#0071E3] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> {t("addChoice")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bouton sauvegarder */}
      {videoSrc && (
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#1D1D1F] hover:bg-[#333] disabled:opacity-50 text-white text-[13px] font-medium rounded-xl transition-colors"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {saving ? t("saving") : t("save")}
        </button>
      )}
    </div>
  );
}
