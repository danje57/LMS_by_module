"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, ChevronRight, RotateCcw, Trophy, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { CertificateView } from "@/components/courses/certificate-view";
import Link from "next/link";

const LETTERS = ["A","B","C","D","E","F","G","H","I","J"] as const;

interface Question {
  id: string;
  order: number;
  type: "qcm" | "vrai_faux";
  question: string;
  choiceA: string | null; choiceB: string | null; choiceC: string | null; choiceD: string | null;
  choiceE: string | null; choiceF: string | null; choiceG: string | null; choiceH: string | null;
  choiceI: string | null; choiceJ: string | null;
  correctAnswer: string;
  allowMultiple: boolean;
  explanation: string | null;
}

interface Props {
  courseId: string;
  courseTitle?: string;
  passingScore: number;
  userName?: string;
  logoPath?: string | null;
  onClose?: () => void;
}

type Phase = "loading" | "ready" | "playing" | "reviewing" | "result";

function normalize(answer: string) {
  return answer.split(",").map((s) => s.trim().toLowerCase()).sort().join(",");
}

function isCorrect(question: Question, answer: string): boolean {
  return normalize(question.correctAnswer) === normalize(answer);
}

export function QuizPlayer({ courseId, courseTitle, passingScore, userName, logoPath, onClose }: Props) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [certResult, setCertResult] = useState<{ id: string; completedAt: Date } | null>(null);

  useEffect(() => {
    fetch(`/api/admin/courses/${courseId}/questions`)
      .then((r) => r.json())
      .then((data) => { setQuestions(data); setPhase(data.length > 0 ? "ready" : "loading"); });
  }, [courseId]);

  function startQuiz() {
    setCurrent(0);
    setAnswers({});
    setSubmitted(false);
    setPhase("playing");
  }

  const q = questions[current];
  const selectedAnswer = answers[q?.id ?? ""] ?? "";
  const selectedSet = new Set(selectedAnswer.split(",").filter(Boolean));

  function handleSelect(value: string) {
    if (!q) return;
    if (q.allowMultiple) {
      const s = new Set(selectedAnswer.split(",").filter(Boolean));
      if (s.has(value)) { s.delete(value); } else { s.add(value); }
      setAnswers((a) => ({ ...a, [q.id]: [...s].sort().join(",") }));
    } else {
      setAnswers((a) => ({ ...a, [q.id]: value }));
    }
  }

  function handleNext() {
    if (current < questions.length - 1) {
      setCurrent((c) => c + 1);
    } else {
      setPhase("reviewing");
    }
  }

  async function handleSubmit() {
    if (submitted) return;
    setSubmitted(true);
    const total = questions.length;
    const correct = questions.filter((q) => isCorrect(q, answers[q.id] ?? "")).length;
    const score = Math.round((correct / total) * 100);
    const passed = score >= passingScore;

    const res = await fetch(`/api/courses/${courseId}/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, score, passed }),
    });
    const data = await res.json();
    if (passed && data.certificateId) {
      setCertResult({ id: data.certificateId, completedAt: new Date(data.certificateCompletedAt) });
    }

    setPhase("result");
  }

  if (phase === "loading") {
    return <div className="py-12 text-center text-[13px] text-[#6E6E73]">Chargement du quiz…</div>;
  }

  if (phase === "ready") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
          <Trophy className="w-8 h-8 text-amber-500" />
        </div>
        <div>
          <h2 className="text-[20px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Quiz disponible</h2>
          <p className="mt-1 text-[14px] text-[#6E6E73] dark:text-[#8E8E93]">
            {questions.length} question(s) · Score minimum : {passingScore}%
          </p>
        </div>
        <button onClick={startQuiz}
          className="px-8 py-3 bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium rounded-2xl transition-colors">
          Commencer le quiz
        </button>
        {onClose && (
          <button onClick={onClose} className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] transition-colors">
            Revenir au cours
          </button>
        )}
      </div>
    );
  }

  if (phase === "playing") {
    const choices = LETTERS
      .map((l) => ({ letter: l, value: q[`choice${l}` as keyof Question] as string | null }))
      .filter((c) => c.value);

    const canAdvance = selectedAnswer.length > 0;

    return (
      <div className="max-w-2xl mx-auto space-y-6 py-4">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-[12px] text-[#6E6E73] dark:text-[#8E8E93]">
            <span>Question {current + 1} / {questions.length}</span>
            {q.allowMultiple && <span className="text-amber-600 font-medium">Plusieurs réponses possibles</span>}
          </div>
          <div className="h-1.5 bg-[#E5E5EA] dark:bg-[#3A3A3C] rounded-full overflow-hidden">
            <div className="h-full bg-[#0071E3] rounded-full transition-all"
              style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
          </div>
        </div>

        {/* Question */}
        <p className="text-[18px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-snug">{q.question}</p>

        {/* Choices */}
        <div className="space-y-2.5">
          {q.type === "qcm" ? choices.map(({ letter, value }) => {
            const isSelected = selectedSet.has(letter);
            return (
              <button key={letter} type="button" onClick={() => handleSelect(letter)}
                className={cn("w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-all",
                  isSelected
                    ? "border-[#0071E3] bg-[#0071E3]/5 dark:bg-[#0071E3]/10 text-[#1D1D1F] dark:text-[#F5F5F7]"
                    : "border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] hover:border-[#D2D2D7] dark:hover:border-[#636366]")}>
                <span className={cn("w-7 h-7 rounded-lg text-[13px] font-bold flex items-center justify-center shrink-0 transition-all",
                  isSelected ? "bg-[#0071E3] text-white" : "bg-[#E5E5EA] dark:bg-[#3A3A3C] text-[#3A3A3C] dark:text-[#E5E5EA]")}>{letter}</span>
                <span className="text-[14px]">{value}</span>
              </button>
            );
          }) : (
            <div className="flex gap-3">
              {["vrai", "faux"].map((v) => (
                <button key={v} type="button" onClick={() => handleSelect(v)}
                  className={cn("flex-1 py-3.5 rounded-2xl border-2 text-[15px] font-medium capitalize transition-all",
                    selectedAnswer === v
                      ? "border-[#0071E3] bg-[#0071E3]/5 dark:bg-[#0071E3]/10 text-[#0071E3]"
                      : "border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] hover:border-[#D2D2D7] dark:hover:border-[#636366]")}>
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-2">
          {onClose && (
            <button onClick={onClose} className="text-[13px] text-[#ADADB8] hover:text-[#6E6E73] dark:hover:text-[#8E8E93] transition-colors">
              Quitter
            </button>
          )}
          <button onClick={handleNext} disabled={!canAdvance}
            className={cn("ml-auto flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-[14px] font-medium transition-all",
              canAdvance
                ? "bg-[#0071E3] hover:bg-[#0077ED] text-white"
                : "bg-[#E5E5EA] text-[#ADADB8] cursor-not-allowed")}>
            {current < questions.length - 1 ? "Suivant" : "Terminer"}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (phase === "reviewing") {
    return (
      <div className="max-w-2xl mx-auto space-y-4 py-4">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Récapitulatif</h2>
        <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">Vérifiez vos réponses avant de valider. Le corrigé s'affichera après validation.</p>
        <div className="space-y-2">
          {questions.map((q, i) => {
            const given = answers[q.id] ?? "";
            return (
              <div key={q.id} className="flex items-start gap-3 p-4 rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] bg-[#F5F5F7] dark:bg-[#2C2C2E]">
                <span className="w-6 h-6 rounded-lg bg-[#E5E5EA] dark:bg-[#3A3A3C] text-[#6E6E73] dark:text-[#8E8E93] text-[12px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{q.question}</p>
                  <p className="text-[12px] mt-0.5">
                    <span className="text-[#6E6E73] dark:text-[#8E8E93]">Votre réponse : </span>
                    <span className="text-[#1D1D1F] dark:text-[#F5F5F7] font-medium">{given || "(sans réponse)"}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={() => { setCurrent(0); setPhase("playing"); }}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-[#D2D2D7] dark:border-[#3A3A3C] rounded-xl text-[13px] font-medium text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Modifier
          </button>
          <button onClick={handleSubmit} disabled={submitted}
            className="flex-1 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium rounded-xl transition-colors disabled:opacity-60">
            {submitted ? "Envoi…" : "Valider le quiz"}
          </button>
        </div>
      </div>
    );
  }

  // Result phase
  const total = questions.length;
  const correct = questions.filter((q) => isCorrect(q, answers[q.id] ?? "")).length;
  const score = Math.round((correct / total) * 100);
  const passed = score >= passingScore;

  return (
    <div className="space-y-6">
      {/* Score summary */}
      <div className="max-w-2xl mx-auto py-6 space-y-4 text-center">
        <div className={cn("w-20 h-20 rounded-3xl flex items-center justify-center mx-auto",
          passed ? "bg-green-50 dark:bg-emerald-500/10" : "bg-red-50 dark:bg-red-500/10")}>
          {passed
            ? <Trophy className="w-10 h-10 text-green-500" />
            : <XCircle className="w-10 h-10 text-red-500" />}
        </div>
        <div>
          <p className="text-[40px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">{score}%</p>
          <p className={cn("text-[16px] font-semibold mt-1", passed ? "text-green-600" : "text-red-600")}>
            {passed ? "Félicitations, quiz réussi !" : "Quiz non validé"}
          </p>
          <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] mt-1">
            {correct} / {total} bonnes réponses · Seuil : {passingScore}%
          </p>
        </div>

        {/* Corrigé détaillé uniquement si réussite */}
        {passed && (
          <div className="text-left space-y-3">
            {questions.map((q, i) => {
              const given = answers[q.id] ?? "";
              const ok = isCorrect(q, given);
              return (
                <div key={q.id} className={cn("p-4 rounded-2xl border",
                  ok ? "bg-green-50 dark:bg-emerald-500/10 border-green-100 dark:border-emerald-500/20" : "bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20")}>
                  <div className="flex items-start gap-2">
                    {ok ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
                    <div className="flex-1">
                      <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">#{i + 1} {q.question}</p>
                      {!ok && (
                        <p className="text-[12px] mt-0.5 text-red-600">
                          Votre réponse : {given || "—"} · <span className="text-green-700">Bonne : {q.correctAnswer}</span>
                        </p>
                      )}
                      {q.explanation && <p className="text-[12px] mt-1 text-[#6E6E73] dark:text-[#8E8E93] italic">{q.explanation}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-3 justify-center pt-2">
          {!passed && (
            <button onClick={startQuiz}
              className="flex items-center gap-1.5 px-5 py-2.5 border border-[#D2D2D7] dark:border-[#3A3A3C] rounded-xl text-[13px] font-medium text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Réessayer
            </button>
          )}
          {onClose && (
            <button onClick={onClose}
              className="px-5 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium rounded-xl transition-colors">
              Retour au cours
            </button>
          )}
        </div>
      </div>

      {/* Certificate — shown inline when quiz is passed */}
      {passed && certResult && courseTitle && userName && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-1">
            <div className="flex-1 h-px bg-[#E5E5EA] dark:bg-[#3A3A3C]" />
            <span className="text-[12px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] uppercase tracking-wide">Votre certificat</span>
            <div className="flex-1 h-px bg-[#E5E5EA] dark:bg-[#3A3A3C]" />
          </div>
          <CertificateView
            id={certResult.id}
            courseTitle={courseTitle}
            learnerName={userName}
            completedAt={certResult.completedAt}
            hasQuiz={true}
            logoPath={logoPath}
            inlineMode={true}
          />
          <div className="flex gap-3 justify-center no-print">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-5 py-2.5 border border-[#D2D2D7] dark:border-[#3A3A3C] rounded-xl text-[13px] font-medium text-[#6E6E73] dark:text-[#8E8E93] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimer / Télécharger
            </button>
            <Link
              href="/dashboard/certificates"
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium rounded-xl transition-colors"
            >
              Mes certificats
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
