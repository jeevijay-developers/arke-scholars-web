/**
 * Single source of truth for shared filter/option lists.
 * Keep these here so Question Bank, Compete, Educator forms, etc. stay aligned.
 */

// Canonical subject list used across Question Bank, Educator applications, etc.
// Note: Compete historically uses "Math" instead of "Mathematics" — alias below.
export const SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology"] as const;

// "All" prefix variant for filter UIs.
export const SUBJECTS_WITH_ALL = ["All", ...SUBJECTS] as const;

// Compete uses a slightly different label; expose both so that submission code
// can normalise. Prefer SUBJECTS in new code.
export const SUBJECTS_COMPETE = ["Physics", "Chemistry", "Math", "Biology"] as const;

// Accept both "Math" and "Mathematics" when filtering rows from mixed sources.
export const SUBJECTS_VALID_ANY = ["Physics", "Chemistry", "Math", "Mathematics", "Biology"] as const;

export type Subject = (typeof SUBJECTS)[number];

// Admin page keys used by the Staff RBAC permission matrix.
// Each key must match the page_key stored in staff_role_permissions and the
// path segment after /admin/ in AdminLayout nav items.
export const ADMIN_PAGE_KEYS = [
  { key: "overview", label: "Overview" },
  { key: "users", label: "Users" },
  { key: "students", label: "Students" },
  { key: "schools", label: "Schools" },
  { key: "mentor-assignments", label: "Mentor Assignments" },
  { key: "mentor-handovers", label: "Mentor Handovers" },
  { key: "courses", label: "Courses" },
  { key: "live-classes", label: "Live Classes" },
  { key: "tests", label: "Tests" },
  { key: "question-bank", label: "Question Bank" },
  { key: "upload-questions", label: "Upload Test" },
  { key: "compete-questions", label: "Compete Questions" },
  { key: "exams", label: "Exam Management" },
  { key: "course-banners", label: "Course Banners" },
  { key: "educator-applications", label: "Educator Applications" },
  { key: "enquiries", label: "Enquiries" },
  { key: "course-content", label: "Course Content" },
  { key: "student-reports", label: "Student Analysis" },
  { key: "reports", label: "Reports" },
  { key: "notifications", label: "Notifications" },
  { key: "payments", label: "Payments & Revenue" },
  { key: "moderation", label: "Moderation" },
  { key: "settings", label: "Platform Settings" },
] as const;

export type AdminPageKey = (typeof ADMIN_PAGE_KEYS)[number]["key"];

export type StaffPagePermission = {
  page_key: AdminPageKey;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  can_export: boolean;
};

// Canonical payment gateway list used across admin enrollment/assignment pages.
// "razorpay" is excluded from MANUAL_GATEWAYS because manual assignments are
// offline payments; Razorpay payments are processed through the payment flow.
export const MANUAL_GATEWAYS = [
  { value: "cash",          label: "Cash" },
  { value: "bank-transfer", label: "Bank Transfer" },
  { value: "cheque",        label: "Cheque" },
  { value: "other",         label: "Other" },
] as const;

export type ManualGateway = (typeof MANUAL_GATEWAYS)[number]["value"];

// Class level options — canonical list used across all student-facing and admin forms.
export const CLASS_LEVELS = [
  { value: "Class 8",  label: "Class 8" },
  { value: "Class 9",  label: "Class 9" },
  { value: "Class 10", label: "Class 10" },
  { value: "Class 11", label: "Class 11" },
  { value: "Class 12", label: "Class 12" },
  { value: "Dropper",  label: "Dropper" },
] as const;

export type ClassLevel = (typeof CLASS_LEVELS)[number]["value"];
