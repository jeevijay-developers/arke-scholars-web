import { useEffect, useState } from "react";
import { BookOpen, Plus, Users, Eye, Edit, Loader2, Lock, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/TablePagination";
import { useConfirm } from "@/components/ConfirmDialog";

type TeacherCourse = {
  id: string;
  name: string;
  slug: string;
  subject: string;
  is_published: boolean;
  total_lessons: number;
  total_enrolled: number;
  rating: number;
};

const TeacherCoursesPage = () => {
  const { user } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("courses")
      .select("id, name, slug, subject, is_published, total_lessons, total_enrolled, rating")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });
    setCourses((data ?? []) as TeacherCourse[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const togglePublish = async (c: TeacherCourse) => {
    if (c.is_published) {
      const ok = await confirm({
        title: `Unpublish "${c.name}"?`,
        description: "Students will no longer see this course in the catalog or be able to enroll. Existing enrolled students keep their access. You can republish at any time.",
        confirmLabel: "Unpublish course",
      });
      if (!ok) return;
    }
    const { error } = await supabase.from("courses").update({ is_published: !c.is_published }).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success(c.is_published ? "Course unpublished" : "Course published");
    load();
  };

  const { page, setPage, totalPages, paged, total, pageSize } = usePagination(courses, 8);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {ConfirmDialog}
      <div className="rounded-2xl bg-gradient-to-r from-primary via-accent to-secondary p-6 text-white flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black font-display">My Courses</h1>
          <p className="text-white/90 text-sm mt-1">Manage your courses, lectures, and enrollments</p>
        </div>
        <Link
          to="/teacher/courses/create"
          className="flex items-center gap-1.5 rounded-lg bg-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/30 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Course
        </Link>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="font-display text-lg font-bold text-foreground">No courses yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Click New Course to publish your first batch.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="space-y-4 p-4">
            {paged.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shrink-0">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-foreground">{c.name}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          c.is_published ? "bg-secondary/20 text-secondary" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {c.is_published ? "Published" : "Draft"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {(c.total_enrolled ?? 0).toLocaleString()} students
                      </span>
                      <span>{c.total_lessons} lectures</span>
                      <span>{c.subject}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      to={`/courses/${c.slug}`}
                      className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted transition-colors"
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => togglePublish(c)}
                      className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted transition-colors"
                      title={c.is_published ? "Unpublish" : "Publish"}
                    >
                      {c.is_published ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                    </button>
                  </div>
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
    </div>
  );
};

export default TeacherCoursesPage;
