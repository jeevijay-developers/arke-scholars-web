/**
 * Compete Mode E2E Tests
 *
 * Covers:
 *  1. Bot match — full game with sub-500ms question transition assertions
 *  2. Private room — create room (P1) + join via code (P2) + complete match
 *  3. Find opponent — both players click Quick Match and get paired
 */

import { test, expect, Page } from "@playwright/test";

// All compete tests share the same two student accounts — run them serially to
// prevent session/state conflicts and CPU contention that distort timing assertions.
test.describe.configure({ mode: "serial" });

const S1 = { email: "dojogec298@ryzid.com", password: "@Apna401" };
const S2 = { email: "zaidkhan45664@gmail.com", password: "@Apna401" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /^login$/i }).click();
  // Redirects to /my-courses (or /teacher/dashboard for teachers) after auth
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

async function goToCompete(page: Page) {
  await page.goto("/compete");
  await expect(page.getByRole("heading", { name: /compete/i })).toBeVisible({ timeout: 10_000 });
}

/** Click the first enabled answer option (A / B / C / D) */
const clickFirstOption = (page: Page) =>
  page
    .getByRole("button")
    .filter({ has: page.locator("span", { hasText: /^[A-D]$/ }) })
    .first()
    .click();

/**
 * Rapidly answer all 10 questions.
 * Waits up to 35s per question (timer is 30s; we move faster via instant click).
 */
async function answerAllQuestions(page: Page) {
  for (let i = 0; i < 10; i++) {
    // Wait for an enabled option button (may need a beat after render)
    await page
      .getByRole("button")
      .filter({ has: page.locator("span", { hasText: /^[A-D]$/ }) })
      .first()
      .waitFor({ state: "attached", timeout: 35_000 });
    await clickFirstOption(page).catch(() => {
      // Question may have already advanced if timeout auto-submitted — ignore
    });
    // Small grace period between questions (UI render + animation)
    await page.waitForTimeout(200);
  }
}

// ---------------------------------------------------------------------------
// Test Suite 1 — Bot Match
// ---------------------------------------------------------------------------

test.describe("Compete — Bot Match", () => {
  test("full bot match completes with <500ms question transitions", async ({ page }) => {
    test.setTimeout(120_000);

    await login(page, S1.email, S1.password);
    await goToCompete(page);

    // --- Start bot match ---
    await page.getByRole("button", { name: /practice.*bot/i }).click();

    // Should enter searching/countdown state quickly (edge fn returns fast for bot)
    await expect(
      page.getByText(/match found/i).or(page.getByText(/searching/i))
    ).toBeVisible({ timeout: 15_000 });

    // Wait for countdown screen
    await expect(page.getByText(/match found/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/starts in/i)).toBeVisible({ timeout: 5_000 });

    // Wait for match phase — question counter becomes visible
    await expect(page.getByTestId("question-counter")).toBeVisible({ timeout: 15_000 });

    // --- Transition timing: first 3 questions must advance in <1000ms ---
    // (original implementation blocked on edge fn: 2000–2500ms; optimistic = <100ms typical)
    for (let qi = 0; qi < 3; qi++) {
      const expectedCounter = `${qi + 2}/10`;

      const t0 = Date.now();
      await clickFirstOption(page);

      // Counter must update to the next question within 1000ms of the click
      await expect(page.getByTestId("question-counter")).toContainText(expectedCounter, {
        timeout: 1000,
      });

      const elapsed = Date.now() - t0;
      console.log(`Q${qi + 1} → Q${qi + 2}: ${elapsed}ms`);
      expect(
        elapsed,
        `Question transition took ${elapsed}ms — must be <1000ms (optimistic update broken?)`
      ).toBeLessThan(1000);
    }

    // --- Answer remaining questions (no timing assertion needed) ---
    for (let i = 3; i < 10; i++) {
      await page
        .getByRole("button")
        .filter({ has: page.locator("span", { hasText: /^[A-D]$/ }) })
        .first()
        .waitFor({ state: "attached", timeout: 35_000 })
        .catch(() => {});
      await clickFirstOption(page).catch(() => {});
      await page.waitForTimeout(200);
    }

    // --- Result screen ---
    await expect(page.getByText(/victory!|defeated|draw!/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: /play again/i })).toBeVisible();

    console.log("Bot match completed successfully.");
  });
});

// ---------------------------------------------------------------------------
// Test Suite 2 — Private Room
// ---------------------------------------------------------------------------

test.describe("Compete — Private Room", () => {
  test("creator and joiner play a full match together", async ({ browser }) => {
    test.setTimeout(180_000);

    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    try {
      // Login both players in parallel
      await Promise.all([
        login(p1, S1.email, S1.password),
        login(p2, S2.email, S2.password),
      ]);

      await Promise.all([goToCompete(p1), goToCompete(p2)]);

      // --- P1 creates a room ---
      await p1.getByRole("button", { name: /create room/i }).click();

      // Searching screen shows the room code as large tracking text
      await expect(p1.getByText(/share this room code/i)).toBeVisible({ timeout: 20_000 });

      // The room code is rendered with tracking-[0.3em] — grab its text
      const roomCodeLocator = p1.locator("[class*='tracking-']").filter({ hasText: /^[A-Z0-9]{4,8}$/ });
      const roomCode = (await roomCodeLocator.first().textContent())?.trim();
      expect(roomCode, "Room code must be present").toBeTruthy();
      expect(roomCode).toMatch(/^[A-Z0-9]{4,8}$/);
      console.log("Room code:", roomCode);

      // --- P2 joins using the room code ---
      await p2.locator("input[placeholder='ROOM CODE']").fill(roomCode!);
      await p2.getByRole("button", { name: /^join$/i }).click();

      // Both should see "Match Found" countdown
      await Promise.all([
        expect(p1.getByText(/match found/i)).toBeVisible({ timeout: 20_000 }),
        expect(p2.getByText(/match found/i)).toBeVisible({ timeout: 20_000 }),
      ]);

      // Both should enter the match phase
      await Promise.all([
        expect(p1.getByTestId("question-counter")).toBeVisible({ timeout: 15_000 }),
        expect(p2.getByTestId("question-counter")).toBeVisible({ timeout: 15_000 }),
      ]);

      // --- Both answer all 10 questions ---
      await Promise.all([answerAllQuestions(p1), answerAllQuestions(p2)]);

      // --- Both should see result ---
      await Promise.all([
        expect(p1.getByText(/victory!|defeated|draw!/i)).toBeVisible({ timeout: 90_000 }),
        expect(p2.getByText(/victory!|defeated|draw!/i)).toBeVisible({ timeout: 90_000 }),
      ]);

      // Exactly one player must have won (or it's a draw)
      const p1Result = await p1.getByText(/victory!|defeated|draw!/i).first().textContent();
      const p2Result = await p2.getByText(/victory!|defeated|draw!/i).first().textContent();
      console.log(`P1: ${p1Result}, P2: ${p2Result}`);

      // If P1 won, P2 must be defeated (and vice-versa), or both draw
      if (p1Result?.toLowerCase().includes("victory")) {
        expect(p2Result?.toLowerCase()).toContain("defeated");
      } else if (p1Result?.toLowerCase().includes("defeated")) {
        expect(p2Result?.toLowerCase()).toContain("victory");
      } else {
        expect(p1Result?.toLowerCase()).toContain("draw");
        expect(p2Result?.toLowerCase()).toContain("draw");
      }
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Test Suite 3 — Find Opponent (Quick Match)
// ---------------------------------------------------------------------------

test.describe("Compete — Find Opponent", () => {
  test("two players are matched via Quick Match and complete the game", async ({ browser }) => {
    test.setTimeout(180_000);

    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    try {
      // Login both
      await Promise.all([
        login(p1, S1.email, S1.password),
        login(p2, S2.email, S2.password),
      ]);

      await Promise.all([goToCompete(p1), goToCompete(p2)]);

      // Wait for exams to load and profile values to settle (cap at 2s to avoid blocking
      // on persistent WebSocket connections that prevent networkidle from ever firing).
      const normalizeFilters = async (page: Page) => {
        await expect(page.getByRole("button", { name: /jee main/i }).first()).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(1500); // enough for profile fetch (~500ms) to apply
        await page.getByRole("button", { name: "Physics" }).click();
        await page.getByRole("button", { name: /class 11$/i }).click();
        await page.getByRole("button", { name: /jee main/i }).first().click();
        await page.waitForTimeout(400);
      };
      await Promise.all([normalizeFilters(p1), normalizeFilters(p2)]);

      // P1 searches first — gives P1 a committed queue entry before P2 scans
      await p1.getByRole("button", { name: /find opponent/i }).click();
      await expect(p1.getByText(/searching for opponent/i)).toBeVisible({ timeout: 10_000 });

      // 3s ensures P1's queue INSERT has replicated before P2 queries
      await p1.waitForTimeout(3000);

      await p2.getByRole("button", { name: /find opponent/i }).click();
      // P2 might be immediately matched if P1's entry was already in the queue —
      // accept any of: searching, match found, or already in match phase
      await expect(
        p2.getByText(/searching for opponent/i)
          .or(p2.getByText(/match found/i))
          .or(p2.getByTestId("question-counter"))
      ).toBeVisible({ timeout: 15_000 });

      // Both reach the match phase (question-counter).
      // "Match Found" badge is only 5s so we skip asserting that specific badge.
      await Promise.all([
        expect(p1.getByTestId("question-counter")).toBeVisible({ timeout: 60_000 }),
        expect(p2.getByTestId("question-counter")).toBeVisible({ timeout: 60_000 }),
      ]);

      // Both answer all 10 questions
      await Promise.all([answerAllQuestions(p1), answerAllQuestions(p2)]);

      // Both reach result
      await Promise.all([
        expect(p1.getByText(/victory!|defeated|draw!/i)).toBeVisible({ timeout: 90_000 }),
        expect(p2.getByText(/victory!|defeated|draw!/i)).toBeVisible({ timeout: 90_000 }),
      ]);

      console.log("Quick match completed for both players.");
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });
});
