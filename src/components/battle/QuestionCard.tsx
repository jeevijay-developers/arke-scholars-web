import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";
import type { AnswerFeedback, BattleQuestion } from "@/hooks/useBattleRoom";

type Props = {
  question: BattleQuestion;
  questionNumber: number;
  totalQuestions: number;
  timeLeft: number;
  feedback: AnswerFeedback | null;
  submitting: boolean;
  onAnswer: (optionIndex: number) => void;
};

const OPTION_LABELS = ["A", "B", "C", "D"];

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  timeLeft,
  feedback,
  submitting,
  onAnswer,
}: Props) {
  const options: string[] = Array.isArray(question.options)
    ? question.options
    : Object.values(question.options ?? {});

  const timerFraction = timeLeft / 30;
  const timerColor =
    timeLeft > 15 ? "bg-emerald-500" : timeLeft > 7 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex flex-col gap-5">
      {/* Progress + timer */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Question {questionNumber} of {totalQuestions}</span>
        <span className={cn("font-semibold tabular-nums", timeLeft <= 7 && "text-red-500")}>
          {timeLeft}s
        </span>
      </div>

      {/* Timer bar */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-1000", timerColor)}
          style={{ width: `${timerFraction * 100}%` }}
        />
      </div>

      {/* Question text */}
      <p className="text-base font-medium leading-relaxed">{question.question_text}</p>

      {/* Options */}
      <div className="grid grid-cols-1 gap-3">
        {options.map((opt, idx) => {
          const isSelected = feedback?.selectedOptionIndex === idx;
          const isCorrect = feedback?.correctOptionIndex === idx;
          const isWrong = isSelected && !isCorrect && feedback !== null;
          const isMissed = isCorrect && !isSelected && feedback !== null;

          return (
            <button
              key={idx}
              disabled={feedback !== null || submitting}
              onClick={() => onAnswer(idx)}
              className={cn(
                "flex items-center gap-3 w-full rounded-xl border p-3.5 text-left text-sm font-medium transition-all",
                "hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                feedback === null && !submitting && "cursor-pointer",
                (feedback !== null || submitting) && "cursor-not-allowed",
                isCorrect && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300",
                isWrong && "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300",
                !isCorrect && !isWrong && feedback !== null && "opacity-50",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                  isCorrect && "border-emerald-500 bg-emerald-500 text-white",
                  isWrong && "border-red-500 bg-red-500 text-white",
                  !isCorrect && !isWrong && "border-muted-foreground/40",
                )}
              >
                {OPTION_LABELS[idx]}
              </span>
              <span className="flex-1">{opt}</span>
              {isCorrect && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
              {isWrong && <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={cn(
            "rounded-lg px-4 py-2.5 text-sm font-semibold text-center",
            feedback.isCorrect
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
          )}
        >
          {feedback.isCorrect
            ? `Correct! +${feedback.pointsEarned} pts`
            : feedback.selectedOptionIndex === null
              ? "Time's up — 0 pts"
              : "Wrong answer — 0 pts"}
        </div>
      )}
    </div>
  );
}
