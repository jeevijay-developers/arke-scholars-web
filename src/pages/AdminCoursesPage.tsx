import { useEffect, useState } from "react";
import { Search, Check, X, Eye, Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useConfirm } from "@/components/ConfirmDialog";
import { useAuth } from "@/context/AuthContext";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/TablePagination";

type AdminCourse = {
  id: string;
  name: string;
  internal_name: string;
  slug: string;
  target: string;
  class: string;
  is_active: boolean;
  priority: number;
  created_at: string;
};

const AdminCoursesPage = () => {
  const { confirm, ConfirmDialog } = useConfirm();
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("courses")
      .select("id, name, internal_name, slug, target, class, is_active, priority, created_at")
      .order("priority", { ascending: true });
    setCourses((data ?? []) as AdminCourse[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (c: AdminCourse, active: boolean) => {
    if (!active) {
      const ok = await confirm({
        title: `Deactivate "${c.name}"?`,
        description: "Students will no longer see this course in the catalog. Existing enrolled students keep their access. You can reactivate at any time.",
        confirmLabel: "Deactivate course",
      });
      if (!ok) return;
    }
    const { error } = await supabase.from("courses").update({ is_active: active }).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success(active ? "Course activated" : "Course deactivated");
    load();
  };

  const deleteCourse = async (c: AdminCourse) => {
    const ok = await confirm({
      title: `Delete "${c.name}" permanently?`,
      description: "This will permanently remove the course, its folders, content items and resources. Existing enrollments may also be affected. This cannot be undone.",
      confirmLabel: "Delete course",
    });
    if (!ok) return;
    const { error } = await supabase.from("courses").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Course deleted");
    load();
  };

  const filtered = courses.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.internal_name?.toLowerCase().includes(search.toLowerCase()),
  );
  const { paged, page, setPage, totalPages, total, pageSize } = usePagination(filtered, 15);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {ConfirmDialog}
      <div className="rounded-2xl bg-[#0F1729] p-6 text-white flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black font-display">Courses Management</h1>
          <p className="text-white/90 text-sm mt-1">Review, activate, and manage all platform courses</p>
        </div>
        <Link
          to="/admin/courses/new"
          className="inline-flex items-center gap-2 rounded-lg bg-white text-[#0F1729] px-4 py-2 text-sm font-bold shadow-sm hover:bg-white/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Course
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by course name or internal name..."
          className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
        />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-muted-foreground">No courses found.</p>
            <Link
              to="/admin/courses/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Create your first course
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Internal Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Target</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Class</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Priority</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/admin/courses/${c.id}/content`)}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{c.internal_name || c.name}</p>
                      <p className="text-[11px] text-muted-foreground">{c.name}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{c.target}</td>
                    <td className="px-4 py-3 text-center text-xs text-foreground">{c.class}</td>
                    <td className="px-4 py-3 text-center text-xs text-foreground">{c.priority}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${c.is_active ? "bg-secondary/20 text-secondary" : "bg-amber-500/20 text-amber-600"}`}>
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <a
                          href={`/courses/${c.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                          title="Preview"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </a>
                        <button
                          onClick={() => navigate(`/admin/courses/${c.id}/edit`)}
                          className="rounded-md p-1.5 text-primary hover:bg-primary/10 transition-colors"
                          title="Edit course"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {!c.is_active ? (
                          <button
                            onClick={() => toggleActive(c, true)}
                            className="rounded-md p-1.5 text-secondary hover:bg-secondary/10 transition-colors"
                            title="Activate"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleActive(c, false)}
                            className="rounded-md p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
                            title="Deactivate"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button
                            onClick={() => deleteCourse(c)}
                            className="rounded-md p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
                            title="Delete course"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
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

export default AdminCoursesPage;
