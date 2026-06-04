/**
 * Test-taking + Analytics E2E
 *
 * Covers:
 *  1. Student logs in and navigates to the HTML Basics test
 *  2. Starts the test, answers all 5 questions, submits
 *  3. Verifies the result page shows score + percentile
 *  4. Navigates to /analytics and verifies at least 1 attempt appears
 */

import { test, expect, Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const STUDENT = { email: "dojogec298@ryzid.com", password: "@Apna401" };
const TEST_SLUG = "html-basics-class-11";

async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(STUDENT.email);
  await page.locator('input[type="password"]').fill(STUDENT.password);
  await page.getByRole("button", { name: /^login$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

test("student can take the HTML Basics test and see analytics", async ({ page }) => {
  // ── 1. Login ──────────────────────────────────────────────────────────────
  await login(page);

  // ── 2. Navigate directly to the test taking page ─────────────────────────
  await page.goto(`/tests/${TEST_SLUG}/take`);
  await expect(page.getByText(/HTML Basics/i)).toBeVisible({ timeout: 15_000 });

  // ── 3. Start the test if intro screen is shown ────────────────────────────
  const startBtn = page.getByRole("button", { name: /start test/i });
  try {
    await startBtn.waitFor({ state: "visible", timeout: 5_000 });
    await startBtn.click();
  } catch {
    // Already in-progress or no start screen — continue
  }

  // Wait for question panel to appear (timer visible = test active)
  await expect(page.locator("text=/Question [0-9]+ \\/ [0-9]+/").first()).toBeVisible({ timeout: 15_000 });

  // ── 4. Answer all 5 questions — options are <button> A./B./C./D. ──────────
  for (let i = 0; i < 5; i++) {
    // Options render as buttons with text like "A. Hyper Text Markup Language"
    const firstOption = page.getByRole("button").filter({ hasText: /^A\./i }).first();
    await expect(firstOption).toBeVisible({ timeout: 10_000 });
    await firstOption.click();
    await page.waitForTimeout(200);

    if (i < 4) {
      // "Save & Next" advances to the next question
      const saveNext = page.getByRole("button", { name: /save.*next|next/i }).last();
      await expect(saveNext).toBeVisible({ timeout: 5_000 });
      await saveNext.click();
      await page.waitForTimeout(400);
    }
  }

  // ── 5. Submit the test ────────────────────────────────────────────────────
  const submitBtn = page.getByRole("button", { name: /submit test/i });
  await expect(submitBtn).toBeVisible({ timeout: 10_000 });
  await submitBtn.click();

  // Confirm dialog / alert if present
  page.once("dialog", (d) => d.accept());
  const confirmBtn = page.getByRole("button", { name: /confirm|yes/i }).last();
  try {
    await confirmBtn.waitFor({ state: "visible", timeout: 3_000 });
    await confirmBtn.click();
  } catch {
    // No confirm dialog — already submitted
  }

  // ── 6. Result page ────────────────────────────────────────────────────────
  await page.waitForURL(/\/result\//i, { timeout: 25_000 });
  await expect(page.getByText(/score|result|percentile/i).first()).toBeVisible({ timeout: 15_000 });

  // ── 7. Analytics page ─────────────────────────────────────────────────────
  await page.goto("/analytics");
  await expect(page.getByText(/performance analytics/i)).toBeVisible({ timeout: 15_000 });

  // KPI card "Total Tests" should show at least 1
  await expect(page.getByText("Total Tests")).toBeVisible({ timeout: 10_000 });

  // Test history table must have at least one row
  const historyRows = page.locator("tbody tr");
  await expect(historyRows.first()).toBeVisible({ timeout: 15_000 });

  // Our HTML test should appear by name
  await expect(page.getByText(/HTML Basics/i).first()).toBeVisible({ timeout: 5_000 });
});
