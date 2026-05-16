"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Pencil, Download, Upload, GripVertical, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

type QuestionType = "qcm" | "vrai_faux";
interface Question {
  id: string;
  order: number;
  type: QuestionType;
  question: string;
  choiceA: string | null;
  choiceB: string | null;
  choiceC: string | null;
  choiceD: string | null;
  correctAnswer: string; // "A" | "A,C" | "vrai" | "faux"
  allowMultiple: boolean;
  explanation: string | null;
}

const EMPTY: Omit<Question, "id" | "order"> = {
  type: "qcm",
  question: "",
  choiceA: "",
  choiceB: "",
  choiceC: "",
  choiceD: "",
  correctAnswer: "A",
  allowMultiple: false,
  explanation: "",
};

const fieldCls = "w-full h-10 px-3 rounded-xl border border-[#D2D2D7] bg-white text-[14px] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all";
const labelCls = "block text-[12px] font-medium text-[#6E6E73] mb-1";

function toggleLetter(current: string, letter: string): string {
  const set = new Set(current.split(",").filter(Boolean));
  if (set.has(letter)) { set.delete(letter); } else { set.add(letter); }
  return [...set].sort().join(",") || letter;
}

function QuestionForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Omit<Question, "id" | "order">;
  onSave: (q: Omit<Question, "id" | "order">) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleTypeChange(t: QuestionType) {
    setForm((f) => ({ ...f, type: t, correctAnswer: t === "vrai_faux" ? "vrai" : "A", allowMultiple: false }));
  }

  function handleMultipleToggle(checked: boolean) {
    setForm((f) => ({
      ...f,
      allowMultiple: checked,
      // reset to single letter if switching off
      correctAnswer: checked ? f.correctAnswer.split(",")[0] : f.correctAnswer.split(",")[0],
    }));
  }

  function handleAnswerClick(letter: string) {
    if (form.allowMultiple) {
      setForm((f) => ({ ...f, correctAnswer: toggleLetter(f.correctAnswer, letter) }));
    } else {
      setForm((f) => ({ ...f, correctAnswer: letter }));
    }
  }

  const selectedLetters = new Set(form.correctAnswer.split(",").filter(Boolean));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#F5F5F7] rounded-2xl p-5 space-y-4 border border-[#E5E5EA]">
      {/* Type */}
      <div className="flex gap-2">
        {(["qcm", "vrai_faux"] as const).map((t) => (
          <button key={t} type="button" onClick={() => handleTypeChange(t)}
            className={cn("px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all",
              form.type === t ? "bg-[#0071E3] text-white" : "bg-white border border-[#D2D2D7] text-[#6E6E73] hover:text-[#1D1D1F]")}>
            {t === "qcm" ? "QCM" : "Vrai / Faux"}
          </button>
        ))}
        {form.type === "qcm" && (
          <label className="ml-auto flex items-center gap-2 text-[13px] text-[#6E6E73] cursor-pointer select-none">
            <input type="checkbox" checked={form.allowMultiple} onChange={(e) => handleMultipleToggle(e.target.checked)}
              className="w-4 h-4 rounded accent-[#0071E3]" />
            Plusieurs réponses
          </label>
        )}
      </div>

      {/* Question */}
      <div>
        <label className={labelCls}>Question *</label>
        <textarea value={form.question} onChange={(e) => set("question", e.target.value)} required rows={2}
          className="w-full px-3 py-2 rounded-xl border border-[#D2D2D7] bg-white text-[14px] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 resize-none transition-all" />
      </div>

      {/* Choix QCM */}
      {form.type === "qcm" && (
        <div className="grid grid-cols-2 gap-3">
          {(["A", "B", "C", "D"] as const).map((letter) => {
            const key = `choice${letter}` as keyof typeof form;
            const isCorrect = selectedLetters.has(letter);
            return (
              <div key={letter}>
                <label className={labelCls}>
                  <span className={cn("inline-flex w-5 h-5 rounded-md text-[11px] font-bold items-center justify-center mr-1",
                    isCorrect ? "bg-[#0071E3] text-white" : "bg-[#E5E5EA] text-[#6E6E73]")}>
                    {letter}
                  </span>
                  Choix {letter}
                </label>
                <input value={(form[key] as string) ?? ""} onChange={(e) => set(key as keyof Omit<Question, "id" | "order">, e.target.value as never)}
                  className={fieldCls} placeholder={`Option ${letter}`} />
              </div>
            );
          })}
        </div>
      )}

      {/* Bonne réponse */}
      <div>
        <label className={labelCls}>
          {form.allowMultiple ? "Bonnes réponses * (cliquez pour sélectionner)" : "Bonne réponse *"}
        </label>
        {form.type === "qcm" ? (
          <div className="flex gap-2">
            {["A", "B", "C", "D"].map((l) => {
              const isSelected = selectedLetters.has(l);
              return (
                <button key={l} type="button" onClick={() => handleAnswerClick(l)}
                  className={cn("w-10 h-10 rounded-xl text-[14px] font-semibold transition-all relative",
                    isSelected ? "bg-[#0071E3] text-white shadow-sm" : "bg-white border border-[#D2D2D7] text-[#6E6E73] hover:border-[#0071E3]")}>
                  {l}
                  {form.allowMultiple && isSelected && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center">
                      <Check className="w-2 h-2 text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex gap-2">
            {["vrai", "faux"].map((v) => (
              <button key={v} type="button" onClick={() => set("correctAnswer", v)}
                className={cn("px-5 h-10 rounded-xl text-[14px] font-medium capitalize transition-all",
                  form.correctAnswer === v ? "bg-[#0071E3] text-white shadow-sm" : "bg-white border border-[#D2D2D7] text-[#6E6E73] hover:border-[#0071E3]")}>
                {v}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Explication */}
      <div>
        <label className={labelCls}>Explication (optionnelle — affichée après la réponse)</label>
        <input value={form.explanation ?? ""} onChange={(e) => set("explanation", e.target.value)}
          className={fieldCls} placeholder="Ex : Le firewall filtre le trafic réseau entrant et sortant." />
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 px-5 h-9 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium rounded-xl transition-colors disabled:opacity-60">
          <Check className="w-3.5 h-3.5" /> {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1.5 px-4 h-9 border border-[#D2D2D7] text-[#6E6E73] text-[13px] font-medium rounded-xl hover:bg-[#F5F5F7] transition-colors">
          <X className="w-3.5 h-3.5" /> Annuler
        </button>
      </div>
    </form>
  );
}

export function QuizEditor({ courseId }: { courseId: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/courses/${courseId}/questions`);
    setQuestions(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [courseId]);

  async function handleAdd(data: Omit<Question, "id" | "order">) {
    await fetch(`/api/admin/courses/${courseId}/questions`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    setShowForm(false);
    load();
  }

  async function handleEdit(qid: string, data: Omit<Question, "id" | "order">) {
    await fetch(`/api/admin/courses/${courseId}/questions/${qid}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    setEditingId(null);
    load();
  }

  async function handleDelete(qid: string) {
    if (!confirm("Supprimer cette question ?")) return;
    await fetch(`/api/admin/courses/${courseId}/questions/${qid}`, { method: "DELETE" });
    load();
  }

  async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportSuccess(null);
    const text = await file.text();
    const res = await fetch(`/api/admin/courses/${courseId}/questions/import-csv`, {
      method: "POST", headers: { "Content-Type": "text/plain" }, body: text,
    });
    const data = await res.json();
    if (data.error) { setImportError(data.error); return; }
    setImportSuccess(`${data.imported} question(s) importée(s)${data.errors?.length ? ` — ${data.errors.length} ligne(s) ignorée(s)` : ""}`);
    if (e.target) e.target.value = "";
    load();
  }

  function handleExportCSV() {
    window.open(`/api/admin/courses/${courseId}/questions/export-csv`, "_blank");
  }

  if (loading) return <div className="py-10 text-center text-[13px] text-[#6E6E73]">Chargement…</div>;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-[#6E6E73]">
          {questions.length === 0 ? "Aucune question." : `${questions.length} question(s)`}
        </p>
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 px-3 h-9 border border-[#D2D2D7] text-[#1D1D1F] text-[13px] font-medium rounded-xl hover:bg-[#F5F5F7] transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-[#6E6E73]" /> Importer CSV
            <input ref={csvInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleImportCSV} />
          </label>
          {questions.length > 0 && (
            <button onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 h-9 border border-[#D2D2D7] text-[#1D1D1F] text-[13px] font-medium rounded-xl hover:bg-[#F5F5F7] transition-colors">
              <Download className="w-3.5 h-3.5 text-[#6E6E73]" /> Exporter CSV
            </button>
          )}
          <button onClick={() => { setShowForm(true); setEditingId(null); }}
            className="flex items-center gap-1.5 px-4 h-9 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium rounded-xl transition-colors">
            <Plus className="w-3.5 h-3.5" /> Ajouter une question
          </button>
        </div>
      </div>

      {/* Feedback import */}
      {importSuccess && <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-[13px] text-green-700">{importSuccess}</div>}
      {importError && <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-[13px] text-red-600">{importError}</div>}

      {/* Format CSV helper */}
      <details className="text-[12px] text-[#6E6E73] bg-[#F5F5F7] rounded-xl px-4 py-3">
        <summary className="cursor-pointer font-medium text-[#1D1D1F]">Format CSV attendu</summary>
        <pre className="mt-2 overflow-x-auto text-[11px] leading-relaxed">{`question;type;choiceA;choiceB;choiceC;choiceD;correctAnswer;explanation
"Qu'est-ce qu'un firewall ?";qcm;Un antivirus;Un filtre réseau;Un VPN;Un proxy;B;"Filtre le trafic réseau"
"Choisir les protocoles chiffrés";qcm;HTTP;HTTPS;FTP;SFTP;"B,D";"HTTPS et SFTP utilisent le chiffrement"
"HTTPS est sécurisé";vrai_faux;;;;vrai;"HTTPS chiffre les communications"`}</pre>
        <p className="mt-2 text-[11px] text-[#ADADB8]">Pour plusieurs bonnes réponses QCM : séparer par virgule, ex&nbsp;: <code>B,D</code></p>
      </details>

      {/* Formulaire ajout */}
      {showForm && !editingId && (
        <QuestionForm initial={EMPTY} onSave={handleAdd} onCancel={() => setShowForm(false)} />
      )}

      {/* Liste des questions */}
      {questions.length > 0 && (
        <div className="space-y-3">
          {questions.map((q, i) => {
            const correctLetters = new Set(q.correctAnswer.split(",").filter(Boolean));
            return (
              <div key={q.id} className="bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden">
                {editingId === q.id ? (
                  <div className="p-4">
                    <QuestionForm
                      initial={{ type: q.type, question: q.question, choiceA: q.choiceA, choiceB: q.choiceB, choiceC: q.choiceC, choiceD: q.choiceD, correctAnswer: q.correctAnswer, allowMultiple: q.allowMultiple, explanation: q.explanation }}
                      onSave={(data) => handleEdit(q.id, data)}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-4">
                    <GripVertical className="w-4 h-4 text-[#ADADB8] mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-medium text-[#ADADB8]">#{i + 1}</span>
                        <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-md",
                          q.type === "qcm" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600")}>
                          {q.type === "qcm" ? (q.allowMultiple ? "QCM multiple" : "QCM") : "Vrai / Faux"}
                        </span>
                      </div>
                      <p className="text-[14px] font-medium text-[#1D1D1F]">{q.question}</p>
                      {q.type === "qcm" && (
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          {(["A", "B", "C", "D"] as const).map((l) => {
                            const val = q[`choice${l}` as keyof Question] as string | null;
                            if (!val) return null;
                            const isCorrect = correctLetters.has(l);
                            return (
                              <div key={l} className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px]",
                                isCorrect ? "bg-green-50 text-green-700 font-medium" : "bg-[#F5F5F7] text-[#6E6E73]")}>
                                <span className={cn("w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center shrink-0",
                                  isCorrect ? "bg-green-500 text-white" : "bg-[#E5E5EA] text-[#6E6E73]")}>{l}</span>
                                {val}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {q.type === "vrai_faux" && (
                        <p className="mt-1 text-[12px] text-[#6E6E73]">Réponse : <span className="font-medium text-green-600 capitalize">{q.correctAnswer}</span></p>
                      )}
                      {q.explanation && <p className="mt-1.5 text-[12px] text-[#ADADB8] italic">{q.explanation}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setEditingId(q.id); setShowForm(false); }}
                        className="p-2 rounded-lg text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#0071E3] transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(q.id)}
                        className="p-2 rounded-lg text-[#6E6E73] hover:bg-red-50 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {questions.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-[#E5E5EA] rounded-2xl">
          <p className="text-[15px] font-medium text-[#1D1D1F]">Aucune question</p>
          <p className="text-[13px] text-[#6E6E73] mt-1">Ajoutez des questions ou importez un fichier CSV.</p>
        </div>
      )}
    </div>
  );
}
