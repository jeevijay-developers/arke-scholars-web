import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { calcLessonProgress } from "@/lib/progress";

export interface DashboardData {
  loading: boolean;
  streak: number;
  accuracyPct: number | null;
  testsCompleted: number;
  percentile: number | null;
  continueWatching: Array<{
    course_id: string;
    lesson_title: string | null;
    lesson_slug: string;
    progress_pct: number;
    course_name?: string;
    educator_name?: string;
    subject?: string;
  }>;
  todaySchedule: Array<{
    id: string;
    slug: string;
    title: string;
    subject: string;
    educator_name: string;
    starts_at: string;
    status: string;
    meeting_url: string | null;
    user_status: string | null;
  }>;
  educators: Array<{
    name: string;
    subject: string | null;
    follows: number;
  }>;
  scoreTrend: Array<{ name: string; you: number; avg: number }>;
  subjectPerformance: Array<{ subject: string; pct: number }>;
  weakTopics: Array<{ topic: string; pct: number }>;
}

const initial: DashboardData = {
  loading: true,
  streak: 0,
  accuracyPct: null,
  testsCompleted: 0,
  percentile: null,
  continueWatching: [],
  todaySchedule: [],
  educators: [],
  scoreTrend: [],
  subjectPerformance: [],
  weakTopics: [],
};

export const useDashboardData = (): DashboardData => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>(initial);

  useEffect(() => {
    if (!user) {
      setData({ ...initial, loading: false });
      return;
    }
    let active = true;

    (async () => {
      const todayISO = new Date();
      todayISO.setHours(0, 0, 0, 0);
      const tomorrowISO = new Date(todayISO);
      tomorrowISO.setDate(tomorrowISO.getDate() + 1);

      const [streakRes, sessionsRes, testsRes, lessonsRes, scheduleRes, followsRes] = await Promise.all([
        supabase.rpc("get_user_streak", { _user_id: user.id }),
        supabase
          .from("study_sessions")
          .select("questions_attempted, questions_correct")
          .eq("user_id", user.id),
        supabase
          .from("test_attempts")
          .select("id, test_name, subject, score, total_questions, correct_answers, percentile, attempted_at")
          .eq("user_id", user.id)
          .order("attempted_at", { ascending: false }),
        supabase
          .from("lesson_progress")
          .select("course_id, lesson_title, lesson_slug, watched_seconds, total_seconds, last_watched_at")
          .eq("user_id", user.id)
          .order("last_watched_at", { ascending: false })
          .limit(2),
        supabase
          .from("live_classes")
          .select("id, slug, title, subject, educator_name, starts_at, status, meeting_url")
          .gte("starts_at", todayISO.toISOString())
          .lt("starts_at", tomorrowISO.toISOString())
          .order("starts_at", { ascending: true }),
        supabase
          .from("educator_follows")
          .select("educator_name, educator_subject")
          .eq("user_id", user.id),
      ]);

      if (!active) return;

      // Streak
      const streak = (streakRes.data as number) ?? 0;

      // Accuracy from study sessions
      const sessions = sessionsRes.data ?? [];
      const totalAttempted = sessions.reduce((s, r) => s + (r.questions_attempted ?? 0), 0);
      const totalCorrect = sessions.reduce((s, r) => s + (r.questions_correct ?? 0), 0);
      const accuracyPct = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : null;

      // Tests
      const tests = testsRes.data ?? [];
      const testsCompleted = tests.length;
      const percentile = tests.length > 0
        ? Math.round(
            (tests.slice(0, 5).reduce((s, t) => s + (Number(t.percentile) || 0), 0) /
              Math.min(5, tests.length)) * 10
          ) / 10
        : null;

      // Continue watching
      const lessons = lessonsRes.data ?? [];
      const courseIds = Array.from(new Set(lessons.map((l) => l.course_id)));
      let coursesMap: Record<string, { name: string; educator_name: string; subject: string }> = {};
      if (courseIds.length > 0) {
        const { data: courses } = await supabase
          .from("courses")
          .select("id, name, educator_name, subject")
          .in("id", courseIds);
        (courses ?? []).forEach((c) => {
          coursesMap[c.id] = { name: c.name, educator_name: c.educator_name, subject: c.subject };
        });
      }
      const continueWatching = lessons.map((l) => ({
        course_id: l.course_id,
        lesson_title: l.lesson_title,
        lesson_slug: l.lesson_slug,
        progress_pct: calcLessonProgress(l.watched_seconds, l.total_seconds),
        course_name: coursesMap[l.course_id]?.name,
        educator_name: coursesMap[l.course_id]?.educator_name,
        subject: coursesMap[l.course_id]?.subject,
      }));

      // Today's schedule + user status per class
      const schedule = scheduleRes.data ?? [];
      const classIds = schedule.map((c) => c.id);
      let userStatusMap: Record<string, string> = {};
      if (classIds.length > 0) {
        const { data: att } = await supabase
          .from("live_class_attendance")
          .select("class_id, status")
          .eq("user_id", user.id)
          .in("class_id", classIds);
        (att ?? []).forEach((a) => {
          userStatusMap[a.class_id] = a.status;
        });
      }
      const todaySchedule = schedule.map((c) => ({
        ...c,
        user_status: userStatusMap[c.id] ?? null,
      }));

      // Educators (followed)
      const educators = (followsRes.data ?? []).map((f) => ({
        name: f.educator_name,
        subject: f.educator_subject,
        follows: 1,
      }));

      // Score trend (group test_attempts into last 6 weeks buckets)
      const trendBuckets: Record<string, { sum: number; count: number }> = {};
      const weeksBack = 6;
      const now = new Date();
      for (let i = weeksBack - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        const key = `${d.toLocaleString("en", { month: "short" })} ${d.getDate()}`;
        trendBuckets[key] = { sum: 0, count: 0 };
      }
      const orderedKeys = Object.keys(trendBuckets);
      tests.forEach((t) => {
        const at = new Date(t.attempted_at);
        const diffWeeks = Math.floor((now.getTime() - at.getTime()) / (7 * 24 * 60 * 60 * 1000));
        if (diffWeeks >= 0 && diffWeeks < weeksBack) {
          const key = orderedKeys[weeksBack - 1 - diffWeeks];
          if (key) {
            const pct = t.total_questions > 0 ? (t.correct_answers / t.total_questions) * 100 : 0;
            trendBuckets[key].sum += pct;
            trendBuckets[key].count += 1;
          }
        }
      });
      const scoreTrend = orderedKeys.map((k) => ({
        name: k,
        you: trendBuckets[k].count > 0 ? Math.round(trendBuckets[k].sum / trendBuckets[k].count) : 0,
        avg: 70,
      }));

      // Subject performance
      const subj: Record<string, { c: number; t: number }> = {};
      tests.forEach((t) => {
        if (!t.subject) return;
        if (!subj[t.subject]) subj[t.subject] = { c: 0, t: 0 };
        subj[t.subject].c += t.correct_answers || 0;
        subj[t.subject].t += t.total_questions || 0;
      });
      const subjectPerformance = Object.entries(subj).map(([subject, v]) => ({
        subject,
        pct: v.t > 0 ? Math.round((v.c / v.t) * 100) : 0,
      }));

      const weakTopics = subjectPerformance
        .filter((s) => s.pct < 70)
        .sort((a, b) => a.pct - b.pct)
        .slice(0, 3)
        .map((s) => ({ topic: s.subject, pct: s.pct }));

      setData({
        loading: false,
        streak,
        accuracyPct,
        testsCompleted,
        percentile,
        continueWatching,
        todaySchedule,
        educators,
        scoreTrend,
        subjectPerformance,
        weakTopics,
      });
    })();

    return () => {
      active = false;
    };
  }, [user]);

  return data;
};
