import { useState } from "react";
import { Plus, Brain, Clock, Loader2, X, Sparkles, MessageCircle, ChevronDown, AlertTriangle, GraduationCap, Flag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useDoubts, type DoubtRow } from "@/hooks/useDoubts";
import { FormattedAnswer } from "@/components/FormattedAnswer";
import ReportDialog from "@/components/ReportDialog";
import { Button } from "@/components/ui/button";

const filterTabs = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "ai_solved", label: "AI Solved" },
  { key: "answered", label: "Answered" },
];

const subjectColors: Record<string, string> = {
  Physics: "bg-primary/10 text-primary",
  Chemistry: "bg-secondary/10 text-secondary",
  Maths: "bg-accent/10 text-accent",
  Mathematics: "bg-accent/10 text-accent",
  Biology: "bg-pink-500/10 text-pink-600",
};

const statusColor: Record<string, string> = {
  pending: "bg-amber-500",
  ai_solved: "bg-primary",
  answered: "bg-secondary",
  closed: "bg-muted-foreground",
};

const DoubtPage = () => {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAsk, setShowAsk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [subject, setSubject] = useState("Physics");
  const [question, setQuestion] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [answerMode, setAnswerMode] = useState<"ai" | "educator">("ai");

  const { doubts, loading } = useDoubts("mine");

  const filtered = activeFilter === "all" ? doubts : doubts.filter((d) => d.status === activeFilter);

  const submitDoubt = async () => {
    if (!user) return toast.error("Sign in required");
    if (question.trim().length < 5) return toast.error("Please describe your doubt");
    setSubmitting(true);

    let imageUrl: string | null = null;
    if (imageFile) {
      const path = `doubts/${user.id}/${Date.now()}-${imageFile.name}`;
      const { error: upErr } = await supabase.storage.from("educator-uploads").upload(path, imageFile);
      if (!upErr) imageUrl = supabase.storage.from("educator-uploads").getPublicUrl(path).data.publicUrl;
    }

    const { data: doubt, error } = await supabase
      .from("doubts")
      .insert({ user_id: user.id, subject, question_text: question.trim(), image_url: imageUrl, status: "pending" })
      .select("id")
      .single();

    if (error || !doubt) {
      toast.error(error?.message ?? "Could not submit doubt");
      setSubmitting(false);
      return;
    }

    setShowAsk(false);
    setQuestion("");
    setImageFile(null);
    setSubmitting(false);

    if (answerMode === "educator") {
      toast.success("Doubt sent to an educator — you'll be notified when they respond.");
      return;
    }

    toast.success("Doubt submitted — generating AI answer...");

    // Fire AI solver
    try {
      const res = await supabase.functions.invoke("ai-doubt-solver", {
        body: { doubtId: doubt.id, subject, question: question.trim() },
      });
      if (res.data?.busy) {
        toast.warning("AI is currently busy. Please wait a moment and try again.", { duration: 7000 });
      } else if (res.error) {
        toast.error("Could not get an AI answer. A teacher will respond soon.", { duration: 7000 });
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="pb-20 lg:pb-0">
      <div className="p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between animate-fade-in-up">
          <h2 className="text-lg font-black font-display text-foreground">My Doubts</h2>
          <button
            onClick={() => setShowAsk(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" /> Ask New Doubt
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeFilter === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="font-display text-lg font-bold text-foreground">No doubts yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Ask your first doubt — AI will respond instantly.</p>
          </div>
        ) : (
          <div className="space-y-3 stagger-children">
            {filtered.map((d) => (
              <DoubtCard key={d.id} doubt={d} expanded={expanded === d.id} onToggle={() => setExpanded(expanded === d.id ? null : d.id)} />
            ))}
          </div>
        )}
      </div>

      {showAsk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAsk(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-card p-5 border border-border shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">Ask a doubt</h3>
              <button onClick={() => setShowAsk(false)}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Subject</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
                <option>Physics</option>
                <option>Chemistry</option>
                <option>Mathematics</option>
                <option>Biology</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Your question</label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={5}
                placeholder="Describe your doubt clearly..."
                className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none resize-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Attach image (optional)</label>
              <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} className="mt-1 w-full text-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Who should answer?</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAnswerMode("ai")}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                    answerMode === "ai" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> AI
                  </span>
                  <span className="text-[10px] text-muted-foreground">Instant answer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAnswerMode("educator")}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                    answerMode === "educator" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <GraduationCap className="h-3.5 w-3.5 text-secondary" /> Educator
                  </span>
                  <span className="text-[10px] text-muted-foreground">Best for complex doubts</span>
                </button>
              </div>
              {answerMode === "ai" ? (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  AI generated answer might be incorrect — for complex doubts, ask a teacher.
                </div>
              ) : (
                <p className="mt-2 text-[10px] text-muted-foreground">An educator will respond. This may take some time.</p>
              )}
            </div>
            <button
              disabled={submitting}
              onClick={submitDoubt}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : answerMode === "ai" ? <Sparkles className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
              {submitting ? "Submitting..." : answerMode === "ai" ? "Submit & get AI answer" : "Send to educator"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const DoubtCard = ({ doubt, expanded, onToggle }: { doubt: DoubtRow; expanded: boolean; onToggle: () => void }) => {
  const [teacherAnswers, setTeacherAnswers] = useState<{ id: string; answer_text: string; responder_role: string; responder_id: string; responder_name?: string; created_at: string }[]>([]);

  const loadAnswers = async () => {
    const { data } = await supabase
      .from("doubt_answers")
      .select("id, answer_text, responder_role, responder_id, created_at")
      .eq("doubt_id", doubt.id)
      .order("created_at");
    const list = (data ?? []) as typeof teacherAnswers;
    const ids = Array.from(new Set(list.map((a) => a.responder_id).filter(Boolean)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      const nameMap = new Map((profs ?? []).map((p: any) => [p.user_id, p.full_name]));
      list.forEach((a) => { a.responder_name = nameMap.get(a.responder_id) || a.responder_role; });
    }
    setTeacherAnswers(list);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
      <button
        onClick={() => {
          onToggle();
          if (!expanded) loadAnswers();
        }}
        className="flex items-start gap-3 w-full text-left"
      >
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${statusColor[doubt.status] ?? "bg-muted-foreground"}`} />
        <div className="flex-1 min-w-0">
          <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${subjectColors[doubt.subject] ?? "bg-muted text-foreground"}`}>{doubt.subject}</span>
          <p className="text-sm text-foreground mt-1 line-clamp-2">{doubt.question_text}</p>
          <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{new Date(doubt.created_at).toLocaleString()}</span>
            <span className="ml-auto capitalize">{doubt.status.replace("_", " ")}</span>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 pt-3 border-t border-border">
          {doubt.image_url && (
            <div className="relative inline-block">
              <img src={doubt.image_url} alt="Doubt" className="rounded-lg max-h-48" />
              <button
                type="button"
                onClick={async () => {
                  await supabase.from("doubts").update({ image_url: null }).eq("id", doubt.id);
                }}
                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/90 border border-border flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors shadow"
                aria-label="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {doubt.ai_answer && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[11px] font-bold text-primary uppercase flex items-center gap-1"><Brain className="h-3 w-3" /> AI answer</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  AI generated answer might be incorrect
                </span>
              </div>
              <FormattedAnswer content={doubt.ai_answer} tone="primary" className="text-xs" />
            </div>
          )}
          {teacherAnswers.map((a) => (
            <div key={a.id} className="rounded-lg bg-secondary/5 border border-secondary/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold text-secondary uppercase">
                  {a.responder_name || a.responder_role} · {a.responder_role}
                </p>
                {(a.responder_role === "teacher" || a.responder_role === "mentor") && a.responder_id && (
                  <ReportDialog
                    reportedName={a.responder_name || a.responder_role}
                    reportedRole={a.responder_role as "teacher" | "mentor"}
                    reportedUserId={a.responder_id}
                    trigger={
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-destructive hover:text-destructive">
                        <Flag className="h-3 w-3" /> Report
                      </Button>
                    }
                  />
                )}
              </div>
              <FormattedAnswer content={a.answer_text} tone="secondary" className="text-xs" />
            </div>
          ))}
          {!doubt.ai_answer && teacherAnswers.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Awaiting answer...</p>
          )}
        </div>
      )}
    </div>
  );
};

export default DoubtPage;
