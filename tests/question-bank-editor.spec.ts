import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

test.describe("Question Bank editor — universal schema", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Set ADMIN_EMAIL and ADMIN_PASSWORD env vars");

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    // Don't match /admin/login — wait for the real post-login destination
    await page.waitForURL(/\/admin\/(dashboard|upload-questions|tests|question-bank)/, { timeout: 30_000 });
  });

  test("sidebar shows \"Upload Test\" and tests page \"Upload Test\" CTA links to upload-questions", async ({ page }) => {
    await page.goto("/admin/tests");
    // Both sidebar nav link AND header CTA should exist with "Upload Test"
    const links = page.locator('a[href="/admin/upload-questions"]');
    await expect(links).toHaveCount(2); // sidebar + header CTA
    // Both link texts must contain "Upload Test"
    await expect(links.first()).toContainText("Upload Test");
    await expect(links.last()).toContainText("Upload Test");

    // Click the header CTA (last in DOM order) and confirm we land on the renamed page
    await links.last().click();
    await page.waitForURL(/\/admin\/upload-questions/);
    await expect(page.getByRole("heading", { name: "Upload Test", level: 1 })).toBeVisible();
  });

  test("question bank has NO Bulk upload button, New Question dialog shows 5 question types", async ({ page }) => {
    await page.goto("/admin/question-bank");
    // The page has two "Question Bank" texts (page heading + panel header). Use h1 specifically.
    await expect(page.getByRole("heading", { name: "Question Bank", level: 1 })).toBeVisible();

    // Bulk upload button must be gone
    await expect(page.getByRole("button", { name: /Bulk upload/i })).toHaveCount(0);

    // Open New
    await page.getByRole("button", { name: /^New$/ }).click();
    await expect(page.getByRole("heading", { name: "New Question" })).toBeVisible();

    // All 5 type buttons are present
    for (const label of ["SCQ", "MCQ", "Integer", "Match Column", "Assertion–Reason"]) {
      await expect(page.getByRole("button", { name: label })).toBeVisible();
    }

    // Image upload button appears in the stem field (and once per option)
    const imageButtons = page.getByRole("button", { name: /Image/, exact: false }).filter({ hasNot: page.locator("svg.lucide-image-plus + svg") });
    // At least 5 image buttons (1 stem + 4 options) when SCQ is selected
    const imgBtns = await page.locator('button:has-text("Image")').count();
    expect(imgBtns).toBeGreaterThanOrEqual(5);

    // Switch to Integer — the option list disappears, replaced with a numeric input
    await page.getByRole("button", { name: "Integer" }).click();
    await expect(page.getByText("Correct answer (number)")).toBeVisible();

    // Switch to Match Column — A–D and P–S inputs visible
    await page.getByRole("button", { name: "Match Column" }).click();
    await expect(page.getByText("Column I (A–D)")).toBeVisible();
    await expect(page.getByText("Column II (P–S)")).toBeVisible();
    await expect(page.getByPlaceholder(/A-P, B-Q, C-R, D-S/)).toBeVisible();

    // Switch back to SCQ to create a real question
    await page.getByRole("button", { name: "SCQ" }).click();

    // Solution textarea is present (renamed from Explanation)
    await expect(page.getByText("Solution (optional)")).toBeVisible();

    // Close without saving
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "New Question" })).toHaveCount(0);
  });

  test("creates an SCQ via the New dialog and it appears in the bank", async ({ page }) => {
    test.setTimeout(60_000);
    const stemMarker = `pw-bank-${Date.now()}`;
    const stemText = `Universal-schema SCQ test ${stemMarker}: what is $2 + 2$?`;

    await page.goto("/admin/question-bank");
    await page.getByRole("button", { name: /^New$/ }).click();
    await expect(page.getByRole("heading", { name: "New Question" })).toBeVisible();

    // Fill stem (HtmlField textarea is the first one in the dialog)
    const stemTextarea = page.locator("dialog, [role=dialog], .fixed").locator("textarea").first();
    // Above selector is fragile; use placeholder fallback
    const stemField = page.getByPlaceholder(/Question text\. You can include HTML/);
    await stemField.fill(stemText);

    // Fill 4 options
    const optionFields = page.getByPlaceholder(/Option \d — /);
    await optionFields.nth(0).fill("3");
    await optionFields.nth(1).fill("4");
    await optionFields.nth(2).fill("5");
    await optionFields.nth(3).fill("22");

    // Mark option 2 (number 4) correct: click the "2" indicator button next to it
    // The dialog has 5 numbered toggles (one per option). The first one is index 0 (#1), etc.
    const toggles = page.locator('button[title="Mark as correct"], button[title="Correct"]');
    await toggles.nth(1).click();

    // Save
    await page.getByRole("button", { name: /^Save$/ }).click();

    // Toast
    await expect(page.getByText("Question added")).toBeVisible({ timeout: 10_000 });

    // Search for the new question
    await page.getByPlaceholder(/Search questions/).fill(stemMarker);
    await expect(page.getByText(new RegExp(stemMarker))).toBeVisible({ timeout: 10_000 });
  });
});
