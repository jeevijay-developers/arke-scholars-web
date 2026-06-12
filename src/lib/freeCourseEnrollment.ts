import { supabase } from "@/integrations/supabase/client";

/**
 * Auto-assigns matching free courses to a student.
 *
 * Free courses are granted automatically (no manual enrollment / payment) to
 * every student whose profile target_exam + class_level match the course's
 * target + class. Matching courses the student isn't already enrolled in get an
 * enrollment row, after which they show up in "My Learning" like any other
 * enrolled course.
 *
 * Idempotent: skips courses the student is already enrolled in. Safe to call on
 * every login / My Learning load. Server-side RLS still gates the insert to
 * free + active courses, so this can never grant access to a paid course.
 *
 * @returns the number of new enrollments created.
 */
export async function syncFreeCourseEnrollments(userId: string): Promise<number> {
  // 1. Resolve the student's target + class. Skip entirely if onboarding is
  //    incomplete (we don't guess a goal for them).
  const { data: profile } = await supabase
    .from("profiles")
    .select("target_exam, class_level")
    .eq("user_id", userId)
    .maybeSingle();

  const target = profile?.target_exam?.trim();
  const classLevel = profile?.class_level?.trim();
  if (!target || !classLevel) return 0;

  // 2. Find active free courses that match the student's goal.
  const { data: freeCourses } = await supabase
    .from("courses")
    .select("id")
    .eq("is_course_free", true)
    .eq("is_active", true)
    .eq("target", target)
    .eq("class", classLevel);

  const matchingIds = (freeCourses ?? []).map((c) => c.id);
  if (matchingIds.length === 0) return 0;

  // 3. Drop the ones they're already enrolled in (active or not — never
  //    re-create or revive a removed enrollment).
  const { data: existing } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("user_id", userId)
    .in("course_id", matchingIds);

  const enrolledIds = new Set((existing ?? []).map((e) => e.course_id));
  const toEnroll = matchingIds.filter((id) => !enrolledIds.has(id));
  if (toEnroll.length === 0) return 0;

  // 4. Insert enrollments for the remaining matches.
  const rows = toEnroll.map((courseId) => ({
    user_id: userId,
    course_id: courseId,
    is_active: true,
  }));

  const { error } = await supabase.from("enrollments").insert(rows);
  if (error) {
    // Most likely a race (parallel tab already enrolled) or RLS rejection.
    // Non-fatal — the student simply won't see the course this load.
    console.warn("[freeCourseEnrollment] insert failed:", error.message);
    return 0;
  }

  return toEnroll.length;
}
