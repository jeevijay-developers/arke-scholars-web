import { useEffect, useState } from "react";
import { Video, Calendar, Loader2, Trash2, Play, Radio } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/TablePagination";
import { useConfirm } from "@/components/ConfirmDialog";

type LiveClass = {
  id: string;
  slug: string;
  title: string;
  subject: string;
  educator_name: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  description: string | null;
  course_id: string | null;
  courses: { name: string } | null;
};

const TeacherLiveClassesPage = () => {
  const { user } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("live_classes")
      .select("id, slug, title, subject, educator_name, status, starts_at, ends_at, description, course_id, courses(name)")
      .eq("created_by", user.id)
      .order("starts_at", { ascending: false });
    setClasses((data ?? []) as unknown as LiveClass[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const markComplete = async (id: string) => {
    await supabase.from("live_classes").update({ status: "completed" }).eq("id", id);
    toast.success("Marked completed");
    load();
  };

  const remove = async (id: string, title?: string) => {
    const ok = await confirm({
      title: title ? `Delete "${title}"?` : "Delete this live class?",
      description: "The class will be permanently removed and registered students will lose access. This action cannot be undone.",
      confirmLabel: "Delete class",
    });
    if (!ok) return;
    const { error } = await supabase.from("live_classes").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Class removed");
    load();
  };

  const filtered = classes.filter((c) =>
    tab === "upcoming" ? c.status !== "completed" : c.status === "completed",
  );
  const { page, setPage, totalPages, paged, total, pageSize } = usePagination(filtered, 8);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-primary via-accent to-secondary p-6 text-white">
        <h1 className="text-2xl font-black font-display">Live Classes</h1>
        <p className="text-white/90 text-sm mt-1">Your scheduled live sessions — managed by the admin team</p>
      </div>

      <div className="flex gap-2">
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors capitalize ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Video className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-foreground">No {tab} classes. Contact admin to schedule one.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="space-y-3 p-3">
            {paged.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-card p-4 flex items-start gap-4 flex-wrap">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                  <Video className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-foreground">{c.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {c.courses?.name ? `${c.courses.name} · ` : ""}{c.subject} · <Calendar className="inline h-3 w-3" /> {new Date(c.starts_at).toLocaleString()}
                  </p>
                  {c.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {c.status === "live" ? (
                    <Link to={`/teacher/live-classes/${c.slug}`} className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground hover:opacity-90">
                      <Radio className="h-3.5 w-3.5 animate-pulse" /> Resume
                    </Link>
                  ) : c.status !== "completed" ? (
                    <Link to={`/teacher/live-classes/${c.slug}`} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90">
                      <Play className="h-3.5 w-3.5" /> Go Live
                    </Link>
                  ) : (
                    <Link to={`/teacher/live-classes/${c.slug}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50">
                      Open
                    </Link>
                  )}
                  {c.status !== "completed" && (
                    <button onClick={() => markComplete(c.id)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      Mark complete
                    </button>
                  )}
                  <button onClick={() => remove(c.id, c.title)} className="rounded-lg border border-destructive/40 p-1.5 text-destructive hover:bg-destructive/5">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      )}
      {ConfirmDialog}
    </div>
  );
};

export default TeacherLiveClassesPage;
