import { useEffect, useRef, useState } from "react";
import { Loader2, X, Sigma, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { BankQuestion } from "@/hooks/useQuestionBank";

// Limits keep payload small and prevent broken markdown from blowing up KaTeX.
const MAX_TEXT = 4000;
const MAX_OPTION = 1000;
const MAX_TOPIC = 120;
const MAX_EXPLANATION = 4000;

/** Strip control characters (except \n, \t) that can corrupt JSON payloads. */
const sanitize = (s: string) =>
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").normalize("NFC");

/** Lightweight LaTeX sanity check — balanced $ and {} so the request body is well-formed. */
const validateLatex = (s: string): string | null => {
  // Count unescaped $ — must be even (pairs of $...$ or $$...$$).
  const dollars = (s.match(/(?<!\\)\$/g) || []).length;
  if (dollars % 2 !== 0) return "Unbalanced '$' delimiters in LaTeX";
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\") { i++; continue; }
    if (s[i] === "{") depth++;
    else if (s[i] === "}") { depth--; if (depth < 0) return "Unbalanced '{}' braces in LaTeX"; }
  }
  if (depth !== 0) return "Unbalanced '{}' braces in LaTeX";
  return null;
};

const schema = z.object({
  subject: z.string().min(1).max(50),
  topic: z.string().max(MAX_TOPIC).nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  question_text: z.string().trim().min(1, "Question text required").max(MAX_TEXT),
  options: z.array(z.object({ id: z.number(), text: z.string().trim().min(1).max(MAX_OPTION) })).length(4),
  correct_answer: z.number().int().min(0).max(3),
  explanation: z.string().max(MAX_EXPLANATION).nullable(),
});

import MathRenderer from "@/components/MathRenderer";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: BankQuestion | null;
};

import { SUBJECTS } from "@/lib/constants";
const DIFFICULTIES = ["easy", "medium", "hard"];

const QuestionEditorDialog = ({ open, onClose, onSaved, initial }: Props) => {
  const { user } = useAuth();
  const [subject, setSubject] = useState("Physics");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [text, setText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [saving, setSaving] = useState(false);
  // Ref-based lock so rapid double-clicks within the same tick are blocked
  // before React state has a chance to flush.
  const inFlight = useRef(false);

  useEffect(() => {
    if (initial) {
      setSubject(initial.subject);
      setTopic(initial.topic || "");
      setDifficulty(initial.difficulty);
      setText(initial.question_text);
      setOptions(initial.options.map((o) => o.text).concat(["", "", "", ""]).slice(0, 4));
      setCorrect(typeof initial.correct_answer === "number" ? initial.correct_answer : 0);
      setExplanation(initial.explanation || "");
    } else {
      setSubject("Physics");
      setTopic("");
      setDifficulty("medium");
      setText("");
      setOptions(["", "", "", ""]);
      setCorrect(0);
      setExplanation("");
    }
  }, [initial, open]);

  if (!open) return null;

  const save = async () => {
    // Hard guard against duplicate submissions (double-click, Enter spam).
    if (inFlight.current || saving) return;
    if (!user) return toast.error("Sign in required");

    // Sanitize all string inputs first.
    const cleanText = sanitize(text).trim();
    const cleanTopic = sanitize(topic).trim();
    const cleanExplanation = sanitize(explanation).trim();
    const cleanOptions = options.map((o) => sanitize(o).trim());

    // LaTeX delimiter / brace validation across every authored field.
    for (const [label, value] of [
      ["Question", cleanText],
      ["Explanation", cleanExplanation],
      ...cleanOptions.map((o, i) => [`Option ${String.fromCharCode(65 + i)}`, o] as const),
    ] as const) {
      if (!value) continue;
      const err = validateLatex(value);
      if (err) return toast.error(`${label}: ${err}`);
    }

    const candidate = {
      subject,
      topic: cleanTopic || null,
      difficulty,
      question_text: cleanText,
      options: cleanOptions.map((t, id) => ({ id, text: t })),
      correct_answer: correct,
      explanation: cleanExplanation || null,
    };

    const parsed = schema.safeParse(candidate);
    if (!parsed.success) {
      return toast.error(parsed.error.issues[0]?.message || "Invalid input");
    }
    const payload = parsed.data;

    inFlight.current = true;
    setSaving(true);

    const runSave = async () => {
      if (initial) {
        return supabase.from("question_bank").update(payload as any).eq("id", initial.id);
      }
      return supabase.from("question_bank").insert({ ...(payload as any), created_by: user.id });
    };

    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        await supabase.auth.refreshSession();
      }

      let res = await runSave();
      if (res.error && /failed to fetch|network/i.test(res.error.message)) {
        await new Promise((r) => setTimeout(r, 600));
        res = await runSave();
      }
      if (res.error) {
        toast.error(res.error.message);
        return;
      }
      toast.success(initial ? "Question updated" : "Question added");
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.message || "Save failed";
      if (/failed to fetch/i.test(msg)) {
        toast.error("Network error — check your connection or disable ad/script blockers, then try again.");
      } else {
        toast.error(msg);
      }
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <h2 className="text-base font-bold text-foreground">{initial ? "Edit Question" : "New Question"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground">Subject</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Topic</label>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Kinematics" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none capitalize">
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-foreground">Equation tips:</span>
            <span className="inline-flex items-center gap-1"><Sigma className="h-3 w-3" /> Inline math: <code className="px-1 bg-background rounded">$x^2$</code></span>
            <span className="inline-flex items-center gap-1"><Sigma className="h-3 w-3" /> Block: <code className="px-1 bg-background rounded">$$\frac{`{a}{b}`}$$</code></span>
            <span className="inline-flex items-center gap-1"><FlaskConical className="h-3 w-3" /> Chemistry: <code className="px-1 bg-background rounded">$\ce{`{H2SO4}`}$</code></span>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">Question</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Solve $x^2 + 5x + 6 = 0$" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none resize-none font-mono" />
            {text && (
              <div className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                <MathRenderer content={text} />
              </div>
            )}
          </div>

          {options.map((opt, oi) => (
            <div key={oi} className="flex items-start gap-2">
              <input type="radio" checked={correct === oi} onChange={() => setCorrect(oi)} className="shrink-0 mt-3" />
              <span className="text-xs font-bold w-5 mt-3">{String.fromCharCode(65 + oi)}.</span>
              <div className="flex-1 space-y-1">
                <input
                  value={opt}
                  onChange={(e) => {
                    const next = [...options];
                    next[oi] = e.target.value;
                    setOptions(next);
                  }}
                  placeholder={`Option ${oi + 1} (LaTeX allowed: $x=2$)`}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none font-mono"
                />
                {opt && (
                  <div className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
                    <MathRenderer content={opt} inline />
                  </div>
                )}
              </div>
            </div>
          ))}

          <div>
            <label className="text-xs font-semibold text-foreground">Explanation (optional)</label>
            <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none resize-none font-mono" />
            {explanation && (
              <div className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                <MathRenderer content={explanation} />
              </div>
            )}
          </div>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-card px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground">Cancel</button>
          <button disabled={saving} onClick={save} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 inline-flex items-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionEditorDialog;
