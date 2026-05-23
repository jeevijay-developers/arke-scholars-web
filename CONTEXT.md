# CONTEXT.md — Arke Scholars Project

Domain reference for the Arke Scholars learning platform. Companion to [CLAUDE.md](./CLAUDE.md) (which holds operational rules); this file describes **what the system is and how its modules fit together**.

## Product

Arke Scholars is a learning platform targeting:
- **India**: JEE, NEET, CUET aspirants
- **Dubai**: CBSE / IB / IGCSE students

Both regions share one codebase; the active region is held in `useAppStore.country` and persisted to `localStorage`.

### Core capabilities

1. **Courses** — video lectures, lesson notes, PDFs, progress tracking, enrollments
2. **Tests** — timed multi-subject tests with rich question types (SCQ/MCQ/integer/match-column/assertion-reasoning), subject-wise breakdowns
3. **Live classes** — Agora-powered video classrooms with chat, attendance, recording
4. **Compete** — 1v1 matchmaking quiz battles (legacy)
5. **Battle** — newer matchmaking system (lobby → room → result → leaderboard)
6. **Doubts** — students post doubts, AI (Gemini) or teachers answer
7. **Mentorship** — assigned mentor + group chat + announcements + handovers
8. **Question Bank** — admin-curated question library
9. **Bulk Question Upload** — docx import pipeline (see CLAUDE.md)
10. **Notifications** — in-app + email (preferences per channel)
11. **Payments** — Razorpay for India enrollments
12. **Educator applications** — public form → admin review → provisions teacher account

---

## Workspace structure

```
arambhapp-main/
├── arke-scholars-web/        Main application
│   ├── src/                  Frontend (React 18 + TS)
│   ├── supabase/             Active migrations + edge functions
│   ├── scripts/              Build helpers (generate-routes, postbuild)
│   ├── tests/                Playwright E2E specs
│   ├── public/               Static assets
│   ├── dist/                 Build output (gitignored)
│   ├── package.json
│   ├── vite.config.ts        + dev-only Agora token middleware
│   ├── tailwind.config.ts
│   ├── playwright.config.ts
│   └── vitest.config.ts
├── supabase/functions/sitemap/   Standalone sitemap edge function
├── lovable-cloud-export-…/   Vendored export, not active
├── fix_*.sql                 One-off DB hotfix snapshots
└── .mcp.json                 MCP server config (Supabase)
```

---

## Frontend module map

### `src/App.tsx`
Root router. Sets up `HelmetProvider`, TanStack Query client (5min stale, 30min gc, no focus refetch), `BrowserRouter`, `AuthProvider`. All routes declared here — see "Routing" below.

### `src/main.tsx`
Vite entrypoint. Mounts `<App />`.

### `src/context/AuthContext.tsx`
The single source of truth for the current user's session + role.
- Wraps Supabase `onAuthStateChange`.
- Resolves role via parallel `has_role` RPC calls for `super_admin / admin / teacher / mentor`; defaults to `student`.
- Exposes: `session, user, role, roleReady, isSuperAdmin, isAdmin, isStaff, isTeacher, isMentor, isStudent, signIn, signOut, refreshProfile, refreshRole, loading`.
- `roleReady` must be true before route guards make redirect decisions.

### `src/store/useAppStore.ts` (Zustand)
Cross-cutting non-server state:
- `user` (cached `AppUser` — also persisted to `localStorage` under `arke-user-cache`)
- `currentGoal` (e.g. `"IIT JEE"`)
- `notifications`, `unreadCount` (mirrors realtime updates)
- `country` (`india | dubai`, persisted as `arke-country`)

### `src/integrations/supabase/`
- `client.ts` — auto-generated. Single `supabase` client; uses `localStorage` for session persistence.
- `types.ts` — auto-generated DB types (do not hand-edit).

### `src/components/` — top-level (see file tree for full list)

**Layouts**
- `PublicLayout` — marketing pages (own navbar + footer)
- `StudentLayout` — sidebar + bottom-nav, student-only routes
- `TeacherLayout` — trimmed: only live classes + doubts
- `MentorLayout` — mentor portal
- `AdminLayout` — admin/super-admin portal sidebar

**Guards**
- `ProtectedRoute` — wraps role-restricted student/teacher/mentor routes
- `ProtectedStudentRoute` — student-only convenience
- `ProtectedAdminRoute` — admin+super_admin

**Reusable**
- `LatexRenderer` / `MathRenderer` / `MathField` / `HtmlField` — math/HTML content
- `FormattedAnswer` — renders question answers
- `SEO` — react-helmet-async wrapper
- `NotificationBell` / `NotificationPreferences`
- `EnrollmentModal`, `EducatorApplicationDialog`, `BulkQuestionUploadDialog`, `ReportDialog`, `ConfirmDialog`, `QuestionEditorDialog`, `MentorAnnouncementDialog`
- `AgoraVideoRoom` — live-class video tile grid
- `MentorChatPanel`, `StudentMentorMeetingCard`, `MentorReviewCard`
- `OnboardingTracker`, `GoalSelector`, `GoalSetupCard`, `CityStateFields`
- `QuestionBankPanel`, `CourseReviews`, `LiveBadge`, `Spinner`, `StatCard`, `SectionHeader`, `TablePagination`, `NavLink`, `LogoutButton`

**Sub-folders**
- `components/battle/` — `FilterSelector`, `LiveScorePanel`, `QuestionCard`, `ResultCard` (newer battle system)
- `components/compete/` — `CompeteCountdown`, `CompeteLobby`, `CompeteMatch`, `CompeteResult`, `CompeteSearching` (legacy 1v1)
- `components/ui/` — shadcn primitives (Radix-based); generated, prefer editing usage sites not these

### `src/hooks/`
TanStack Query–based data hooks, one per domain area:
`useAdminUsers, useBattleLeaderboard, useBattleMatchmaking, useBattleRoom, useCompeteMatch, useCompeteRating, useCompeteTopics, useCourseDetail, useCourses, useDashboardData, useDoubts, useEducators, useEnrolledCourseIds, useExams, useLiveClasses, useMentorAnnouncements, useMentorChat, useNotifications, usePagination, useQuestionBank, useTeacherAnalytics, useTeacherDashboard, useTeacherStudents, useTests` + UI hooks `use-mobile, use-toast`.

### `src/lib/`
- `agoraClient.ts` — Agora SDK wrapper
- `analytics.ts` — page-view tracking (`trackPageView` invoked by `<RouteTracker>` in App.tsx)
- `cityData.ts` — Indian state/city dropdown data
- `constants.ts` — shared filter lists (`SUBJECTS`, `SUBJECTS_COMPETE`, etc.)
- `notify.ts` — notification helpers
- `progress.ts` (+ `.test.ts`) — course/lesson progress logic
- `studentReport.ts` — PDF report generation (jspdf + autotable + html2canvas)
- `utils.ts` — `cn()` (clsx + tailwind-merge), formatters

### `src/pages/`
~90 page components, grouped by role:
- **Public**: `LandingPage, CoursesPage, CourseDetailPage, TestsLandingPage, LiveClassesLandingPage, EducatorsPage, PricingPage, MentorshipPage, AdmissionsPage, AssociationPage, AboutPage, ContactPage, CareerPage, PrivacyPolicyPage, TermsOfServicePage`
- **Auth**: `LoginPage, SignupPage, VerifyEmailPage, AuthCallbackPage, ForceChangePasswordPage, ForgotPasswordPage, UnsubscribePage, AccessDeniedPage, AdminLoginPage`
- **Student**: `StudentDashboard, MyCoursesPage, StorePage (explore-courses), CourseDetailPage, LecturePlayerPage, TestListPage, TestTakingPage, TestResultPage, TestSubjectBreakdownPage, LiveClassesListPage, LiveClassRoomPage, CompetePage, BattleLobby, BattleRoom, BattleResult, BattleLeaderboard, DoubtPage, LeaderboardPage, AnalyticsPage, ProfilePage, NotificationsPage, SettingsPage, StudentMentorChatPage`
- **Teacher**: `TeacherDashboard, TeacherDoubtQueuePage, TeacherLiveClassesPage, TeacherLiveClassRoomPage, TeacherSettingsPage` (other Teacher* pages exist but routes redirect to dashboard)
- **Mentor**: `MentorDashboard, MentorStudentsPage, MentorAnnouncementsPage, MentorChatsPage, MentorPerformancePage, MentorSettingsPage`
- **Admin**: `StaffDashboardPage, AdminDashboard, AdminUsersPage, AdminStudentsPage, AdminStudentReportsPage, AdminSchoolsPage, AdminMentorAssignmentsPage, AdminMentorHandoversPage, AdminCoursesPage, CreateCoursePage, AdminCourseContentPage, AdminLiveClassesPage, AdminTestsPage, CreateTestPage, AdminQuestionBankPage, AdminCompeteQuestionsPage, AdminUploadQuestionsPage, AdminReviewQuestionsPage, AdminExamsPage, AdminPaymentsPage, AdminNotificationsPage, AdminModerationPage, AdminSettingsPage, AdminEducatorApplicationsPage, AdminEnquiriesPage, AdminReportsPage, AdminAdminsPage, AdminProfilePage`

---

## Routing summary (from `src/App.tsx`)

| Prefix | Layout | Guard |
|---|---|---|
| `/` (marketing) | `PublicLayout` | none |
| `/login`, `/signup`, `/verify-email`, `/auth/*`, `/forgot-password`, `/unsubscribe`, `/access-denied` | none | none |
| `/tests/:slug/take`, `/courses/:slug/learn` | none (immersive) | `ProtectedRoute allow=["student"]` |
| `/dashboard, /my-tests, /my-live-classes, /my-courses, /explore-courses, /compete, /battle/*, /doubts, /leaderboard, /analytics, /profile, /notifications, /settings, /mentor-chat` | `StudentLayout` | student |
| `/teacher/*` | `TeacherLayout` | teacher (most legacy routes redirect to `/teacher/dashboard`) |
| `/mentor/*` | `MentorLayout` | mentor |
| `/admin/login` | none | none |
| `/admin/*` | `AdminLayout` | `ProtectedAdminRoute` (admin + super_admin) |
| `*` | — | `NotFound` |

---

## Database (Supabase Postgres)

### Tables (from generated types)

**Identity & access**
- `profiles`, `user_roles`, `schools`

**Catalog**
- `courses, chapters, lessons, course_resources, course_pdfs, course_reviews, lesson_notes, lesson_progress, exams, enquiries, educator_applications, educator_follows`

**Enrollment & progress**
- `enrollments, study_sessions`

**Tests & questions**
- `tests, test_questions, test_attempts, question_bank, papers, questions` (papers/questions added by the bulk-upload feature)

**Live classes**
- `live_classes, live_class_templates, live_class_attendance, live_class_messages`

**Compete (legacy)**
- `compete_queue, compete_matches, compete_match_answers, compete_ratings, compete_questions`

**Battle (current)**
- `battles, battle_answers, battle_scores` (see migrations 20260522000001..003)

**Doubts**
- `doubts, doubt_answers`

**Mentorship**
- `mentor_student_assignments, mentor_announcements, mentor_announcement_rsvps, mentor_backup_pool, mentor_groups, mentor_group_members, mentor_group_reads, mentor_handovers, mentor_messages, mentor_reviews`

**Notifications & email**
- `notifications, notification_preferences, email_send_log, email_send_state, email_unsubscribe_tokens, suppressed_emails`

**Other**
- `payments, platform_settings, reports`

### Key RPCs / functions

- `has_role(_user_id, _role)` — security-definer role check, used by AuthContext
- `admin_set_user_role`, `enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`
- `educator_application_exists`, `enquiry_recently_submitted`
- `is_active_backup_for_mentor`, `is_active_backup_for_student`, `is_member_of_group`, `is_mentor_of_group`
- `notify_admins`, `upcoming_live_class_reminders`

### Migrations

In `arke-scholars-web/supabase/migrations/`, timestamped `YYYYMMDDHHMMSS_*.sql`. **Never edit a shipped migration** — write a new one. Migration coverage: schema, RLS policies, trigger fixes, storage policies (e.g. `question_images_storage_policies`, `course_pdfs_rls`).

### Storage buckets (referenced in code/migrations)

- `question-images` (public) — used by `parse-docx`
- Course PDFs / lesson resources (private, signed URLs via `get-upload-url` / `get-video-url`)

---

## Edge functions (`arke-scholars-web/supabase/functions/`)

Deno runtime. Each is a separate folder with `index.ts`. Imports go through `esm.sh`.

| Function | `verify_jwt` | Purpose |
|---|---|---|
| `_shared` | n/a | CORS headers + utilities reused by other functions |
| `agora-token` | default | Mint Agora RTC tokens (production replacement for the dev vite middleware) |
| `agora-cloud-recording` | default | Start/stop Agora cloud recording |
| `manage-s3-recordings` | default | Manage uploaded recording files |
| `get-upload-url` | true | Signed upload URLs (videos/PDFs) |
| `get-video-url` | true | Signed playback URLs |
| `parse-docx` | **false** | docx → HTML + image storage + question splits (bulk upload) |
| `ai-doubt-solver` | default | Gemini-powered doubt answers |
| `teacher-ai-draft` | default | Drafts AI replies for teachers in the doubt queue |
| `compete-create-room`, `compete-join-room`, `compete-matchmake`, `compete-submit-answer` | default | Legacy compete system |
| `select-battle-questions`, `submit-battle-answer`, `complete-battle` | default | New battle system |
| `bulk-onboard-school-students` | default | Bulk school student creation |
| `manage-admin`, `manage-student` | default | Admin/student CRUD with elevated checks |
| `provision-teacher` | default | Provision teacher account from approved educator application |
| `clear-password-flag` | default | Clears `must_change_password` |
| `razorpay-create-order`, `razorpay-verify-payment` | default | Razorpay integration |
| `send-transactional-email` | true | Sends via Resend |
| `process-email-queue` | true | Worker draining `email_send_state` |
| `preview-transactional-email` | false | Render email template HTML for admin preview |
| `handle-email-unsubscribe`, `handle-email-suppression` | false | Webhook + manual unsubscribe |
| `send-doubt-answered-email`, `send-live-class-reminders` | default/true | Trigger transactional emails |
| `seed-staff-user`, `seed-mentor-demo`, `seed-super-admin` | **false** | Dev/staging seed scripts |

Standalone (outside main app): `supabase/functions/sitemap/` — public sitemap generator.

---

## Build & deploy

- **`scripts/generate-routes.mjs`** — runs in `prebuild`, generates a route manifest for SEO / `react-snap` prerender list
- **`scripts/postbuild.mjs`** — runs after `vite build` (prerender / sitemap / robots step)
- **`vercel.json`** — Vercel deployment config (SPA rewrites)
- **`reactSnap` config in package.json** — public marketing routes get prerendered into static HTML for SEO

---

## Testing

- **Unit**: `vitest`, jsdom env, Testing Library — colocated `*.test.ts(x)` and `src/test/` setup
- **E2E**: Playwright — specs in `tests/`, fixture in `playwright-fixture.ts`
- The `progress.test.ts` is an example unit test in `src/lib/`
- `src/pages/__tests__/` holds page-level tests

---

## Conventions cheatsheet

| Concern | Where |
|---|---|
| Add a route | `src/App.tsx` (place under correct layout/guard) |
| Add a page | `src/pages/Foo.tsx` then import in App.tsx |
| Add a data fetch | new hook in `src/hooks/useFoo.ts` returning `useQuery`/`useMutation` |
| Add a DB column | new migration in `supabase/migrations/`, regenerate types |
| Add an edge function | new folder under `supabase/functions/`, register in `config.toml` if `verify_jwt` override needed |
| Add a shared filter list | extend `src/lib/constants.ts` |
| Add a shadcn UI primitive | already vendored under `src/components/ui/` — check before adding |
| Math content | wrap in `<LatexRenderer>` |
| Toasts | `sonner` (`import { toast } from "sonner"`) |
| Forms | react-hook-form + zod + shadcn `<Form>` |
| Country switch | read/write `useAppStore.country`, persisted to `localStorage` |
| Role check in UI | use `useAuth()` from `AuthContext`, check `isStaff` / `isStudent` / etc. |
| Server role check | call `has_role` RPC |

---

## Known feature areas (deeper notes)

### Bulk Question Upload
`/admin/upload-questions` → `parse-docx` (fflate + mammoth, KaTeX/OMML detection, image upload to `question-images`) → admin reviews at `/admin/review-questions/:paperId` → approval inserts into `questions`. Unapproved cards are lost on refresh (by design). See README for question-type detection rules.

### Live classes
Agora RTC. Token minted by `agora-token` edge function in prod, mocked by Vite middleware in dev. Channel name keyed off `live_classes.slug`. Cloud recording optional via `agora-cloud-recording`. Attendance auto-tracked in `live_class_attendance`. Chat in `live_class_messages` via Supabase Realtime.

### Compete vs Battle
Two generations of 1v1 quiz. `compete_*` tables + `compete-*` functions are legacy but still wired at `/compete`. The newer `battles*` schema + `select-battle-questions / submit-battle-answer / complete-battle` powers `/battle/*`.

### Mentorship
Each student can be assigned a mentor. Group chats (`mentor_groups` + `mentor_messages`). Announcements with RSVPs. Backup pool for cover when primary mentor unavailable. Handovers for mentor reassignment workflows.

### Email queue
Application code calls `enqueue_email` RPC → row in `email_send_state` → `process-email-queue` cron drains it → calls `send-transactional-email` (Resend). Suppressed addresses skipped via `suppressed_emails`. Unsubscribe tokens single-use, stored in `email_unsubscribe_tokens`.

---

## Environment variables

Frontend (Vite, prefixed `VITE_`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_AGORA_APP_ID`

Server-only (Vite dev middleware / edge functions):
- `AGORA_APP_CERTIFICATE` (dev middleware only — prod uses the edge function with its own secret)
- Standard Supabase service-role secrets in edge function env (`SUPABASE_SERVICE_ROLE_KEY`, etc.)
- Resend API key, Razorpay key+secret, Gemini API key — all referenced inside their respective edge functions

---

## Pointers

- Main README: [arke-scholars-web/README.md](arke-scholars-web/README.md) — bulk-upload spec
- Supabase project ref: `hlaifxrweemzkpqjoizj`
- App entry: [arke-scholars-web/src/App.tsx](arke-scholars-web/src/App.tsx)
- Auth source of truth: [arke-scholars-web/src/context/AuthContext.tsx](arke-scholars-web/src/context/AuthContext.tsx)
- Vite config (dev Agora middleware): [arke-scholars-web/vite.config.ts](arke-scholars-web/vite.config.ts)
- Supabase config (jwt overrides): [arke-scholars-web/supabase/config.toml](arke-scholars-web/supabase/config.toml)
