import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Flag, Clock, Loader2, AlertTriangle } from "lucide-react";
import SEO from "@/components/SEO";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import LatexRenderer from "@/components/LatexRenderer";

type TestQuestion = {
  id: string;
  position: number;
  subject: string | null;
  topic: string | null;
  question_text: string;
  question_image_url: string | null;
  question_type: string;
  options: { id: number; text: string; image?: string | null }[];
  marks_correct: number;
  marks_wrong: number;
};

type QStatus = "not-visited" | "answered" | "not-answered" | "marked" | "answered-marked";

function extractInlineOptions(html: string): { stem: string; options: { id: number; text: string }[] } | null {
  const matches = [...html.matchAll(/\(([1-4])\)\s+([^<(]*)/g)];
  if (matches.length < 2) return null;
  const firstIdx = html.search(/\([1-4]\)\s/);
  if (firstIdx < 0) return null;
  const stem = html.slice(0, firstIdx).replace(/<br\s*\/?>\s*$/i, "").trim();
  const options = matches.map((m) => ({ id: parseInt(m[1], 10), text: m[2].trim() }));
  return { stem, options };
}

type AnswerState = { selected?: number | null; multiSelected?: number[]; value?: string; mapping?: Record<string, string> };

const TestTakingPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [test, setTest] = useState<{ id: string; title: string; duration_minutes: number; total_questions: number } | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [statuses, setStatuses] = useState<Record<string, QStatus>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [tabSwitches, setTabSwitches] = useState(0);

  const lastSavedRef = useRef<number>(0);

  // Load test + existing in-progress attempt
  useEffect(() => {
    if (authLoading || !slug) return;
    if (!user) {
      navigate("/login");
      return;
    }
    (async () => {
      setLoading(true);
      const { data: t } = await supabase
        .from("tests")
        .select("id, title, duration_minutes, total_questions")
        .eq("slug", slug)
        .maybeSingle();
      if (!t) {
        toast.error("Test not found");
        navigate("/my-tests");
        return;
      }
      setTest(t);

      const { data: qs } = await supabase
        .from("test_questions")
        .select("id, position, subject, topic, question_text, question_image_url, question_type, options, marks_correct, marks_wrong")
        .eq("test_id", t.id)
        .order("position");
      setQuestions(((qs ?? []) as unknown as TestQuestion[]).map(q => {
        // Strip "Topic: xxx" that old parser versions baked into stem_html
        let questionText = q.question_text.replace(
          /(<br\s*\/?>)?\s*Topic\s*:\s*[^\n<]+/gi, ""
        ).trim();

        const opts = q.options as unknown as unknown[];
        if ((!opts || opts.length === 0) && q.question_type !== "integer" && q.question_type !== "match_column") {
          const extracted = extractInlineOptions(questionText);
          if (extracted) return { ...q, question_text: extracted.stem, options: extracted.options };
        }
        return { ...q, question_text: questionText };
      }));

      const { data: existing } = await supabase
        .from("test_attempts")
        .select("id, started_at, answers, question_statuses, status")
        .eq("user_id", user.id)
        .eq("test_id", t.id)
        .eq("status", "in_progress")
        .maybeSingle();

      if (existing) {
        setAttemptId(existing.id);
        setStartedAt(new Date(existing.started_at as string));
        setAnswers((existing.answers as Record<string, { selected: number | null }>) ?? {});
        setStatuses((existing.question_statuses as Record<string, QStatus>) ?? {});
        setStarted(true);
      }

      setLoading(false);
    })();
  }, [slug, user, authLoading, navigate]);

  // Timer
  useEffect(() => {
    if (!started || !startedAt || !test) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
      const remaining = Math.max(0, test.duration_minutes * 60 - elapsed);
      setSecondsLeft(remaining);
      if (remaining === 0) handleSubmit(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, startedAt, test]);

  // Anti-cheat: tab visibility
  useEffect(() => {
    if (!started) return;
    const handler = () => {
      if (document.hidden) {
        setTabSwitches((s) => s + 1);
        toast.warning("Tab switching is logged during tests");
      }
    };
    document.addEventListener("visibilitychange", handler);
    const noContext = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", noContext);
    return () => {
      document.removeEventListener("visibilitychange", handler);
      document.removeEventListener("contextmenu", noContext);
    };
  }, [started]);

  // Auto-save every 15s
  useEffect(() => {
    if (!attemptId) return;
    const t = setInterval(() => {
      autoSave();
    }, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, answers, statuses]);

  const autoSave = useCallback(async () => {
    if (!attemptId) return;
    if (Date.now() - lastSavedRef.current < 3000) return;
    lastSavedRef.current = Date.now();
    await supabase
      .from("test_attempts")
      .update({
        answers,
        question_statuses: statuses,
        time_spent_seconds: startedAt ? Math.floor((Date.now() - startedAt.getTime()) / 1000) : 0,
        metadata: { tab_switches: tabSwitches },
      })
      .eq("id", attemptId);
  }, [attemptId, answers, statuses, startedAt, tabSwitches]);

  const startAttempt = async () => {
    if (!user || !test) return;
    const { data, error } = await supabase
      .from("test_attempts")
      .insert({
        user_id: user.id,
        test_id: test.id,
        test_name: test.title,
        status: "in_progress",
        started_at: new Date().toISOString(),
        answers: {},
        question_statuses: {},
      })
      .select("id, started_at")
      .single();
    if (error || !data) {
      toast.error("Could not start test");
      return;
    }
    setAttemptId(data.id);
    setStartedAt(new Date(data.started_at as string));
    setStarted(true);
  };

  const q = questions[currentQ];
  const updateStatus = (id: string, status: QStatus) => setStatuses((prev) => ({ ...prev, [id]: status }));

  const isAnswered = (ans: AnswerState | undefined, qType: string) => {
    if (!ans) return false;
    if (qType === "mcq") return (ans.multiSelected?.length ?? 0) > 0;
    if (qType === "integer") return (ans.value?.trim() ?? "").length > 0;
    if (qType === "match_column") return Object.keys(ans.mapping ?? {}).length > 0;
    return ans.selected != null;
  };

  const handleSelect = (optId: number) => {
    if (!q) return;
    if (q.question_type === "mcq") {
      const prev = answers[q.id]?.multiSelected ?? [];
      const next = prev.includes(optId) ? prev.filter((x) => x !== optId) : [...prev, optId];
      setAnswers((a) => ({ ...a, [q.id]: { multiSelected: next } }));
      updateStatus(q.id, next.length > 0 ? "answered" : "not-answered");
    } else {
      setAnswers((a) => ({ ...a, [q.id]: { selected: optId } }));
      updateStatus(q.id, "answered");
    }
  };

  const handleIntegerInput = (val: string) => {
    if (!q) return;
    setAnswers((a) => ({ ...a, [q.id]: { value: val } }));
    updateStatus(q.id, val.trim() ? "answered" : "not-answered");
  };

  const handleMatchSelect = (key: string, val: string) => {
    if (!q) return;
    const prev = answers[q.id]?.mapping ?? {};
    const next = val ? { ...prev, [key]: val } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key));
    setAnswers((a) => ({ ...a, [q.id]: { mapping: next } }));
    updateStatus(q.id, Object.keys(next).length > 0 ? "answered" : "not-answered");
  };

  const handleNext = () => {
    autoSave();
    if (currentQ < questions.length - 1) setCurrentQ(currentQ + 1);
  };
  const handlePrev = () => currentQ > 0 && setCurrentQ(currentQ - 1);
  const handleMarkAndNext = () => {
    if (!q) return;
    updateStatus(q.id, isAnswered(answers[q.id], q.question_type) ? "answered-marked" : "marked");
    handleNext();
  };
  const handleClear = () => {
    if (!q) return;
    setAnswers((prev) => ({ ...prev, [q.id]: {} }));
    updateStatus(q.id, "not-answered");
  };

  const handleSubmit = async (auto = false) => {
    if (!attemptId) return;
    setSubmitting(true);
    await supabase
      .from("test_attempts")
      .update({
        answers,
        question_statuses: statuses,
        status: auto ? "auto_submitted" : "submitted",
        submitted_at: new Date().toISOString(),
        time_spent_seconds: startedAt ? Math.floor((Date.now() - startedAt.getTime()) / 1000) : 0,
        metadata: { tab_switches: tabSwitches },
      })
      .eq("id", attemptId);

    const { error } = await supabase.rpc("submit_test_attempt", { _attempt_id: attemptId });
    if (error) toast.error(error.message);

    navigate(`/tests/${slug}/result/${attemptId}`);
  };

  const counts = useMemo(() => {
    return questions.reduce(
      (acc, qq) => {
        const s = statuses[qq.id];
        if (s === "answered") acc.answered++;
        else if (s === "not-answered") acc.notAnswered++;
        else if (s === "marked") acc.marked++;
        else if (s === "answered-marked") acc.answeredMarked++;
        else acc.notVisited++;
        return acc;
      },
      { answered: 0, notAnswered: 0, marked: 0, answeredMarked: 0, notVisited: 0 },
    );
  }, [questions, statuses]);

  const getStatusColor = (s?: QStatus) => {
    switch (s) {
      case "answered":
        return "bg-secondary text-secondary-foreground";
      case "not-answered":
        return "bg-destructive text-destructive-foreground";
      case "marked":
        return "bg-accent text-accent-foreground";
      case "answered-marked":
        return "bg-primary text-primary-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!test) return null;

  if (!started) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-card rounded-2xl border border-border p-6 space-y-5">
          <h2 className="text-xl font-black font-display text-foreground text-center">{test.title}</h2>
          <p className="text-sm text-muted-foreground text-center">
            {questions.length} questions · {test.duration_minutes} minutes
          </p>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Important instructions
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li>Once started, the timer cannot be paused.</li>
              <li>Tab switching and right-click are logged.</li>
              <li>Your progress saves automatically every 15 seconds.</li>
              <li>The test auto-submits when time is up.</li>
            </ul>
          </div>
          <button onClick={startAttempt} className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground">
            Start Test
          </button>
          <Link to="/my-tests" className="block text-center text-xs text-muted-foreground hover:text-foreground">
            Back to test list
          </Link>
        </div>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">No questions available.</p>
      </div>
    );
  }

  const hrs = Math.floor(secondsLeft / 3600);
  const mins = Math.floor((secondsLeft % 3600) / 60);
  const secs = secondsLeft % 60;
  const lowTime = secondsLeft < 300;

  return (
    <div className="min-h-screen bg-background flex flex-col select-none">
      <SEO title={test.title} description={`Taking ${test.title} on ARKE Scholars.`} />
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{test.title}</p>
          <p className="text-[10px] text-muted-foreground">
            Question {currentQ + 1} / {questions.length}
          </p>
        </div>
        <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${lowTime ? "bg-destructive text-destructive-foreground" : "bg-primary/10 text-primary"}`}>
          <Clock className="h-4 w-4" /> {String(hrs).padStart(2, "0")}:{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row">
        <div className="flex-1 p-4 lg:p-6 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary uppercase">{q.subject}</span>
              {q.topic && <span>· {q.topic}</span>}
              <span className="ml-auto">+{q.marks_correct} / {q.marks_wrong}</span>
            </div>
            <div className="text-sm text-foreground leading-relaxed"><LatexRenderer html={q.question_text} /></div>
            {q.question_image_url && <img src={q.question_image_url} alt="" className="rounded-lg max-h-64" />}
            {/* Integer */}
            {q.question_type === "integer" && (
              <div className="flex justify-center py-2">
                <div className="space-y-2 text-center">
                  <p className="text-xs font-semibold text-muted-foreground">Enter your answer (integer / decimal)</p>
                  <input
                    type="number"
                    value={answers[q.id]?.value ?? ""}
                    onChange={(e) => handleIntegerInput(e.target.value)}
                    className="w-48 rounded-xl border-2 border-border px-4 py-3 text-center text-lg font-bold text-foreground focus:border-primary focus:outline-none"
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            {/* Match the column */}
            {q.question_type === "match_column" && (() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const opts = q.options as any;
              const col1: { key: string; value: string }[] = opts?.col1 ?? [];
              const col2: { key: string; value: string }[] = opts?.col2 ?? [];
              const mapping = answers[q.id]?.mapping ?? {};
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-xs font-bold text-muted-foreground uppercase tracking-wide pb-1 border-b border-border">
                    <span>Column I</span>
                    <span>Column II</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      {col1.map((entry) => (
                        <div key={entry.key} className="flex items-center gap-2">
                          <span className="w-8 shrink-0 font-bold text-primary">({entry.key})</span>
                          <span className="flex-1 text-xs text-foreground">{entry.value}</span>
                          <select
                            value={mapping[entry.key] ?? ""}
                            onChange={(e) => handleMatchSelect(entry.key, e.target.value)}
                            className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                          >
                            <option value="">—</option>
                            {col2.map((c2) => <option key={c2.key} value={c2.key}>{c2.key}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {col2.map((entry) => (
                        <div key={entry.key} className="flex items-center gap-2">
                          <span className="w-8 shrink-0 font-bold text-primary">({entry.key})</span>
                          <span className="text-xs text-foreground">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* SCQ / MCQ / Assertion-Reasoning options */}
            {q.question_type !== "integer" && q.question_type !== "match_column" && (() => {
              const opts = q.options as { id: number; text: string; image?: string | null }[];
              if (!opts?.length) return null;
              const isMcq = q.question_type === "mcq";
              const hasAnyImage = opts.some((o) => o.image);
              return (
                <div className={`grid gap-2 ${hasAnyImage ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
                  {opts.map((opt, idx) => {
                    const isSelected = isMcq
                      ? (answers[q.id]?.multiSelected ?? []).includes(opt.id)
                      : answers[q.id]?.selected === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleSelect(opt.id)}
                        className={`w-full text-left rounded-xl border-2 transition-all ${hasAnyImage ? "p-3" : "px-4 py-3"} text-sm ${isSelected ? "border-primary bg-primary/5 text-foreground" : "border-border hover:border-muted-foreground/40 text-foreground"}`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="font-bold shrink-0">{String.fromCharCode(65 + idx)}.</span>
                          <div className="flex-1 min-w-0">
                            {opt.text && <LatexRenderer html={opt.text} inline />}
                            {opt.image && (
                              <img
                                src={opt.image}
                                alt={`Option ${String.fromCharCode(65 + idx)}`}
                                className="mt-2 max-h-40 w-auto rounded-lg object-contain"
                              />
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={handlePrev} disabled={currentQ === 0} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground disabled:opacity-40 flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Previous
            </button>
            <button onClick={handleClear} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground">
              Clear
            </button>
            <button onClick={handleMarkAndNext} className="rounded-lg border border-accent/40 px-3 py-2 text-xs font-medium text-accent flex items-center gap-1">
              <Flag className="h-3 w-3" /> Mark & Next
            </button>
            <div className="flex w-full justify-between gap-4">
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="rounded-lg bg-secondary px-4 py-2 text-xs font-bold text-secondary-foreground disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Test"}
              </button>
              <button onClick={handleNext} disabled={currentQ === questions.length - 1} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40 flex items-center gap-1">
                Save & Next <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        <aside className="lg:w-[260px] border-t lg:border-t-0 lg:border-l border-border bg-card p-4">
          <p className="text-xs font-bold text-foreground mb-3">Question Palette</p>
          <div className="grid grid-cols-6 lg:grid-cols-5 gap-1.5">
            {questions.map((qq, idx) => (
              <button
                key={qq.id}
                onClick={() => setCurrentQ(idx)}
                className={`h-9 rounded-lg text-xs font-bold ${getStatusColor(statuses[qq.id])} ${idx === currentQ ? "ring-2 ring-primary" : ""}`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-1.5 text-[10px] text-muted-foreground">
            <p>· {counts.answered} Answered</p>
            <p>· {counts.notAnswered} Not Answered</p>
            <p>· {counts.marked} Marked</p>
            <p>· {counts.answeredMarked} Answered+Marked</p>
            <p>· {counts.notVisited} Not Visited</p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default TestTakingPage;
