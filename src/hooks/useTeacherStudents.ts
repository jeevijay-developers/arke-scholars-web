import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export type TeacherStudent = {
  user_id: string;
  name: string;
  initials: string;
  batch: string;
  progress: number;
  testsCompleted: number;
  avgScore: number;
  lastActiveIso: string | null;
};

export type TeacherStudentsData = {
  loading: boolean;
  students: TeacherStudent[];
  totals: { count: number; avgProgress: number; avgScore: number };
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "ST";

export const useTeacherStudents = (): TeacherStudentsData => {
  const { user } = useAuth();
  const [data, setData] = useState<TeacherStudentsData>({
    loading: true,
    students: [],
    totals: { count: 0, avgProgress: 0, avgScore: 0 },
  });

  useEffect(() => {
    if (!user) {
      setData({ loading: false, students: [], totals: { count: 0, avgProgress: 0, avgScore: 0 } });
      return;
    }
    let cancelled = false;

    (async () => {
      const teacherId = user.id;
      const [coursesRes, testsRes] = await Promise.all([
        supabase.from("courses").select("id, name").eq("created_by", teacherId),
        supabase.from("tests").select("id, total_marks").eq("created_by", teacherId),
      ]);
      const courses = coursesRes.data ?? [];
      const courseMap = new Map(courses.map((c) => [c.id, c.name]));
      const courseIds = courses.map((c) => c.id);
      const tests = testsRes.data ?? [];
      const testMap = new Map(tests.map((t) => [t.id, Number(t.total_marks) || 0]));
      const testIds = tests.map((t) => t.id);

      if (courseIds.length === 0) {
        if (!cancelled) setData({ loading: false, students: [], totals: { count: 0, avgProgress: 0, avgScore: 0 } });
        return;
      }

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("user_id, course_id, progress_percent, last_accessed_at")
        .in("course_id", courseIds);
      const enrollRows = enrollments ?? [];
      const studentIds = Array.from(new Set(enrollRows.map((e) => e.user_id)));
      if (studentIds.length === 0) {
        if (!cancelled) setData({ loading: false, students: [], totals: { count: 0, avgProgress: 0, avgScore: 0 } });
        return;
      }

      const [profilesRes, attemptsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name").in("user_id", studentIds),
        testIds.length > 0
          ? supabase
              .from("test_attempts")
              .select("user_id, score, test_id, status")
              .in("user_id", studentIds)
              .in("test_id", testIds)
              .in("status", ["submitted", "auto_submitted"])
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const nameMap = new Map<string, string>();
      (profilesRes.data ?? []).forEach((p: any) => nameMap.set(p.user_id, p.full_name || "Student"));

      // Aggregate attempts per student
      const attemptAgg = new Map<string, { count: number; pctSum: number }>();
      (attemptsRes.data ?? []).forEach((a: any) => {
        const max = testMap.get(a.test_id) || 0;
        const pct = max > 0 ? (Number(a.score) / max) * 100 : 0;
        const cur = attemptAgg.get(a.user_id) || { count: 0, pctSum: 0 };
        attemptAgg.set(a.user_id, { count: cur.count + 1, pctSum: cur.pctSum + pct });
      });

      // For each enrollment row pick best (latest progress per user, sum across courses → avg)
      const studentRowMap = new Map<string, TeacherStudent>();
      enrollRows.forEach((e) => {
        const existing = studentRowMap.get(e.user_id);
        const att = attemptAgg.get(e.user_id);
        const avgScore = att && att.count > 0 ? Math.round(att.pctSum / att.count) : 0;
        const name = nameMap.get(e.user_id) || "Student";
        const batch = courseMap.get(e.course_id) || "Course";
        const progress = Number(e.progress_percent) || 0;
        if (!existing) {
          studentRowMap.set(e.user_id, {
            user_id: e.user_id,
            name,
            initials: initials(name),
            batch,
            progress,
            testsCompleted: att?.count ?? 0,
            avgScore,
            lastActiveIso: e.last_accessed_at,
          });
        } else {
          // multiple courses → keep highest progress; latest activity
          existing.progress = Math.max(existing.progress, progress);
          if (e.last_accessed_at && (!existing.lastActiveIso || e.last_accessed_at > existing.lastActiveIso)) {
            existing.lastActiveIso = e.last_accessed_at;
          }
          if (!existing.batch.includes(batch)) existing.batch = `${existing.batch}, ${batch}`;
        }
      });

      const students = Array.from(studentRowMap.values());
      const count = students.length;
      const avgProgress = count > 0 ? Math.round(students.reduce((s, x) => s + x.progress, 0) / count) : 0;
      const scoreList = students.filter((s) => s.testsCompleted > 0).map((s) => s.avgScore);
      const avgScore = scoreList.length > 0 ? Math.round(scoreList.reduce((s, x) => s + x, 0) / scoreList.length) : 0;

      if (!cancelled) {
        setData({ loading: false, students, totals: { count, avgProgress, avgScore } });
      }
    })().catch(() => {
      if (!cancelled) setData((d) => ({ ...d, loading: false }));
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return data;
};
