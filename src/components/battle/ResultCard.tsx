import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { AnswerFeedback, BattleQuestion } from "@/hooks/useBattleRoom";

type Props = {
  questions: BattleQuestion[];
  feedbackMap: Record<string, AnswerFeedback>;
};

const OPTION_LABELS = ["A", "B", "C", "D"];

export function ResultCard({ questions, feedbackMap }: Props) {
  if (questions.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Your Answers
      </h3>
      {questions.map((q, idx) => {
        const feedback = feedbackMap[q.id];
        const options: string[] = Array.isArray(q.options)
          ? q.options
          : Object.values(q.options ?? {});

        const isTimeout = feedback && feedback.selectedOptionIndex === null;
        const isCorrect = feedback?.isCorrect ?? false;

        return (
          <div
            key={q.id}
            className={cn(
              "rounded-xl border p-4 space-y-3",
              isCorrect
                ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                : isTimeout
                  ? "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
                  : feedback
                    ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20"
                    : "border-muted",
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">Q{idx + 1}</span>
                {isCorrect ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : isTimeout ? (
                  <Clock className="h-4 w-4 text-amber-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  isCorrect ? "text-emerald-600" : "text-muted-foreground",
                )}
              >
                +{feedback?.pointsEarned ?? 0} pts
              </span>
            </div>

            {/* Question text */}
            <p className="text-sm font-medium">{q.question_text}</p>

            {/* Options */}
            <div className="grid grid-cols-1 gap-1.5">
              {options.map((opt, oi) => {
                const isSelected = feedback?.selectedOptionIndex === oi;
                const isAnswerCorrect = feedback?.correctOptionIndex === oi;

                return (
                  <div
                    key={oi}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs",
                      isAnswerCorrect && "bg-emerald-100 text-emerald-700 font-semibold dark:bg-emerald-950/40 dark:text-emerald-300",
                      isSelected && !isAnswerCorrect && "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
                      !isAnswerCorrect && !isSelected && "text-muted-foreground",
                    )}
                  >
                    <span className="font-bold">{OPTION_LABELS[oi]}.</span>
                    <span>{opt}</span>
                    {isAnswerCorrect && (
                      <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    )}
                    {isSelected && !isAnswerCorrect && (
                      <XCircle className="ml-auto h-3.5 w-3.5 text-red-500 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Timeout note */}
            {isTimeout && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Time ran out — question skipped
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
