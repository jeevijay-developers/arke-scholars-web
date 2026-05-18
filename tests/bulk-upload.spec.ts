import { test, expect } from "@playwright/test";
import path from "node:path";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const DOCX_PATH = process.env.TEST_DOCX_PATH ?? "C:\\Users\\ADMIN\\Downloads\\Chemistry_MoleConcept_PracticeTest01.docx";

test.describe("Bulk question upload — parse-docx → preview", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Set ADMIN_EMAIL and ADMIN_PASSWORD env vars");

  test("uploads docx and renders 20 questions with images, MCQ, unicode", async ({ page }) => {
    test.setTimeout(120_000);

    // 1. Sign in
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/admin\/(dashboard|upload-questions)/, { timeout: 30_000 });

    // 2. Navigate to upload page
    await page.goto("/admin/upload-questions");
    await expect(page.getByRole("heading", { name: "Upload Test", level: 1 })).toBeVisible();

    // 3. Fill the form
    const paperName = `Playwright Test ${Date.now()}`;
    await page.getByPlaceholder(/JEE Main/i).fill(paperName);
    await page.selectOption("select", "Chemistry");

    // 4. Upload the docx
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /Click to select a \.docx file|Click to change/ }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.resolve(DOCX_PATH));

    // 5. Submit & wait for parse
    await page.getByRole("button", { name: /Upload & Parse/ }).click();
    await expect(page.getByRole("heading", { name: "Review Parsed Questions" })).toBeVisible({ timeout: 90_000 });

    // 6. Top-line counts
    await expect(page.getByText(/20 questions parsed/i)).toBeVisible();

    // 7. Expand Q6 (MCQ) and assert
    const q6Card = page.locator("button", { hasText: /Which of the following statements are CORRECT for 1 mole of CO/ });
    await expect(q6Card).toBeVisible();
    await q6Card.click();
    // Card root is the grand-parent of the header button
    const q6Card_root = q6Card.locator("xpath=ancestor::div[contains(@class, 'rounded-xl')][1]");
    // Expanded body lives under .border-t inside the card
    const q6Body = q6Card_root.locator(".border-t").first();
    await expect(q6Body).toBeVisible();
    // The green "Answer" badge inside expanded body
    await expect(q6Body.locator("span.bg-green-50", { hasText: /\(1\), \(2\), \(3\)/ })).toBeVisible();
    // Unicode preserved in options
    await expect(q6Body.getByText(/6\.022 × 10²³ molecules/)).toBeVisible();
    // Solution preserved with subscripts and unicode
    await expect(q6Body.getByText(/Molar mass of CO₂ = 12 \+ 2\(16\) = 44 g\/mol/)).toBeVisible();

    // 8. Expand Q5 (SCQ with bar chart image) and assert image rendered
    const q5Card = page.locator("button", { hasText: /bar chart below shows the molar masses/ });
    await q5Card.click();
    const q5Card_root = q5Card.locator("xpath=ancestor::div[contains(@class, 'rounded-xl')][1]");
    const q5Body = q5Card_root.locator(".border-t").first();
    await expect(q5Body).toBeVisible();
    const stemImg = q5Body.locator("img").first();
    await expect(stemImg).toBeVisible();
    const src = await stemImg.getAttribute("src");
    expect(src).toMatch(/supabase\.co\/storage\/.*question-images/);

    // 9. Expand Q16 (match column) and assert match answer + column data
    const q16Card = page.locator("button", { hasText: /Match each compound in Column A/ });
    await q16Card.click();
    const q16Card_root = q16Card.locator("xpath=ancestor::div[contains(@class, 'rounded-xl')][1]");
    const q16Body = q16Card_root.locator(".border-t").first();
    await expect(q16Body).toBeVisible();
    // Column A entries
    await expect(q16Body.getByText(/\(A\) NaCl/)).toBeVisible();
    await expect(q16Body.getByText(/\(B\) H₂O/)).toBeVisible();
    // Column B entries
    await expect(q16Body.getByText(/\(P\) 18 g\/mol/)).toBeVisible();
    await expect(q16Body.getByText(/\(S\) 58\.5 g\/mol/)).toBeVisible();

    // 10. Take a screenshot of the preview
    await page.screenshot({ path: "test-results/preview-full.png", fullPage: true });
  });

  test("publishes test from review page and lands on /admin/tests with the new row", async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/admin\/(dashboard|upload-questions)/, { timeout: 30_000 });

    await page.goto("/admin/upload-questions");
    const paperName = `PW Publish ${Date.now()}`;
    await page.getByPlaceholder(/JEE Main/i).fill(paperName);
    await page.selectOption("select", "Chemistry");

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /Click to select a \.docx file|Click to change/ }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.resolve(DOCX_PATH));

    await page.getByRole("button", { name: /Upload & Parse/ }).click();
    await expect(page.getByRole("heading", { name: "Review Parsed Questions" })).toBeVisible({ timeout: 90_000 });

    // Confirm & Import → straight to review page (no DB write here anymore)
    await page.getByRole("button", { name: /Confirm & Import/ }).click();
    await page.waitForURL(/\/admin\/review-questions\//, { timeout: 30_000 });

    // Publish as Test (header button)
    const publishBtn = page.getByRole("button", { name: /Publish as Test \(20\)/ }).first();
    await expect(publishBtn).toBeVisible();
    await publishBtn.click();

    // Redirects to /admin/tests
    await page.waitForURL(/\/admin\/tests(\b|$)/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /Tests Management/ })).toBeVisible();

    // Search for the new test (top of the list, but search is fastest + most specific)
    await page.getByPlaceholder(/Search tests/).fill(paperName);
    await expect(page.getByRole("cell", { name: paperName })).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: "test-results/tests-after-publish.png", fullPage: true });
  });

  test("deletes a test from /admin/tests and archives its questions to the bank", async ({ page, request }) => {
    test.setTimeout(180_000);

    // Login
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/admin\/(dashboard|upload-questions)/, { timeout: 30_000 });

    // First upload + publish so we have a known-titled test to delete
    const paperName = `PW Delete ${Date.now()}`;
    await page.goto("/admin/upload-questions");
    await page.getByPlaceholder(/JEE Main/i).fill(paperName);
    await page.selectOption("select", "Chemistry");
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /Click to select a \.docx file|Click to change/ }).click();
    (await fileChooserPromise).setFiles(path.resolve(DOCX_PATH));
    await page.getByRole("button", { name: /Upload & Parse/ }).click();
    await expect(page.getByRole("heading", { name: "Review Parsed Questions" })).toBeVisible({ timeout: 90_000 });
    await page.getByRole("button", { name: /Confirm & Import/ }).click();
    await page.waitForURL(/\/admin\/review-questions\//, { timeout: 30_000 });
    await page.getByRole("button", { name: /Publish as Test \(20\)/ }).first().click();
    await page.waitForURL(/\/admin\/tests(\b|$)/, { timeout: 30_000 });

    // Find the row and click the trash icon
    await page.getByPlaceholder(/Search tests/).fill(paperName);
    const row = page.getByRole("row", { name: new RegExp(paperName) });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByTitle(/Delete test/).click();

    // Confirm dialog
    await page.getByRole("button", { name: /Delete test/ }).last().click();

    // Toast mentions archive
    await expect(page.getByText(/moved to the Question Bank/i)).toBeVisible({ timeout: 10_000 });

    // Row gone
    await expect(row).toHaveCount(0);

    await page.screenshot({ path: "test-results/tests-after-delete.png", fullPage: true });
  });
});
