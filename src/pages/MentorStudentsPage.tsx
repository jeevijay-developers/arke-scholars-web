import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Users, ShieldCheck, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import ReportDialog from "@/components/ReportDialog";
import { Button } from "@/components/ui/button";

type Student = {
  user_id: string;
  full_name: string | null;
  target_exam: string | null;
  class_level: string | null;
  coveringFor?: string | null;
  coverageEndsAt?: string | null;
};

const MentorStudentsPage = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let ignore = false;
    (async () => {
      // Primary assignments
      const { data: primary } = await supabase
        .from("mentor_student_assignments")
        .select("student_id")
        .eq("mentor_id", user.id)
        .is("removed_at", null);
      const primaryIds = new Set((primary ?? []).map((a) => a.student_id));

      // Active handovers where I'm backup
      const nowIso = new Date().toISOString();
      const { data: handovers } = await supabase
        .from("mentor_handovers")
        .select("primary_mentor_id, ends_at, ended_early_at, started_at")
        .eq("backup_mentor_id", user.id)
        .lte("started_at", nowIso)
        .gte("ends_at", nowIso);

      const active = (handovers ?? []).filter(
        (h) => !h.ended_early_at || new Date(h.ended_early_at) > new Date(),
      );

      const coverageByStudent = new Map<string, { primaryId: string; endsAt: string }>();
      if (active.length) {
        const primaryIdsCov = active.map((h) => h.primary_mentor_id);
        const { data: covAssignments } = await supabase
          .from("mentor_student_assignments")
          .select("mentor_id, student_id")
          .in("mentor_id", primaryIdsCov)
          .is("removed_at", null);
        for (const row of covAssignments ?? []) {
          const h = active.find((x) => x.primary_mentor_id === row.mentor_id);
          if (h && !primaryIds.has(row.student_id)) {
            coverageByStudent.set(row.student_id, { primaryId: row.mentor_id, endsAt: h.ends_at });
          }
        }
      }

      const allIds = Array.from(new Set([...primaryIds, ...coverageByStudent.keys()]));
      const primaryMentorIds = Array.from(new Set(active.map((h) => h.primary_mentor_id)));
      const allProfileIds = Array.from(new Set([...allIds, ...primaryMentorIds]));

      const { data: profiles } = allProfileIds.length
        ? await supabase
            .from("profiles")
            .select("user_id, full_name, target_exam, class_level")
            .in("user_id", allProfileIds)
        : { data: [] as any[] };

      const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      const list: Student[] = allIds.map((id) => {
        const p = profileMap.get(id);
        const cov = coverageByStudent.get(id);
        const primaryName = cov ? profileMap.get(cov.primaryId)?.full_name ?? "primary mentor" : null;
        return {
          user_id: id,
          full_name: p?.full_name ?? null,
          target_exam: p?.target_exam ?? null,
          class_level: p?.class_level ?? null,
          coveringFor: primaryName,
          coverageEndsAt: cov?.endsAt ?? null,
        };
      });

      if (!ignore) {
        setStudents(list);
        setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [user]);

  const coveringCount = students.filter((s) => s.coveringFor).length;

  return (
    <div className="space-y-4 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black text-foreground">My Students</h1>
          <p className="text-sm text-muted-foreground">
            Students assigned to you by the admin team.
            {coveringCount > 0 && (
              <span className="ml-1 text-secondary">
                Plus {coveringCount} covered during active handover.
              </span>
            )}
          </p>
        </div>
        <Link
          to="/mentor/chats"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Users className="h-4 w-4" />
          Open Group Chat
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : students.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No students assigned yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((s) => {
            const initials = (s.full_name ?? "S")
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase())
              .join("");
            return (
              <div
                key={s.user_id}
                className={`rounded-xl border bg-card p-4 ${
                  s.coveringFor ? "border-secondary/40 ring-1 ring-secondary/20" : "border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary/15 text-sm font-bold text-secondary">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{s.full_name || "Student"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[s.target_exam, s.class_level].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                </div>
                {s.coveringFor && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-secondary/10 px-2.5 py-2 text-[11px] text-secondary">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Covering for <span className="font-semibold">{s.coveringFor}</span>
                      {s.coverageEndsAt && (
                        <> until {new Date(s.coverageEndsAt).toLocaleDateString()}</>
                      )}
                    </span>
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <Link
                    to="/mentor/chats"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Message
                  </Link>
                  <ReportDialog
                    reportedName={s.full_name || "Student"}
                    reportedRole="student"
                    reportedUserId={s.user_id}
                    trigger={
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                        <Flag className="h-3.5 w-3.5" />
                      </Button>
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MentorStudentsPage;
