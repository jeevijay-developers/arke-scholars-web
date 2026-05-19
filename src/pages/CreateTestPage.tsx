import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, GripVertical, BookMarked } from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "sonner";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import QuestionBankPanel from "@/components/QuestionBankPanel";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { BankQuestion } from "@/hooks/useQuestionBank";
import { useExams } from "@/hooks/useExams";

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type DraftQuestion = {
  source: "manual" | "bank";
  bank_id?: string;
  subject: string;
  topic: string;
  text: string;
  options: string[];
  correct: number;
};

const blankQuestion = (): DraftQuestion => ({
  source: "manual",
  subject: "Physics",
  topic: "",
  text: "",
  options: ["", "", "", ""],
  correct: 0,
});

const fromBank = (q: BankQuestion): DraftQuestion => {
  // Drag-into-test only supports SCQ-style questions. Other types fall through with empty options.
  const opts = Array.isArray(q.options) ? q.options.map((o) => o.text) : ["", "", "", ""];
  // correct_answer is polymorphic:
  //   legacy SCQ:        number (0-indexed)
  //   new SCQ/MCQ/AR:    number[] (1-indexed)
  //   integer:           number
  //   match_column:      string
  const ca = q.correct_answer;
  const correct = typeof ca === "number"
    ? ca
    : Array.isArray(ca) && typeof ca[0] === "number"
      ? Math.max(0, ca[0] - 1)
      : 0;
  return {
    source: "bank",
    bank_id: q.id,
    subject: q.subject,
    topic: q.topic || "",
    text: q.question_text,
    options: opts,
    correct,
  };
};

const DropZone = ({ children, empty }: { children: React.ReactNode; empty: boolean }) => {
  const { setNodeRef, isOver } = useDroppable({ id: "test-drop" });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 border-dashed transition-colors ${isOver ? "border-primary bg-primary/5" : "border-border"} ${empty ? "min-h-[120px] flex items-center justify-center p-6" : "p-2 space-y-2"}`}
    >
      {empty ? (
        <p className="text-xs text-muted-foreground text-center">
          Drag questions from the Question Bank, or add a manual question below.
        </p>
      ) : children}
    </div>
  );
};

const CreateTestPage = () => {
  const { exams: examList } = useExams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ testId?: string; slug?: string }>();
  const slugParam = params.slug;
  const testIdParam = params.testId;

  const isAdminContext = location.pathname.startsWith("/admin");
  const isEditMode = Boolean(slugParam || testIdParam);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [testType, setTestType] = useState("mock");
  const [examPattern, setExamPattern] = useState("jee-main");
  const [duration, setDuration] = useState(180);
  const [correctMarks, setCorrectMarks] = useState(4);
  const [wrongMarks, setWrongMarks] = useState(-1);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEditMode);
  const [bankSheetOpen, setBankSheetOpen] = useState(false);
  const [courseId, setCourseId] = useState<string>("");
  const [myCourses, setMyCourses] = useState<{ id: string; name: string }[]>([]);
  const [resolvedTestId, setResolvedTestId] = useState<string | null>(testIdParam ?? null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Load courses (admin sees all, teacher sees own)
  useEffect(() => {
    if (!user) return;
    let ignore = false;
    (async () => {
      const q = supabase.from("courses").select("id,name").order("created_at", { ascending: false });
      const { data } = isAdminContext ? await q : await q.eq("created_by", user.id);
      if (!ignore) setMyCourses(data ?? []);
    })();
    return () => { ignore = true; };
  }, [user, isAdminContext]);

  // Load existing test for edit mode (by slug or id)
  useEffect(() => {
    if (!isEditMode) return;
    let ignore = false;
    (async () => {
      const baseQ = supabase.from("tests").select("*");
      const { data: test } = slugParam
        ? await baseQ.eq("slug", slugParam).maybeSingle()
        : await baseQ.eq("id", testIdParam!).maybeSingle();
      if (ignore) return;
      if (!test) {
        toast.error("Test not found");
        navigate(isAdminContext ? "/admin/tests" : "/teacher/dashboard");
        return;
      }
      const { data: tqs } = await supabase
        .from("test_questions")
        .select("*")
        .eq("test_id", test.id)
        .order("position");
      if (ignore) return;
      setResolvedTestId(test.id);
      setTitle(test.title ?? "");
      setDescription(test.description ?? "");
      setTestType(test.test_type ?? "mock");
      setExamPattern(test.exam_pattern ?? "jee-main");
      setDuration(test.duration_minutes ?? 180);
      setCorrectMarks(Number(test.correct_marks ?? 4));
      setWrongMarks(Number(test.wrong_marks ?? -1));
      setCourseId(test.course_id ?? "");
      setQuestions(
        (tqs ?? []).map((q: any) => ({
          source: "manual" as const,
          subject: q.subject ?? "Physics",
          topic: q.topic ?? "",
          text: q.question_text ?? "",
          options: Array.isArray(q.options)
            ? q.options.map((o: any) => (typeof o === "string" ? o : o?.text ?? ""))
            : ["", "", "", ""],
          correct: typeof q.correct_answer === "number" ? q.correct_answer : 0,
        })),
      );
      setLoading(false);
    })();
    return () => { ignore = true; };
  }, [isEditMode, slugParam, testIdParam, isAdminContext, navigate]);

  const updateQ = (i: number, patch: Partial<DraftQuestion>) => {
    const next = [...questions];
    next[i] = { ...next[i], ...patch };
    setQuestions(next);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    if (e.over?.id !== "test-drop") return;
    const bankQ = e.active.data.current?.question as BankQuestion | undefined;
    if (!bankQ) return;
    if (questions.some((q) => q.bank_id === bankQ.id)) {
      toast.info("Already added to this test");
      return;
    }
    setQuestions((prev) => [...prev, fromBank(bankQ)]);
    toast.success("Question added");
  };

  const submit = async (publish: boolean) => {
    if (!user) return toast.error("Sign in required");
    if (!title.trim()) return toast.error("Title required");
    const validQ = questions.filter((q) => q.text.trim() && q.options.every((o) => o.trim()));
    if (validQ.length === 0) return toast.error("Add at least one complete question");

    setSubmitting(true);

    const subjects = Array.from(new Set(validQ.map((q) => q.subject)));

    const basePayload = {
      title,
      description,
      test_type: testType,
      exam_pattern: examPattern,
      subjects,
      duration_minutes: duration,
      correct_marks: correctMarks,
      wrong_marks: wrongMarks,
      total_questions: validQ.length,
      total_marks: validQ.length * correctMarks,
      is_published: publish,
      course_id: courseId || null,
    };

    let savedTestId: string | null = resolvedTestId;

    if (isEditMode && resolvedTestId) {
      const { error } = await supabase.from("tests").update(basePayload).eq("id", resolvedTestId);
      if (error) {
        toast.error(error.message);
        setSubmitting(false);
        return;
      }
      // Replace questions
      await supabase.from("test_questions").delete().eq("test_id", resolvedTestId);
    } else {
      const slug = `${slugify(title)}-${Date.now().toString(36)}`;
      const { data: test, error } = await supabase
        .from("tests")
        .insert({ ...basePayload, slug, created_by: user.id })
        .select("id")
        .single();
      if (error || !test) {
        toast.error(error?.message ?? "Could not create test");
        setSubmitting(false);
        return;
      }
      savedTestId = test.id;
    }

    const rows = validQ.map((q, i) => ({
      test_id: savedTestId,
      position: i,
      subject: q.subject,
      topic: q.topic || null,
      question_text: q.text,
      question_type: "mcq-single",
      options: q.options.map((t, id) => ({ id, text: t })),
      correct_answer: q.correct,
      marks_correct: correctMarks,
      marks_wrong: wrongMarks,
    }));
    const { error: qErr } = await supabase.from("test_questions").insert(rows);
    if (qErr) {
      toast.error(qErr.message);
      setSubmitting(false);
      return;
    }

    toast.success(
      isEditMode
        ? publish
          ? "Test updated and published"
          : "Test saved as draft"
        : publish
          ? "Test published"
          : "Draft saved",
    );
    setSubmitting(false);
    navigate(isAdminContext ? "/admin/tests" : "/teacher/dashboard");
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
  const labelCls = "block text-xs font-semibold text-foreground mb-1.5";

  const LeftPane = (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {isEditMode ? "Edit Test" : "Create New Test"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drag questions from the bank on the right, or add manual ones.
          </p>
        </div>
      </div>

      {/* Test Details card */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
        <h2 className="text-lg font-bold text-foreground">Test Details</h2>

        <div>
          <label className={labelCls}>Test Name</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Class 11 Maths Practice — Trigonometry"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Test Type</label>
            <select value={testType} onChange={(e) => setTestType(e.target.value)} className={inputCls}>
              <option value="mock">Mock Test</option>
              <option value="chapter">Chapter Test</option>
              <option value="pyq">Previous Year</option>
              <option value="practice">Practice</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Exam Pattern</label>
            <select value={examPattern} onChange={(e) => setExamPattern(e.target.value)} className={inputCls}>
              {examList.length === 0 && (
                <>
                  <option value="jee-main">JEE Main</option>
                  <option value="jee-advanced">JEE Advanced</option>
                  <option value="neet">NEET</option>
                </>
              )}
              {examList.map((x) => (
                <option key={x.id} value={x.code || x.name.toLowerCase().replace(/\s+/g, "-")}>
                  {x.name}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Associate with Course</label>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={inputCls}>
            <option value="">Standalone test (not linked to any course)</option>
            {myCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Linked tests will appear inside the selected course for enrolled students.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Duration (min)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 0)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Correct marks</label>
            <input
              type="number"
              value={correctMarks}
              onChange={(e) => setCorrectMarks(Number(e.target.value) || 0)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Wrong marks</label>
            <input
              type="number"
              value={wrongMarks}
              onChange={(e) => setWrongMarks(Number(e.target.value) || 0)}
              className={inputCls}
            />
          </div>
        </div>
      </section>

      {/* Selected Questions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-lg font-bold text-foreground">
            Selected Questions <span className="text-muted-foreground font-semibold">({questions.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <Sheet open={bankSheetOpen} onOpenChange={setBankSheetOpen}>
              <SheetTrigger asChild>
                <button className="lg:hidden inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted">
                  <BookMarked className="h-3.5 w-3.5" /> Open Bank
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="p-0 w-full sm:max-w-md">
                <div className="h-full">
                  <QuestionBankPanel draggable compact />
                </div>
              </SheetContent>
            </Sheet>
            <button
              onClick={() => setQuestions([...questions, blankQuestion()])}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> Add Manual
            </button>
          </div>
        </div>

        <DropZone empty={questions.length === 0}>
          {questions.map((q, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-bold text-foreground">
                  Q{i + 1}
                </span>
                {q.source === "bank" && (
                  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                    From Bank
                  </span>
                )}
                <select
                  value={q.subject}
                  onChange={(e) => updateQ(i, { subject: e.target.value })}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none"
                >
                  <option>Physics</option>
                  <option>Chemistry</option>
                  <option>Mathematics</option>
                  <option>Biology</option>
                </select>
                <input
                  value={q.topic}
                  onChange={(e) => updateQ(i, { topic: e.target.value })}
                  placeholder="Topic"
                  className="flex-1 min-w-[120px] rounded-md border border-border bg-background px-2 py-1 text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={() => setQuestions(questions.filter((_, j) => j !== i))}
                  className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  aria-label="Remove question"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={q.text}
                onChange={(e) => updateQ(i, { text: e.target.value })}
                placeholder="Question text..."
                rows={2}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none resize-none"
              />
              <div className="space-y-1.5">
                {q.options.map((opt, oi) => {
                  const isCorrect = q.correct === oi;
                  return (
                    <label
                      key={oi}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 cursor-pointer transition-colors ${isCorrect
                        ? "border-secondary bg-secondary/10"
                        : "border-border bg-background hover:border-primary/40"
                        }`}
                    >
                      <input
                        type="radio"
                        checked={isCorrect}
                        onChange={() => updateQ(i, { correct: oi })}
                        className="shrink-0 accent-secondary"
                      />
                      <span className="text-xs font-bold w-5 text-foreground">
                        {String.fromCharCode(65 + oi)}.
                      </span>
                      <input
                        value={opt}
                        onChange={(e) => {
                          const next = [...q.options];
                          next[oi] = e.target.value;
                          updateQ(i, { options: next });
                        }}
                        placeholder={`Option ${oi + 1}`}
                        className="flex-1 bg-transparent text-sm outline-none"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </DropZone>
      </section>
    </div>
  );

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex">
        {/* Left pane (form) */}
        <div className="flex-1 lg:w-1/2 lg:flex-none px-4 md:px-8 py-6 pb-28 lg:pb-24">
          <div className="max-w-3xl mx-auto">{LeftPane}</div>
        </div>

        {/* Right pane (Question Bank) — desktop only, sticky with its own scroll */}
        <aside className="hidden lg:flex lg:w-1/2 border-l border-border bg-muted/30 flex-col sticky top-[57px] self-start h-[calc(100vh-57px)]">
          <QuestionBankPanel draggable compact />
        </aside>
      </div>

      {/* Floating action bar — fixed on desktop (scoped to left editor pane), full-width on mobile */}
      <div className="w-full fixed  bottom-0 left-0 right-0 z-20 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:left-[240px] lg:right-1/2">
        <div className="px-4 md:px-8 py-3">
          <div className="max-w-3xl flex gap-3 mx-auto">
            <button
              disabled={submitting}
              onClick={() => submit(false)}
              className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Save Draft"}
            </button>
            <button
              disabled={submitting}
              onClick={() => submit(true)}
              className="flex-1 rounded-xl bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              ) : isEditMode ? (
                "Save & Publish"
              ) : (
                "Publish Test"
              )}
            </button>
          </div>
        </div>
      </div>
    </DndContext>
  );
};

export default CreateTestPage;
