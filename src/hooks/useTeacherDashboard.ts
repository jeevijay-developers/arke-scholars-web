import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export type UpcomingClass = {
  id: string;
  name: string;
  batch: string;
  students: number;
  starts_at: string;
  status: string;
  meeting_url: string | null;
  slug: string | null;
};

export type DoubtPreview = {
  id: string;
  student: string;
  subject: string;
  topic: string;
  question: string;
  created_at: string;
  urgent: boolean;
};

export type ScoreBucket = { range: string; students: number };

export type TeacherDashboardData = {
  loading: boolean;
  greetingName: string;
  newToday: number;
  stats: {
    totalStudents: number;
    newThisWeek: number;
    activeCourses: number;
    ongoingBatches: number;
    pendingDoubts: number;
    avgRating: number;
    totalReviews: number;
  };
  upcomingClasses: UpcomingClass[];
  pendingDoubts: DoubtPreview[];
  scoreDistribution: ScoreBucket[];
  lastTestTitle: string | null;
};

const initial: TeacherDashboardData = {
  loading: true,
  greetingName: "",
  newToday: 0,
  stats: {
    totalStudents: 0,
    newThisWeek: 0,
    activeCourses: 0,
    ongoingBatches: 0,
    pendingDoubts: 0,
    avgRating: 0,
    totalReviews: 0,
  },
  upcomingClasses: [],
  pendingDoubts: [],
  scoreDistribution: [],
  lastTestTitle: null,
};

export const useTeacherDashboard = (): TeacherDashboardData => {
  const { user } = useAuth();
  const [data, setData] = useState<TeacherDashboardData>(initial);

  useEffect(() => {
    if (!user) {
      setData({ ...initial, loading: false });
      return;
    }
    let cancelled = false;

    const load = async () => {
      const teacherId = user.id;
      const nowIso = new Date().toISOString();
      const weekAgoIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStartIso = todayStart.toISOString();

      // Parallel base queries
      const [profileRes, coursesRes, classesRes, lastTestRes, profileMine] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("user_id", teacherId).maybeSingle(),
        supabase
          .from("courses")
          .select("id, is_active, rating, total_enrolled, subject")
          .eq("created_by", teacherId),
        supabase
          .from("live_classes")
          .select("id, title, subject, target_exam, starts_at, status, meeting_url, slug")
          .eq("created_by", teacherId)
          .or(`starts_at.gte.${nowIso},status.eq.live`)
          .order("starts_at", { ascending: true })
          .limit(3),
        supabase
          .from("tests")
          .select("id, title, total_marks")
          .eq("created_by", teacherId)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase.from("profiles").select("full_name").eq("user_id", teacherId).maybeSingle(),
      ]);

      const courses = coursesRes.data ?? [];
      const courseIds = courses.map((c) => c.id);
      const subjects = Array.from(new Set(courses.map((c) => c.subject).filter(Boolean))) as string[];
      const activeCourses = courses.filter((c) => c.is_active).length;

      // Avg rating weighted by enrollments
      let totalReviews = 0;
      let weightedSum = 0;
      courses.forEach((c) => {
        const w = c.total_enrolled || 0;
        totalReviews += w;
        weightedSum += (c.rating || 0) * w;
      });
      const avgRating = totalReviews > 0 ? weightedSum / totalReviews : 0;

      // Enrollments + doubts + last-test attempts (depend on previous results)
      const enrollmentsP =
        courseIds.length > 0
          ? supabase
              .from("enrollments")
              .select("user_id, created_at")
              .in("course_id", courseIds)
          : Promise.resolve({ data: [] as { user_id: string; created_at: string }[] });

      const doubtsAssignedCountP = supabase
        .from("doubts")
        .select("id", { count: "exact", head: true })
        .eq("assigned_teacher_id", teacherId)
        .eq("status", "pending");

      const doubtsPreviewP =
        subjects.length > 0
          ? supabase
              .from("doubts")
              .select("id, user_id, subject, topic, question_text, created_at, status, assigned_teacher_id")
              .eq("status", "pending")
              .or(`assigned_teacher_id.eq.${teacherId},assigned_teacher_id.is.null`)
              .in("subject", subjects)
              .order("created_at", { ascending: false })
              .limit(3)
          : supabase
              .from("doubts")
              .select("id, user_id, subject, topic, question_text, created_at, status, assigned_teacher_id")
              .eq("status", "pending")
              .eq("assigned_teacher_id", teacherId)
              .order("created_at", { ascending: false })
              .limit(3);

      const lastTest = lastTestRes.data?.[0];
      const attemptsP = lastTest
        ? supabase
            .from("test_attempts")
            .select("score")
            .eq("test_id", lastTest.id)
            .in("status", ["submitted", "auto_submitted"])
        : Promise.resolve({ data: [] as { score: number }[] });

      const [enrollmentsRes, doubtsCountRes, doubtsPreviewRes, attemptsRes] = await Promise.all([
        enrollmentsP,
        doubtsAssignedCountP,
        doubtsPreviewP,
        attemptsP,
      ]);

      const enrollments = (enrollmentsRes.data ?? []) as { user_id: string; created_at: string }[];
      const uniqueStudents = new Set(enrollments.map((e) => e.user_id));
      const newThisWeek = enrollments.filter((e) => e.created_at >= weekAgoIso).length;
      const newToday = enrollments.filter((e) => e.created_at >= todayStartIso).length;

      // Hydrate doubt previews with student names
      const doubtRows = (doubtsPreviewRes.data ?? []) as Array<{
        id: string;
        user_id: string;
        subject: string;
        topic: string | null;
        question_text: string;
        created_at: string;
      }>;
      const studentIds = Array.from(new Set(doubtRows.map((d) => d.user_id)));
      const namesMap = new Map<string, string>();
      if (studentIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", studentIds);
        (profs ?? []).forEach((p: { user_id: string; full_name: string | null }) =>
          namesMap.set(p.user_id, p.full_name || "Student"),
        );
      }
      const sixHoursAgo = Date.now() - 6 * 3600 * 1000;
      const pendingDoubts: DoubtPreview[] = doubtRows.map((d) => ({
        id: d.id,
        student: namesMap.get(d.user_id) || "Student",
        subject: d.subject,
        topic: d.topic || "",
        question: d.question_text,
        created_at: d.created_at,
        urgent: new Date(d.created_at).getTime() < sixHoursAgo,
      }));

      // Score distribution: 5 buckets across total_marks
      let scoreDistribution: ScoreBucket[] = [];
      if (lastTest) {
        const max = Math.max(1, Number(lastTest.total_marks) || 100);
        const bucketSize = max / 5;
        const buckets = [0, 0, 0, 0, 0];
        (attemptsRes.data ?? []).forEach((a: { score: number }) => {
          const idx = Math.min(4, Math.max(0, Math.floor(Number(a.score) / bucketSize)));
          buckets[idx] += 1;
        });
        scoreDistribution = buckets.map((students, i) => ({
          range: `${Math.round(i * bucketSize)}-${Math.round((i + 1) * bucketSize)}`,
          students,
        }));
      }

      // Upcoming classes
      const classRows = (classesRes.data ?? []) as Array<{
        id: string;
        title: string;
        subject: string;
        target_exam: string | null;
        starts_at: string;
        status: string;
        meeting_url: string | null;
        slug: string | null;
      }>;
      // Per-class student counts (best effort: count attendance rows)
      const upcomingClasses: UpcomingClass[] = await Promise.all(
        classRows.map(async (c) => {
          const { count } = await supabase
            .from("live_class_attendance")
            .select("id", { count: "exact", head: true })
            .eq("class_id", c.id);
          return {
            id: c.id,
            name: c.title,
            batch: [c.subject, c.target_exam].filter(Boolean).join(" · ") || "All students",
            students: count ?? 0,
            starts_at: c.starts_at,
            status: c.status,
            meeting_url: c.meeting_url,
            slug: c.slug ?? null,
          };
        }),
      );

      const fullName =
        profileMine.data?.full_name || profileRes.data?.full_name || "Teacher";

      if (cancelled) return;
      setData({
        loading: false,
        greetingName: fullName,
        newToday,
        stats: {
          totalStudents: uniqueStudents.size,
          newThisWeek,
          activeCourses,
          ongoingBatches: activeCourses,
          pendingDoubts: doubtsCountRes.count ?? 0,
          avgRating: Number(avgRating.toFixed(1)),
          totalReviews,
        },
        upcomingClasses,
        pendingDoubts,
        scoreDistribution,
        lastTestTitle: lastTest?.title ?? null,
      });
    };

    load().catch(() => {
      if (!cancelled) setData((d) => ({ ...d, loading: false }));
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return data;
};
