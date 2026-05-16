"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Pencil, Download, Upload, GripVertical, Check, X, PlusCircle, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type QuestionType = "qcm" | "vrai_faux";

const LETTERS = ["A","B","C","D","E","F","G","H","I","J"] as const;
type Letter = typeof LETTERS[number];

interface Question {
  id: string;
  order: number;
  type: QuestionType;
  question: string;
  choiceA: string | null; choiceB: string | null; choiceC: string | null; choiceD: string | null;
  choiceE: string | null; choiceF: string | null; choiceG: string | null; choiceH: string | null;
  choiceI: string | null; choiceJ: string | null;
  correctAnswer: string;
  allowMultiple: boolean;
  explanation: string | null;
}

// Helpers pour convertir Question ↔ tableau de choix
function questionToChoices(q: Omit<Question, "id" | "order">): string[] {
  return LETTERS
    .map((l) => q[`choice${l}` as keyof typeof q] as string | null)
    .filter((v) => v !== null && v !== undefined) as string[];
}

function choicesToFields(choices: string[]): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  LETTERS.forEach((l, i) => { out[`choice${l}`] = choices[i] ?? null; });
  return out;
}

interface FormData {
  type: QuestionType;
  question: string;
  choices: string[];          // 2-10 éléments
  correctAnswer: string;      // "A" | "A,C" | "vrai" | "faux"
  allowMultiple: boolean;
  explanation: string;
}

const EMPTY_FORM: FormData = {
  type: "qcm",
  question: "",
  choices: ["", ""],
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

function formToQuestion(f: FormData): Omit<Question, "id" | "order"> {
  return {
    type: f.type,
    question: f.question,
    ...choicesToFields(f.choices),
    correctAnswer: f.correctAnswer,
    allowMultiple: f.allowMultiple,
    explanation: f.explanation || null,
  } as Omit<Question, "id" | "order">;
}

function questionToForm(q: Omit<Question, "id" | "order">): FormData {
  const choices = questionToChoices(q);
  return {
    type: q.type,
    question: q.question,
    choices: choices.length >= 2 ? choices : ["", ""],
    correctAnswer: q.correctAnswer,
    allowMultiple: q.allowMultiple,
    explanation: q.explanation ?? "",
  };
}

function QuestionForm({
  initial,
  onSave,
  onCancel,
  mode = "add",
}: {
  initial: FormData;
  onSave: (q: Omit<Question, "id" | "order">) => Promise<void>;
  onCancel: () => void;
  mode?: "add" | "edit";
}) {
  const [form, setForm] = useState<FormData>(initial);
  const [saving, setSaving] = useState(false);

  const selectedLetters = new Set(form.correctAnswer.split(",").filter(Boolean));

  function handleTypeChange(t: QuestionType) {
    setForm((f) => ({ ...f, type: t, correctAnswer: t === "vrai_faux" ? "vrai" : "A", allowMultiple: false }));
  }

  function handleMultipleToggle(checked: boolean) {
    setForm((f) => ({
      ...f,
      allowMultiple: checked,
      correctAnswer: f.correctAnswer.split(",")[0] || "A",
    }));
  }

  function handleChoiceChange(i: number, val: string) {
    setForm((f) => { const c = [...f.choices]; c[i] = val; return { ...f, choices: c }; });
  }

  function addChoice() {
    if (form.choices.length >= 10) return;
    setForm((f) => ({ ...f, choices: [...f.choices, ""] }));
  }

  function removeChoice(i: number) {
    if (form.choices.length <= 2) return;
    setForm((f) => {
      const c = f.choices.filter((_, idx) => idx !== i);
      // Nettoyer la bonne réponse si elle pointait vers un index supprimé
      const validLetters = new Set(LETTERS.slice(0, c.length));
      const newAnswer = f.correctAnswer
        .split(",")
        .filter((l) => validLetters.has(l as Letter))
        .join(",") || LETTERS[0];
      return { ...f, choices: c, correctAnswer: newAnswer };
    });
  }

  function handleAnswerClick(letter: string) {
    if (form.allowMultiple) {
      setForm((f) => ({ ...f, correctAnswer: toggleLetter(f.correctAnswer, letter) }));
    } else {
      setForm((f) => ({ ...f, correctAnswer: letter }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(formToQuestion(form));
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#F5F5F7] rounded-2xl p-5 space-y-4 border border-[#E5E5EA]">
      {/* Type */}
      <div className="flex gap-2 flex-wrap">
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
        <textarea value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} required rows={2}
          className="w-full px-3 py-2 rounded-xl border border-[#D2D2D7] bg-white text-[14px] outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 resize-none transition-all" />
      </div>

      {/* Choix QCM — dynamiques */}
      {form.type === "qcm" && (
        <div className="space-y-2">
          <label className={labelCls}>Choix ({form.choices.length} / 10)</label>
          {form.choices.map((val, i) => {
            const letter = LETTERS[i];
            const isCorrect = selectedLetters.has(letter);
            return (
              <div key={i} className="flex items-center gap-2">
                <span className={cn("w-7 h-7 rounded-lg text-[12px] font-bold flex items-center justify-center shrink-0",
                  isCorrect ? "bg-[#0071E3] text-white" : "bg-[#E5E5EA] text-[#6E6E73]")}>
                  {letter}
                </span>
                <input value={val} onChange={(e) => handleChoiceChange(i, e.target.value)}
                  className={fieldCls} placeholder={`Option ${letter}`} />
                {form.choices.length > 2 && (
                  <button type="button" onClick={() => removeChoice(i)}
                    className="p-1.5 rounded-lg text-[#ADADB8] hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                    <MinusCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
          {form.choices.length < 10 && (
            <button type="button" onClick={addChoice}
              className="flex items-center gap-1.5 text-[13px] text-[#0071E3] hover:text-[#0077ED] font-medium transition-colors mt-1">
              <PlusCircle className="w-4 h-4" /> Ajouter un choix
            </button>
          )}
        </div>
      )}

      {/* Bonne réponse */}
      <div>
        <label className={labelCls}>
          {form.allowMultiple ? "Bonnes réponses * (cliquez pour sélectionner)" : "Bonne réponse *"}
        </label>
        {form.type === "qcm" ? (
          <div className="flex flex-wrap gap-2">
            {form.choices.map((_, i) => {
              const l = LETTERS[i];
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
              <button key={v} type="button" onClick={() => setForm((f) => ({ ...f, correctAnswer: v }))}
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
        <label className={labelCls}>Explication (optionnelle)</label>
        <input value={form.explanation} onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
          className={fieldCls} placeholder="Ex : Le firewall filtre le trafic réseau entrant et sortant." />
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 px-5 h-9 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium rounded-xl transition-colors disabled:opacity-60">
          <Check className="w-3.5 h-3.5" />
          {saving ? "Enregistrement…" : mode === "add" ? "Ajouter la question" : "Enregistrer"}
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
    setImportError(null); setImportSuccess(null);
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

  function handleDownloadTemplate() {
    const header = "question;type;choiceA;choiceB;choiceC;choiceD;choiceE;choiceF;choiceG;choiceH;choiceI;choiceJ;correctAnswer;explanation";
    const examples = [
      `"Qu'est-ce qu'un firewall ?";;qcm;"Un antivirus";"Un filtre réseau";"Un VPN";"Un proxy";;;;;;;;B;"Filtre le trafic réseau entrant et sortant"`,
      `"Choisir les protocoles chiffrés";qcm;HTTP;HTTPS;FTP;SFTP;SSH;Telnet;;;;"B,D,E";"HTTPS, SFTP et SSH utilisent le chiffrement"`,
      `"HTTPS est sécurisé";vrai_faux;;;;;;;;;;;;vrai;"HTTPS chiffre les communications"`,
    ];
    const csv = [header, ...examples].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "gabarit_quiz.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="py-10 text-center text-[13px] text-[#6E6E73]">Chargement…</div>;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-[#6E6E73]">
          {questions.length === 0 ? "Aucune question." : `${questions.length} question(s)`}
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 h-9 border border-[#D2D2D7] text-[#1D1D1F] text-[13px] font-medium rounded-xl hover:bg-[#F5F5F7] transition-colors"
            title="Télécharger un gabarit CSV vide">
            <Download className="w-3.5 h-3.5 text-[#6E6E73]" /> Gabarit CSV
          </button>
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

      {importSuccess && <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-[13px] text-green-700">{importSuccess}</div>}
      {importError && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-[13px] text-red-600">{importError}</div>}

      {/* Format CSV */}
      <details className="text-[12px] text-[#6E6E73] bg-[#F5F5F7] rounded-xl px-4 py-3">
        <summary className="cursor-pointer font-medium text-[#1D1D1F]">Format CSV attendu</summary>
        <pre className="mt-2 overflow-x-auto text-[11px] leading-relaxed">{`question;type;choiceA;choiceB;...;choiceJ;correctAnswer;explanation
"Question 1";qcm;Opt A;Opt B;Opt C;Opt D;;;;;;B;"Explication"
"Multi-réponse";qcm;Opt A;Opt B;Opt C;Opt D;Opt E;;;;;"A,C,E";"..."
"Vrai ou faux ?";vrai_faux;;;;;;;;;;;;vrai;"Explication"`}</pre>
        <p className="mt-1.5 text-[11px] text-[#ADADB8]">Colonnes choiceE à choiceJ optionnelles · correctAnswer multi : <code>A,C</code></p>
      </details>

      {showForm && !editingId && (
        <QuestionForm initial={EMPTY_FORM} onSave={handleAdd} onCancel={() => setShowForm(false)} />
      )}

      {questions.length > 0 && (
        <div className="space-y-3">
          {questions.map((q, i) => {
            const correctLetters = new Set(q.correctAnswer.split(",").filter(Boolean));
            const allChoices = LETTERS
              .map((l) => ({ letter: l, val: q[`choice${l}` as keyof Question] as string | null }))
              .filter((c) => c.val);

            return (
              <div key={q.id} className="bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden">
                {editingId === q.id ? (
                  <div className="p-4">
                    <QuestionForm
                      initial={questionToForm(q)}
                      onSave={(data) => handleEdit(q.id, data)}
                      onCancel={() => setEditingId(null)}
                      mode="edit"
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
                          {q.type === "qcm" ? (q.allowMultiple ? `QCM multiple (${allChoices.length})` : `QCM (${allChoices.length})`) : "Vrai / Faux"}
                        </span>
                      </div>
                      <p className="text-[14px] font-medium text-[#1D1D1F]">{q.question}</p>
                      {q.type === "qcm" && (
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          {allChoices.map(({ letter, val }) => {
                            const isCorrect = correctLetters.has(letter);
                            return (
                              <div key={letter} className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px]",
                                isCorrect ? "bg-green-50 text-green-700 font-medium" : "bg-[#F5F5F7] text-[#6E6E73]")}>
                                <span className={cn("w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center shrink-0",
                                  isCorrect ? "bg-green-500 text-white" : "bg-[#E5E5EA] text-[#6E6E73]")}>{letter}</span>
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
