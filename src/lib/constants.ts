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
