/**
 * End-to-end style tests for the full student test flow:
 *   start -> answer -> submit -> see results
 *
 * Runs both for tests linked to a course and standalone tests. Supabase and
 * the auth context are mocked so the tests run hermetically under jsdom.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import TestTakingPage from "@/pages/TestTakingPage";
import TestResultPage from "@/pages/TestResultPage";

// ---------- Mocks ----------
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const stableUser = { id: "user-1" };
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: stableUser,
    loading: false,
  }),
}));

type Row = Record<string, unknown>;

interface Scenario {
  testId: string;
  testRow: Row;
  questions: Row[];
  attempt: Row | null; // current in-progress attempt to return on load
}

let scenario: Scenario;
let lastAttemptUpdate: Row | null = null;
let submittedAttemptId: string | null = null;

const makeBuilder = (table: string) => {
  const state: { filters: Record<string, unknown>; updatePayload?: Row; insertPayload?: Row } = {
    filters: {},
  };
  const builder: any = {
    select: () => builder,
    order: () => builder,
    eq: (col: string, val: unknown) => {
      state.filters[col] = val;
      return builder;
    },
    insert: (payload: Row) => {
      state.insertPayload = payload;
      return builder;
    },
    update: (payload: Row) => {
      state.updatePayload = payload;
      return builder;
    },
    single: async () => resolve(),
    maybeSingle: async () => resolve(),
    then: (cb: (v: unknown) => unknown) => Promise.resolve(resolve()).then(cb),
  };

  function resolve() {
    if (table === "tests") {
      return { data: scenario.testRow, error: null };
    }
    if (table === "test_questions") {
      return { data: scenario.questions, error: null };
    }
    if (table === "test_attempts") {
      if (state.insertPayload) {
        const created = {
          id: "attempt-1",
          started_at: new Date().toISOString(),
          ...state.insertPayload,
        };
        scenario.attempt = { ...created, status: "in_progress", answers: {}, question_statuses: {} };
        return { data: created, error: null };
      }
      if (state.updatePayload) {
        lastAttemptUpdate = state.updatePayload;
        if (state.updatePayload.status === "submitted" || state.updatePayload.status === "auto_submitted") {
          submittedAttemptId = state.filters.id as string;
        }
        return { data: null, error: null };
      }
      // select
      if (state.filters.status === "in_progress") {
        return { data: scenario.attempt, error: null };
      }
      // result fetch by id
      return {
        data: {
          id: "attempt-1",
          test_name: scenario.testRow.title,
          score: 4,
          total_questions: scenario.questions.length,
          correct_answers: 1,
          percentile: 100,
          time_spent_seconds: 42,
          test_id: scenario.testId,
          answers: { [String(scenario.questions[0].id)]: { selected: 1 } },
        },
        error: null,
      };
    }
    return { data: null, error: null };
  }

  return builder;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
    rpc: vi.fn(async () => ({ data: { score: 4 }, error: null })),
  },
}));

const baseQuestions = (): Row[] => [
  {
    id: "q1",
    position: 1,
    subject: "Physics",
    topic: "Kinematics",
    question_text: "1 + 1 = ?",
    question_image_url: null,
    question_type: "single",
    options: [
      { id: 0, text: "1" },
      { id: 1, text: "2" },
      { id: 2, text: "3" },
      { id: 3, text: "4" },
    ],
    marks_correct: 4,
    marks_wrong: -1,
    correct_answer: 1,
  },
  {
    id: "q2",
    position: 2,
    subject: "Math",
    topic: "Algebra",
    question_text: "2 * 3 = ?",
    question_image_url: null,
    question_type: "single",
    options: [
      { id: 0, text: "5" },
      { id: 1, text: "6" },
      { id: 2, text: "7" },
      { id: 3, text: "8" },
    ],
    marks_correct: 4,
    marks_wrong: -1,
    correct_answer: 1,
  },
];

const renderFlow = () =>
  render(
    <MemoryRouter initialEntries={[`/tests/${scenario.testId}/take`]}>
      <Routes>
        <Route path="/tests/:slug/take" element={<TestTakingPage />} />
        <Route path="/tests/:slug/result/:attemptId" element={<TestResultPage />} />
        <Route path="/my-tests" element={<div>My Tests Page</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  );

const runFullFlow = async () => {
  renderFlow();

  // Instructions screen renders
  const startBtn = await screen.findByRole("button", { name: /start test/i }, { timeout: 4000 });
  await act(async () => {
    fireEvent.click(startBtn);
  });

  // Question 1 visible
  await screen.findByText("1 + 1 = ?", {}, { timeout: 4000 });

  // Answer Q1 with option B (correct)
  fireEvent.click(screen.getByRole("button", { name: /B\.\s*2/ }));
  // Save & next
  fireEvent.click(screen.getByRole("button", { name: /save & next/i }));

  // Question 2
  await screen.findByText("2 * 3 = ?", {}, { timeout: 4000 });
  fireEvent.click(screen.getByRole("button", { name: /A\.\s*5/ })); // wrong on purpose

  // Submit
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /^submit test$/i }));
  });

  // Result page rendered
  await waitFor(() => expect(screen.getByText(/score/i)).toBeInTheDocument(), { timeout: 4000 });
};

describe("Student test flow (start → answer → submit → results)", () => {
  beforeEach(() => {
    lastAttemptUpdate = null;
    submittedAttemptId = null;
  });

  it("works for a test linked to a course", async () => {
    scenario = {
      testId: "test-course",
      testRow: {
        id: "test-course",
        title: "Course-Linked Mock Test",
        duration_minutes: 30,
        total_questions: 2,
        course_id: "course-1",
      },
      questions: baseQuestions(),
      attempt: null,
    };

    await runFullFlow();

    expect(submittedAttemptId).toBe("attempt-1");
    expect(lastAttemptUpdate?.status).toMatch(/submitted/);
    // Result UI shows the test name + key metrics
    expect(screen.getByText(/Course-Linked Mock Test/i)).toBeInTheDocument();
    expect(screen.getByText(/accuracy/i)).toBeInTheDocument();
  });

  it("works for a standalone test (no course association)", async () => {
    scenario = {
      testId: "test-solo",
      testRow: {
        id: "test-solo",
        title: "Standalone Practice Test",
        duration_minutes: 15,
        total_questions: 2,
        course_id: null,
      },
      questions: baseQuestions(),
      attempt: null,
    };

    await runFullFlow();

    expect(submittedAttemptId).toBe("attempt-1");
    expect(lastAttemptUpdate?.status).toMatch(/submitted/);
    expect(screen.getByText(/Standalone Practice Test/i)).toBeInTheDocument();
    expect(screen.getByText(/accuracy/i)).toBeInTheDocument();
  });

  it("resumes an existing in-progress attempt and submits cleanly", async () => {
    scenario = {
      testId: "test-resume",
      testRow: {
        id: "test-resume",
        title: "Resumable Test",
        duration_minutes: 20,
        total_questions: 2,
        course_id: null,
      },
      questions: baseQuestions(),
      attempt: {
        id: "attempt-1",
        started_at: new Date().toISOString(),
        answers: { q1: { selected: 1 } },
        question_statuses: { q1: "answered" },
        status: "in_progress",
      },
    };

    renderFlow();

    // Skips instructions because in-progress attempt exists
    await screen.findByText("1 + 1 = ?");
    fireEvent.click(screen.getByRole("button", { name: /save & next/i }));
    await screen.findByText("2 * 3 = ?");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^submit test$/i }));
    });

    await waitFor(() => expect(submittedAttemptId).toBe("attempt-1"));
  });
});
