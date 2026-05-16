import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export type EngagementPoint = { day: string; views: number; doubts: number };
export type RevenuePoint = { month: string; revenue: number };
export type CourseSlice = { name: string; value: number; color: string };
export type TopStudent = { name: string; initials: string; score: number };

export type TeacherAnalyticsData = {
  loading: boolean;
  totalStudents: number;
  totalRevenue: number;
  lectureViews: number;
  avgTestScore: number;
  engagement: EngagementPoint[];
  revenue: RevenuePoint[];
  courseDistribution: CourseSlice[];
  topStudents: TopStudent[];
};

const PALETTE = ["hsl(24,95%,53%)", "hsl(160,93%,39%)", "hsl(217,91%,60%)", "hsl(280,80%,60%)", "hsl(45,93%,47%)", "hsl(0,84%,60%)"];

const initials = (name: string) =>
  name.split(/\s+/).map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "ST";

export const useTeacherAnalytics = (): TeacherAnalyticsData => {
  const { user } = useAuth();
  const [data, setData] = useState<TeacherAnalyticsData>({
    loading: true,
    totalStudents: 0,
    totalRevenue: 0,
    lectureViews: 0,
    avgTestScore: 0,
    engagement: [],
    revenue: [],
    courseDistribution: [],
    topStudents: [],
  });

  useEffect(() => {
    if (!user) {
      setData((d) => ({ ...d, loading: false }));
      return;
    }
    let cancelled = false;

    (async () => {
      const teacherId = user.id;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      sixMonthsAgo.setHours(0, 0, 0, 0);

      const [coursesRes, testsRes] = await Promise.all([
        supabase
          .from("courses")
          .select("id, name, price, total_enrolled, subject")
          .eq("created_by", teacherId),
        supabase.from("tests").select("id, total_marks").eq("created_by", teacherId),
      ]);
      const courses = coursesRes.data ?? [];
      const courseIds = courses.map((c) => c.id);
      const tests = testsRes.data ?? [];
      const testMap = new Map(tests.map((t) => [t.id, Number(t.total_marks) || 0]));
      const testIds = tests.map((t) => t.id);
      const subjects = Array.from(new Set(courses.map((c) => c.subject).filter(Boolean))) as string[];

      const totalRevenue = courses.reduce(
        (s, c) => s + (Number(c.price) || 0) * (Number(c.total_enrolled) || 0),
        0,
      );

      const courseDistribution: CourseSlice[] = courses
        .filter((c) => (c.total_enrolled || 0) > 0)
        .map((c, i) => ({ name: c.name, value: Number(c.total_enrolled) || 0, color: PALETTE[i % PALETTE.length] }));

      // Enrollments + lesson_progress + test_attempts + doubts in parallel
      const enrollmentsP = courseIds.length
        ? supabase.from("enrollments").select("user_id, created_at, course_id").in("course_id", courseIds)
        : Promise.resolve({ data: [] as any[] });

      const lessonProgressP = courseIds.length
        ? supabase
            .from("lesson_progress")
            .select("last_watched_at")
            .in("course_id", courseIds)
            .gte("last_watched_at", sevenDaysAgo.toISOString())
        : Promise.resolve({ data: [] as any[] });

      const lessonProgressTotalP = courseIds.length
        ? supabase.from("lesson_progress").select("id", { count: "exact", head: true }).in("course_id", courseIds)
        : Promise.resolve({ count: 0 } as any);

      const attemptsP = testIds.length
        ? supabase
            .from("test_attempts")
            .select("user_id, score, test_id")
            .in("test_id", testIds)
            .in("status", ["submitted", "auto_submitted"])
        : Promise.resolve({ data: [] as any[] });

      const doubtsP = subjects.length
        ? supabase
            .from("doubts")
            .select("created_at")
            .in("subject", subjects)
            .gte("created_at", sevenDaysAgo.toISOString())
        : Promise.resolve({ data: [] as any[] });

      const [enrollRes, progRes, progCountRes, attemptsRes, doubtsRes] = await Promise.all([
        enrollmentsP, lessonProgressP, lessonProgressTotalP, attemptsP, doubtsP,
      ]);

      const enrollments = enrollRes.data ?? [];
      const totalStudents = new Set(enrollments.map((e: any) => e.user_id)).size;
      const lectureViews = (progCountRes as any).count ?? 0;

      // Avg test score
      const attempts = attemptsRes.data ?? [];
      let pctSum = 0;
      let pctCount = 0;
      const studentAgg = new Map<string, { sum: number; n: number }>();
      attempts.forEach((a: any) => {
        const max = testMap.get(a.test_id) || 0;
        if (max <= 0) return;
        const pct = (Number(a.score) / max) * 100;
        pctSum += pct;
        pctCount += 1;
        const cur = studentAgg.get(a.user_id) || { sum: 0, n: 0 };
        studentAgg.set(a.user_id, { sum: cur.sum + pct, n: cur.n + 1 });
      });
      const avgTestScore = pctCount > 0 ? Math.round(pctSum / pctCount) : 0;

      // Top students
      const topIds = Array.from(studentAgg.entries())
        .map(([uid, v]) => ({ uid, score: Math.round(v.sum / v.n) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
      let topStudents: TopStudent[] = [];
      if (topIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", topIds.map((t) => t.uid));
        const nameMap = new Map((profs ?? []).map((p: any) => [p.user_id, p.full_name || "Student"]));
        topStudents = topIds.map((t) => {
          const name = nameMap.get(t.uid) || "Student";
          return { name, initials: initials(name), score: t.score };
        });
      }

      // Engagement: last 7 days
      const dayKeys: { iso: string; label: string }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        dayKeys.push({ iso: d.toISOString().slice(0, 10), label: d.toLocaleDateString(undefined, { weekday: "short" }) });
      }
      const viewsByDay = new Map<string, number>();
      const doubtsByDay = new Map<string, number>();
      (progRes.data ?? []).forEach((p: any) => {
        const k = (p.last_watched_at || "").slice(0, 10);
        viewsByDay.set(k, (viewsByDay.get(k) || 0) + 1);
      });
      (doubtsRes.data ?? []).forEach((d: any) => {
        const k = (d.created_at || "").slice(0, 10);
        doubtsByDay.set(k, (doubtsByDay.get(k) || 0) + 1);
      });
      const engagement: EngagementPoint[] = dayKeys.map((d) => ({
        day: d.label,
        views: viewsByDay.get(d.iso) || 0,
        doubts: doubtsByDay.get(d.iso) || 0,
      }));

      // Revenue: last 6 months from enrollments
      const priceMap = new Map(courses.map((c) => [c.id, Number(c.price) || 0]));
      const monthKeys: { key: string; label: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthKeys.push({ key, label: d.toLocaleDateString(undefined, { month: "short" }) });
      }
      const revByMonth = new Map<string, number>();
      enrollments.forEach((e: any) => {
        const d = new Date(e.created_at);
        if (d < sixMonthsAgo) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        revByMonth.set(key, (revByMonth.get(key) || 0) + (priceMap.get(e.course_id) || 0));
      });
      const revenue: RevenuePoint[] = monthKeys.map((m) => ({ month: m.label, revenue: revByMonth.get(m.key) || 0 }));

      if (!cancelled) {
        setData({
          loading: false,
          totalStudents,
          totalRevenue,
          lectureViews,
          avgTestScore,
          engagement,
          revenue,
          courseDistribution,
          topStudents,
        });
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
