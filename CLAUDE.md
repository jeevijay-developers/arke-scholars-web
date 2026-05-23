# CLAUDE.md — Arke Scholars

Operational instructions for AI assistants working in this repository. For the full domain model, table list, and module map, read [CONTEXT.md](./CONTEXT.md).

## Workspace layout

```
arambhapp-main/
├── arke-scholars-web/        ← main app (React + Vite + TS). cd here for everything.
│   ├── src/                  ← frontend
│   ├── supabase/             ← migrations + edge functions (active)
│   ├── package.json          ← npm / bun scripts
│   └── vite.config.ts
├── supabase/functions/sitemap/   ← standalone sitemap function (separate from app)
└── *.sql                     ← one-off DB fix scripts, do not auto-apply
```

**All `npm`/`bun` commands run from `arke-scholars-web/`.** The repo root has no package.json.

## Stack

- **Frontend**: React 18, TypeScript, Vite (SWC), Tailwind, shadcn/ui (Radix), React Router v6, TanStack Query v5, Zustand, react-hook-form + zod
- **Backend**: Supabase (Postgres + Auth + Edge Functions + Storage + Realtime)
- **Realtime/Video**: Agora RTC SDK NG
- **Math**: KaTeX, MathLive, react-katex, remark-math, rehype-katex
- **Payments**: Razorpay (India). Stripe (Dubai) not yet wired.
- **Email**: Resend via `send-transactional-email` edge function + `process-email-queue` worker
- **AI**: Google Gemini 2.5 Flash (used by `ai-doubt-solver`, `teacher-ai-draft`)
- **Testing**: Vitest (unit), Playwright (E2E), Testing Library

## Scripts

From `arke-scholars-web/`:
- `npm run dev` — Vite dev server on port 8080 (includes mock Agora token + recording middlewares)
- `npm run build` — generates routes (`scripts/generate-routes.mjs`) → vite build → `scripts/postbuild.mjs`
- `npm run lint` — ESLint
- `npm test` / `npm run test:watch` — Vitest
- Playwright: `npx playwright test` (config in `playwright.config.ts`)

## Path aliases

`@/*` → `src/*` (configured in [vite.config.ts](arke-scholars-web/vite.config.ts) and [tsconfig.json](arke-scholars-web/tsconfig.json)).

## Supabase

- Project ref: `hlaifxrweemzkpqjoizj` (from `supabase/config.toml`)
- Client: `@/integrations/supabase/client` — uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
- Types: `@/integrations/supabase/types` (regenerated, do not hand-edit)
- Migrations: `arke-scholars-web/supabase/migrations/` — timestamped, never modify shipped migrations; add a new one
- Edge functions: `arke-scholars-web/supabase/functions/<name>/index.ts` (Deno runtime, imports via `esm.sh`)
- `verify_jwt` overrides live in `supabase/config.toml`

## Authentication & roles

Five roles (see [AuthContext.tsx](arke-scholars-web/src/context/AuthContext.tsx)):
`student | teacher | mentor | admin | super_admin`

- Role is resolved server-side via the `has_role` security-definer RPC against `user_roles`.
- Guards: `<ProtectedRoute allow={[...]}>` for student/teacher/mentor, `<ProtectedAdminRoute>` for admin+super_admin.
- `roleReady` flag in AuthContext — wait for it before redirecting in guards (prevents flicker).
- Admin/staff sign in at `/admin/login`. Student/teacher/mentor at `/login`.

## Route conventions

Routing in [App.tsx](arke-scholars-web/src/App.tsx):
- Public marketing pages wrapped in `<PublicLayout>` (own navbar+footer)
- Immersive student pages (`/tests/:slug/take`, `/courses/:slug/learn`) have NO layout — full-screen
- Each role has its own layout: `StudentLayout`, `TeacherLayout`, `MentorLayout`, `AdminLayout`
- Teacher portal is intentionally trimmed (live classes + doubts only). Course/test/question-bank management is admin-only — legacy `/teacher/*` URLs redirect to dashboard.

## Coding rules

- **Never edit `src/integrations/supabase/types.ts` or `client.ts`** — they are auto-generated. Header comment says so.
- **Shared filter lists** (subjects, exams, etc.) live in [src/lib/constants.ts](arke-scholars-web/src/lib/constants.ts). Use `SUBJECTS` everywhere except Compete which uses `SUBJECTS_COMPETE` (`Math` vs `Mathematics`).
- **TanStack Query defaults**: `staleTime: 5min`, `gcTime: 30min`, no refetch on window-focus, retry 1. Don't override globally.
- **Forms**: react-hook-form + zod resolver + shadcn `<Form>` primitives. Validate at the boundary.
- **UI**: prefer shadcn `ui/*` primitives. New components go in `src/components/`. Don't introduce a new component library.
- **Math content**: render with `<LatexRenderer>` — it handles mixed HTML + `$...$` / `$$...$$` and shows an inline error badge on KaTeX parse failure instead of crashing.
- **Toasts**: use `sonner` (`import { toast } from "sonner"`) for new code; legacy `useToast` is still wired but prefer Sonner.
- **State**: Zustand store (`useAppStore`) holds cross-cutting state (user, notifications, country, current goal). Use TanStack Query for server data, not Zustand.
- **Country**: app is dual-region (`india` | `dubai`). Country lives in `useAppStore.country`, persisted to `localStorage` as `arke-country`.

## Realtime / video

- Live classes use Agora. Tokens are minted by `supabase/functions/agora-token` (and a dev mock in `vite.config.ts` at `/api/agora-token`).
- Cloud recording via `agora-cloud-recording` function; uploaded recordings managed by `manage-s3-recordings`.
- Never put the Agora certificate in client code — it's a server-only secret.

## Payments

- `razorpay-create-order` creates the order, `razorpay-verify-payment` verifies the HMAC signature server-side before granting access. Never trust client-reported payment success.

## Email pipeline

`enqueue_email` (DB function) → `email_send_state` table → `process-email-queue` (cron-style worker) → `send-transactional-email` (Resend). Suppressions in `suppressed_emails`, unsubscribe tokens in `email_unsubscribe_tokens`.

## Bulk question upload (active feature)

Admin flow at `/admin/upload-questions` → `parse-docx` edge function (fflate + mammoth + KaTeX detection) → review at `/admin/review-questions/:paperId` → admin approves → row inserted into `questions`. The edge function never writes to DB; only admin approval does. Refreshing the review page loses unapproved cards by design.

Storage bucket: `question-images` (public). See [README.md](arke-scholars-web/README.md) for the full spec.

## Things to avoid

- Don't auto-apply `fix_*.sql` files in the repo root — they're snapshots of one-off fixes the user ran manually.
- Don't add new top-level packages without checking [package.json](arke-scholars-web/package.json) — the dep list is already heavy.
- Don't introduce a new auth/role check pattern — extend `AuthContext` or `has_role` RPC.
- Don't hand-roll math rendering — go through `<LatexRenderer>` / `<MathRenderer>` / `<MathField>`.
- Don't commit changes to `dist/`, `node_modules/`, `test-results/`, `playwright-report/`.

## When unsure

Read [CONTEXT.md](./CONTEXT.md) for the module-by-module map.
