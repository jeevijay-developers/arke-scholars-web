import { useEffect, useState } from "react";
import { Search, Check, X, Eye, Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/components/ConfirmDialog";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/TablePagination";

type TestQuestionRow = {
  subject: string;
  topic: string | null;
  question_text: string;
  question_image_url: string | null;
  question_type: string;
  options: unknown;
  correct_answer: unknown;
  explanation: string | null;
  difficulty: string | null;
  marks_correct: number | null;
  marks_wrong: number | null;
};

// Copy a test's questions into the question_bank so they survive the test deletion.
// Returns the number of questions archived (0 if the test had none).
async function archiveTestQuestionsToBank(testId: string, createdBy: string | null): Promise<number> {
  const { data: qs, error: fetchErr } = await supabase
    .from("test_questions")
    .select(
      "subject, topic, question_text, question_image_url, question_type, options, correct_answer, explanation, difficulty, marks_correct, marks_wrong",
    )
    .eq("test_id", testId);

  if (fetchErr) throw new Error(`Could not load questions: ${fetchErr.message}`);
  if (!qs || qs.length === 0) return 0;

  const bankRows = (qs as TestQuestionRow[]).map((q) => ({
    created_by: createdBy,
    subject: q.subject || "Physics",
    topic: q.topic ?? null,
    difficulty: q.difficulty ?? "medium",
    question_type: q.question_type || "scq",
    question_text: q.question_text,
    question_image_url: q.question_image_url ?? null,
    options: q.options ?? [],
    correct_answer: q.correct_answer,
    explanation: q.explanation ?? null,
    marks_correct: q.marks_correct ?? 4,
    marks_wrong: q.marks_wrong ?? -1,
    tags: [],
    is_public: true,
  }));

  const { error: insertErr } = await (supabase as any).from("question_bank").insert(bankRows);
  if (insertErr) throw new Error(`Could not archive questions: ${insertErr.message}`);
  return bankRows.length;
}

type AdminTest = {
  id: string;
  title: string;
  slug: string;
  test_type: string;
  exam_pattern: string;
  total_questions: number;
  duration_minutes: number;
  is_published: boolean;
  created_at: string;
};

const AdminTestsPage = () => {
  const { user } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();
  const [tests, setTests] = useState<AdminTest[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tests")
      .select("id, title, slug, test_type, exam_pattern, total_questions, duration_minutes, is_published, created_at")
      .order("created_at", { ascending: false });
    setTests((data ?? []) as AdminTest[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const togglePublish = async (t: AdminTest, publish: boolean) => {
    const { error } = await supabase.from("tests").update({ is_published: publish }).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success(publish ? "Test published" : "Test unpublished");
    load();
  };

  const deleteTest = async (t: AdminTest) => {
    const ok = await confirm({
      title: `Delete "${t.title}"?`,
      description:
        "The test and all student attempts will be permanently removed. Its questions will be copied to the Question Bank first, so they remain reusable.",
      confirmLabel: "Delete test",
    });
    if (!ok) return;

    try {
      const archived = await archiveTestQuestionsToBank(t.id, user?.id ?? null);
      const { error } = await supabase.from("tests").delete().eq("id", t.id);
      if (error) return toast.error(error.message);
      toast.success(
        archived > 0
          ? `Test deleted · ${archived} question${archived === 1 ? "" : "s"} moved to the Question Bank`
          : "Test deleted",
      );
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Delete failed: ${msg}`);
    }
  };

  const filtered = tests.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));
  const { paged, page, setPage, totalPages, total, pageSize } = usePagination(filtered, 15);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {ConfirmDialog}
      <div className="rounded-2xl bg-gradient-to-r from-primary via-accent to-secondary p-6 text-white flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black font-display">Tests Management</h1>
          <p className="text-white/90 text-sm mt-1">Create, edit and publish test papers</p>
        </div>
        <Link to="/admin/upload-questions" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-primary hover:bg-white/90">
          <Plus className="h-4 w-4" /> Upload Test
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tests..."
          className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
        />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No tests found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Test</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Questions</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Duration</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{t.title}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs capitalize">{t.test_type} · {t.exam_pattern}</td>
                    <td className="px-4 py-3 text-center text-xs text-foreground">{t.total_questions}</td>
                    <td className="px-4 py-3 text-center text-xs text-foreground">{t.duration_minutes} min</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          t.is_published ? "bg-secondary/20 text-secondary" : "bg-amber-500/20 text-amber-600"
                        }`}
                      >
                        {t.is_published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <a href={`/tests/${t.slug}/take`} target="_blank" rel="noreferrer" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors" title="Preview">
                          <Eye className="h-3.5 w-3.5" />
                        </a>
                        <Link to={`/admin/tests/${t.slug}/edit`} className="rounded-md p-1.5 text-foreground hover:bg-muted transition-colors" title="Edit test">
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        {!t.is_published ? (
                          <button onClick={() => togglePublish(t, true)} className="rounded-md p-1.5 text-secondary hover:bg-secondary/10">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button onClick={() => togglePublish(t, false)} className="rounded-md p-1.5 text-destructive hover:bg-destructive/10">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteTest(t)}
                          className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                          title="Delete test (questions are kept in the Question Bank)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTestsPage;
