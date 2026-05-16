import { Search, Clock, Users, Flag } from "lucide-react";
import { useMemo, useState } from "react";
import { useTeacherStudents } from "@/hooks/useTeacherStudents";
import { Skeleton } from "@/components/ui/skeleton";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/TablePagination";
import ReportDialog from "@/components/ReportDialog";
import { Button } from "@/components/ui/button";

const formatRelative = (iso: string | null) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const TeacherStudentsPage = () => {
  const { loading, students, totals } = useTeacherStudents();
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      students.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.batch.toLowerCase().includes(search.toLowerCase()),
      ),
    [students, search],
  );
  const { page, setPage, totalPages, paged, total, pageSize } = usePagination(filtered, 10);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-primary via-accent to-secondary p-6 text-white">
        <h1 className="text-2xl font-black font-display">My Students</h1>
        <p className="text-white/90 text-sm mt-1">Track performance and engagement across your batches</p>
        <div className="flex gap-4 mt-4">
          <div className="rounded-xl bg-white/20 px-4 py-2 text-center">
            <p className="text-lg font-bold">{loading ? "…" : totals.count}</p>
            <p className="text-[10px] text-white/80">Total</p>
          </div>
          <div className="rounded-xl bg-white/20 px-4 py-2 text-center">
            <p className="text-lg font-bold">{loading ? "…" : `${totals.avgProgress}%`}</p>
            <p className="text-[10px] text-white/80">Avg Progress</p>
          </div>
          <div className="rounded-xl bg-white/20 px-4 py-2 text-center">
            <p className="text-lg font-bold">{loading ? "…" : totals.avgScore || "—"}</p>
            <p className="text-[10px] text-white/80">Avg Score</p>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students or batch..."
          className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
        />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">No students enrolled yet</p>
            <p className="text-xs text-muted-foreground mt-1">Students will appear here as they enroll in your courses.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Course</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Progress</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Avg Score</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Tests</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Last Active</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((s) => (
                  <tr key={s.user_id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {s.initials}
                        </div>
                        <span className="font-medium text-foreground">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{s.batch}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${s.progress}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-foreground">{s.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.testsCompleted > 0 ? (
                        <span
                          className={`text-xs font-bold ${
                            s.avgScore >= 80 ? "text-secondary" : s.avgScore >= 60 ? "text-amber-500" : "text-destructive"
                          }`}
                        >
                          {s.avgScore}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-foreground">{s.testsCompleted}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatRelative(s.lastActiveIso)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ReportDialog
                        reportedName={s.name}
                        reportedRole="student"
                        reportedUserId={s.user_id}
                        trigger={
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Flag className="h-3.5 w-3.5" />
                          </Button>
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    </div>
  );
};

export default TeacherStudentsPage;
