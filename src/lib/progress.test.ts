import { describe, it, expect } from "vitest";
import {
  calcPercent,
  calcLessonProgress,
  calcCourseProgress,
  clampCompletedCount,
  isLessonComplete,
} from "./progress";

describe("calcPercent", () => {
  it("returns 0 when denominator is 0", () => {
    expect(calcPercent(10, 0)).toBe(0);
  });

  it("returns 0 when denominator is negative", () => {
    expect(calcPercent(10, -5)).toBe(0);
  });

  it("returns 0 for null/undefined/NaN inputs", () => {
    expect(calcPercent(null, 10)).toBe(0);
    expect(calcPercent(undefined, 10)).toBe(0);
    expect(calcPercent(NaN, 10)).toBe(0);
    expect(calcPercent(5, null)).toBe(0);
    expect(calcPercent(5, undefined)).toBe(0);
    expect(calcPercent(5, NaN)).toBe(0);
  });

  it("returns 0 for Infinity inputs", () => {
    expect(calcPercent(Infinity, 10)).toBe(0);
    expect(calcPercent(10, Infinity)).toBe(0);
  });

  it("computes a normal percentage", () => {
    expect(calcPercent(3, 4)).toBe(75);
    expect(calcPercent(1, 2)).toBe(50);
  });

  it("clamps results above 100% to 100", () => {
    expect(calcPercent(150, 100)).toBe(100);
    expect(calcPercent(2, 1)).toBe(100);
  });

  it("clamps negative numerators to 0", () => {
    expect(calcPercent(-10, 100)).toBe(0);
  });

  it("coerces numeric strings", () => {
    expect(calcPercent("3", "4")).toBe(75);
  });

  it("never produces a value outside [0, 100] for random inputs", () => {
    for (let i = 0; i < 200; i++) {
      const n = (Math.random() - 0.3) * 1000;
      const d = (Math.random() - 0.3) * 1000;
      const pct = calcPercent(n, d);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
      expect(Number.isInteger(pct)).toBe(true);
    }
  });
});

describe("calcLessonProgress", () => {
  it("returns 100 when watched exceeds total (data drift)", () => {
    expect(calcLessonProgress(1200, 1000)).toBe(100);
  });

  it("returns 0 when total_seconds is 0 or missing", () => {
    expect(calcLessonProgress(500, 0)).toBe(0);
    expect(calcLessonProgress(500, null)).toBe(0);
  });

  it("returns 0 for an unwatched lesson", () => {
    expect(calcLessonProgress(0, 600)).toBe(0);
  });

  it("computes a normal progress percent", () => {
    expect(calcLessonProgress(300, 600)).toBe(50);
    expect(calcLessonProgress(540, 600)).toBe(90);
  });
});

describe("clampCompletedCount", () => {
  it("never exceeds the total lessons", () => {
    expect(clampCompletedCount(10, 4)).toBe(4);
  });

  it("never goes below 0", () => {
    expect(clampCompletedCount(-3, 4)).toBe(0);
  });

  it("treats invalid inputs as 0", () => {
    expect(clampCompletedCount(null, 4)).toBe(0);
    expect(clampCompletedCount(NaN, 4)).toBe(0);
    expect(clampCompletedCount(2, null)).toBe(0);
  });

  it("floors fractional inputs", () => {
    expect(clampCompletedCount(2.9, 5)).toBe(2);
  });
});

describe("calcCourseProgress", () => {
  it("returns 0 when total lessons is 0", () => {
    expect(calcCourseProgress(3, 0)).toBe(0);
    expect(calcCourseProgress(0, 0)).toBe(0);
  });

  it("returns 100 when completed >= total", () => {
    expect(calcCourseProgress(4, 4)).toBe(100);
    expect(calcCourseProgress(10, 4)).toBe(100); // drift safety
  });

  it("computes 75% for 3/4 lessons", () => {
    expect(calcCourseProgress(3, 4)).toBe(75);
  });

  it("returns 0 when no lessons completed", () => {
    expect(calcCourseProgress(0, 4)).toBe(0);
  });

  it("never returns a value outside [0, 100] for any data state", () => {
    const cases: Array<[unknown, unknown]> = [
      [null, null],
      [undefined, undefined],
      [NaN, 4],
      [3, NaN],
      [-5, 10],
      [5, -10],
      [Infinity, 10],
      [10, Infinity],
      ["3", "4"],
      [99, 1],
    ];
    for (const [c, t] of cases) {
      const pct = calcCourseProgress(c, t);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
  });
});

describe("isLessonComplete", () => {
  it("marks complete at the default 90% threshold", () => {
    expect(isLessonComplete(540, 600)).toBe(true);
    expect(isLessonComplete(530, 600)).toBe(false);
  });

  it("respects a custom threshold", () => {
    expect(isLessonComplete(300, 600, 50)).toBe(true);
    expect(isLessonComplete(290, 600, 50)).toBe(false);
  });

  it("is false when total is missing/zero", () => {
    expect(isLessonComplete(500, 0)).toBe(false);
    expect(isLessonComplete(500, null)).toBe(false);
  });

  it("is true when watched exceeds total (drift)", () => {
    expect(isLessonComplete(1200, 1000)).toBe(true);
  });
});
