# Arke Scholars

Next-gen learning platform for Indian competitive exams (JEE, NEET, CUET) and Dubai curriculum (CBSE/IB/IGCSE). Built with React, Vite, TypeScript, Supabase, and Tailwind CSS.

## Development

```bash
npm install
npm run dev
```

## Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (Auth, Database, Edge Functions, Storage)
- **Payments**: Razorpay (India), Stripe (Dubai — coming soon)
- **Email**: Resend
- **AI**: Google Gemini 2.5 Flash

## Bulk Question Upload

Admins can upload a `.docx` exam paper and have questions parsed, previewed, and saved to the database without any manual data entry.

### Flow

1. **Admin → `/admin/upload-questions`**
   - Enter paper code (e.g. `FST-8`), subject, and optional exam date.
   - Select a `.docx` file containing the exam questions.
   - On submit the frontend inserts a `papers` row, then POSTs the file to the `parse-docx` edge function.

2. **Edge Function `parse-docx`** (Deno, `supabase/functions/parse-docx/`)
   - Unzips the `.docx` with **fflate** and extracts all images from `word/media/`.
   - Uploads each image to Supabase Storage bucket `question-images` under `{paper_id}/{uuid}.ext`.
   - Converts the document to HTML with **mammoth.js**, replacing image references with Storage public URLs.
   - Checks the raw `word/document.xml` for `<m:oMath>` (Word equation editor) and flags affected questions.
   - Splits the HTML on bold-numbered paragraphs (`<strong>N.</strong>`) to isolate question blocks.
   - Returns a JSON array of parsed (unconfirmed) question objects — nothing is written to the DB by the function.

3. **Admin → `/admin/review-questions/:paperId`**
   - Every parsed question is shown as an editable card.
   - Cards with OMML-detected equations show a yellow warning banner prompting manual LaTeX entry.
   - The stem has a live **KaTeX preview** that renders `$…$` / `$$…$$` and `<img>` tags inline.
   - Admin edits fields, changes the question type if needed, marks correct answers, then clicks **Approve & Save** — which inserts the row into `questions` with `needs_review = false`.
   - **Save All Pending** bulk-inserts every remaining card at once.

### Question Type Detection

| Type | Detection rule |
|---|---|
| `match_column` | HTML block contains a `<table>` |
| `assertion_reasoning` | Block text contains both "Assertion" and "Reason" |
| `scq` | Block has `(1)(2)(3)(4)` option paragraphs (default; admin can change to `mcq`) |
| `integer` | No option block found, not a table, not assertion-reasoning |

### Database Schema

| Table | Key columns |
|---|---|
| `papers` | `id`, `code`, `subject`, `exam_date`, `uploaded_at` |
| `questions` | `id`, `paper_id`, `question_number`, `type` (enum), `stem_html`, `option_1–4`, `correct_options` (int[]), `correct_integer`, `match_col1/2` (jsonb), `assertion_text`, `reason_text`, `images` (text[]), `has_latex`, `needs_review` |

### KaTeX Rendering

`src/components/LatexRenderer.tsx` is a reusable component that accepts mixed HTML+LaTeX strings, splits on `$$…$$` (block) and `$…$` (inline) delimiters without breaking HTML tag attributes, and renders each segment with `react-katex` or `dangerouslySetInnerHTML`. KaTeX parse errors show an inline red badge instead of crashing the card.
