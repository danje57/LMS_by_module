"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, ChevronRight, RotateCcw, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  order: number;
  type: "qcm" | "vrai_faux";
  question: string;
  choiceA: string | null;
  choiceB: string | null;
  choiceC: string | null;
  choiceD: string | null;
  correctAnswer: string;
  allowMultiple: boolean;
  explanation: string | null;
}

interface Props {
  courseId: string;
  passingScore: number;
  onClose?: () => void;
}

type Phase = "loading" | "ready" | "playing" | "reviewing" | "result";

function normalize(answer: string) {
  return answer.split(",").map((s) => s.trim().toLowerCase()).sort().join(",");
}

function isCorrect(question: Question, answer: string): boolean {
  return normalize(question.correctAnswer) === normalize(answer);
}

export function QuizPlayer({ courseId, passingScore, onClose }: Props) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

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

    await fetch(`/api/courses/${courseId}/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, score, passed }),
    });

    setPhase("result");
  }

  if (phase === "loading") {
    return <div className="py-12 text-center text-[13px] text-[#6E6E73]">Chargement du quiz…</div>;
  }

  if (phase === "ready") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
          <Trophy className="w-8 h-8 text-amber-500" />
        </div>
        <div>
          <h2 className="text-[20px] font-semibold text-[#1D1D1F]">Quiz disponible</h2>
          <p className="mt-1 text-[14px] text-[#6E6E73]">
            {questions.length} question(s) · Score minimum : {passingScore}%
          </p>
        </div>
        <button onClick={startQuiz}
          className="px-8 py-3 bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium rounded-2xl transition-colors">
          Commencer le quiz
        </button>
        {onClose && (
          <button onClick={onClose} className="text-[13px] text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">
            Revenir au cours
          </button>
        )}
      </div>
    );
  }

  if (phase === "playing") {
    const choices: { letter: string; value: string | null }[] = [
      { letter: "A", value: q.choiceA },
      { letter: "B", value: q.choiceB },
      { letter: "C", value: q.choiceC },
      { letter: "D", value: q.choiceD },
    ].filter((c) => c.value);

    const canAdvance = selectedAnswer.length > 0;

    return (
      <div className="max-w-2xl mx-auto space-y-6 py-4">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-[12px] text-[#6E6E73]">
            <span>Question {current + 1} / {questions.length}</span>
            {q.allowMultiple && <span className="text-amber-600 font-medium">Plusieurs réponses possibles</span>}
          </div>
          <div className="h-1.5 bg-[#E5E5EA] rounded-full overflow-hidden">
            <div className="h-full bg-[#0071E3] rounded-full transition-all"
              style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
          </div>
        </div>

        {/* Question */}
        <p className="text-[18px] font-semibold text-[#1D1D1F] leading-snug">{q.question}</p>

        {/* Choices */}
        <div className="space-y-2.5">
          {q.type === "qcm" ? choices.map(({ letter, value }) => {
            const isSelected = selectedSet.has(letter);
            return (
              <button key={letter} type="button" onClick={() => handleSelect(letter)}
                className={cn("w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-all",
                  isSelected
                    ? "border-[#0071E3] bg-[#0071E3]/5 text-[#1D1D1F]"
                    : "border-[#E5E5EA] bg-white text-[#1D1D1F] hover:border-[#D2D2D7]")}>
                <span className={cn("w-7 h-7 rounded-lg text-[13px] font-bold flex items-center justify-center shrink-0 transition-all",
                  isSelected ? "bg-[#0071E3] text-white" : "bg-[#F5F5F7] text-[#6E6E73]")}>{letter}</span>
                <span className="text-[14px]">{value}</span>
              </button>
            );
          }) : (
            <div className="flex gap-3">
              {["vrai", "faux"].map((v) => (
                <button key={v} type="button" onClick={() => handleSelect(v)}
                  className={cn("flex-1 py-3.5 rounded-2xl border-2 text-[15px] font-medium capitalize transition-all",
                    selectedAnswer === v
                      ? "border-[#0071E3] bg-[#0071E3]/5 text-[#0071E3]"
                      : "border-[#E5E5EA] bg-white text-[#1D1D1F] hover:border-[#D2D2D7]")}>
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-2">
          {onClose && (
            <button onClick={onClose} className="text-[13px] text-[#ADADB8] hover:text-[#6E6E73] transition-colors">
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
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Récapitulatif</h2>
        <p className="text-[13px] text-[#6E6E73]">Vérifiez vos réponses avant de valider.</p>
        <div className="space-y-2">
          {questions.map((q, i) => {
            const given = answers[q.id] ?? "";
            const correct = isCorrect(q, given);
            return (
              <div key={q.id} className={cn("flex items-start gap-3 p-4 rounded-2xl border",
                correct ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100")}>
                {correct ? <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#1D1D1F]">#{i + 1} {q.question}</p>
                  <p className="text-[12px] mt-0.5">
                    <span className="text-[#6E6E73]">Votre réponse : </span>
                    <span className={correct ? "text-green-700 font-medium" : "text-red-600 font-medium"}>
                      {given || "(sans réponse)"}
                    </span>
                    {!correct && (
                      <> · <span className="text-green-700">Bonne : {q.correctAnswer}</span></>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={() => { setCurrent(0); setPhase("playing"); }}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-[#D2D2D7] rounded-xl text-[13px] font-medium text-[#6E6E73] hover:bg-[#F5F5F7] transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Revoir
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
    <div className="max-w-2xl mx-auto py-8 space-y-6 text-center">
      <div className={cn("w-20 h-20 rounded-3xl flex items-center justify-center mx-auto",
        passed ? "bg-green-50" : "bg-red-50")}>
        {passed
          ? <Trophy className="w-10 h-10 text-green-500" />
          : <XCircle className="w-10 h-10 text-red-500" />}
      </div>
      <div>
        <p className="text-[40px] font-bold text-[#1D1D1F]">{score}%</p>
        <p className={cn("text-[16px] font-semibold mt-1", passed ? "text-green-600" : "text-red-600")}>
          {passed ? "Félicitations, quiz réussi !" : "Quiz non validé"}
        </p>
        <p className="text-[13px] text-[#6E6E73] mt-1">
          {correct} / {total} bonnes réponses · Seuil : {passingScore}%
        </p>
      </div>

      {/* Per-question review */}
      <div className="text-left space-y-3">
        {questions.map((q, i) => {
          const given = answers[q.id] ?? "";
          const ok = isCorrect(q, given);
          return (
            <div key={q.id} className={cn("p-4 rounded-2xl border",
              ok ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100")}>
              <div className="flex items-start gap-2">
                {ok ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-[#1D1D1F]">#{i + 1} {q.question}</p>
                  {!ok && (
                    <p className="text-[12px] mt-0.5 text-red-600">
                      Votre réponse : {given || "—"} · <span className="text-green-700">Bonne : {q.correctAnswer}</span>
                    </p>
                  )}
                  {q.explanation && <p className="text-[12px] mt-1 text-[#6E6E73] italic">{q.explanation}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 justify-center pt-2">
        <button onClick={startQuiz}
          className="flex items-center gap-1.5 px-5 py-2.5 border border-[#D2D2D7] rounded-xl text-[13px] font-medium text-[#6E6E73] hover:bg-[#F5F5F7] transition-colors">
          <RotateCcw className="w-3.5 h-3.5" /> Réessayer
        </button>
        {onClose && (
          <button onClick={onClose}
            className="px-5 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium rounded-xl transition-colors">
            Retour au cours
          </button>
        )}
      </div>
    </div>
  );
}
