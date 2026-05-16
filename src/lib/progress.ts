/**
 * Pure helpers for progress calculations.
 * All functions clamp results to [0, 100] and handle invalid inputs safely.
 */

const toFiniteNumber = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Calculate a percentage from a numerator and denominator.
 * - Returns 0 when denominator is <= 0 or values are invalid (NaN/Infinity/null/undefined).
 * - Clamps the result to [0, 100].
 * - Negative inputs are treated as 0.
 */
export const calcPercent = (
  numerator: unknown,
  denominator: unknown,
): number => {
  const num = Math.max(0, toFiniteNumber(numerator));
  const den = Math.max(0, toFiniteNumber(denominator));
  if (den <= 0) return 0;
  const pct = Math.round((num / den) * 100);
  return Math.min(100, Math.max(0, pct));
};

/**
 * Calculate watched-progress percent for a single lesson.
 */
export const calcLessonProgress = (
  watchedSeconds: unknown,
  totalSeconds: unknown,
): number => calcPercent(watchedSeconds, totalSeconds);

/**
 * Clamp a "completed lessons" count to [0, totalLessons].
 * Invalid or negative values become 0; values above total become total.
 */
export const clampCompletedCount = (
  completed: unknown,
  total: unknown,
): number => {
  const totalSafe = Math.max(0, Math.floor(toFiniteNumber(total)));
  const completedSafe = Math.max(0, Math.floor(toFiniteNumber(completed)));
  return Math.min(totalSafe, completedSafe);
};

/**
 * Calculate course progress percent from completed lessons / total lessons.
 * Always returns an integer in [0, 100].
 */
export const calcCourseProgress = (
  completedLessons: unknown,
  totalLessons: unknown,
): number => {
  const totalSafe = Math.max(0, Math.floor(toFiniteNumber(totalLessons)));
  if (totalSafe <= 0) return 0;
  const completedSafe = clampCompletedCount(completedLessons, totalSafe);
  return calcPercent(completedSafe, totalSafe);
};

/**
 * Decide whether a lesson should be auto-marked as complete based on a
 * configurable threshold (default 90%).
 */
export const isLessonComplete = (
  watchedSeconds: unknown,
  totalSeconds: unknown,
  thresholdPct = 90,
): boolean => {
  const threshold = Math.min(100, Math.max(0, toFiniteNumber(thresholdPct)));
  return calcLessonProgress(watchedSeconds, totalSeconds) >= threshold;
};
