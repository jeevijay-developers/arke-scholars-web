/**
 * Prebuild script: fetches all published course slugs from Supabase
 * and injects them into the reactSnap.include list in package.json
 * so react-snap pre-renders every course detail page at build time.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("[generate-routes] Supabase env vars not found — skipping dynamic route injection.");
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const { data: courses, error } = await supabase
  .from("courses")
  .select("slug")
  .eq("is_published", true);

if (error) {
  console.error("[generate-routes] Failed to fetch course slugs:", error.message);
  process.exit(0);
}

const courseRoutes = (courses ?? []).map((c) => `/courses/${c.slug}`);

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));

const baseRoutes = [
  "/", "/courses", "/tests", "/live-classes", "/pricing",
  "/mentorship", "/admissions", "/educators", "/career",
  "/association", "/about", "/contact",
];

pkg.reactSnap = {
  ...pkg.reactSnap,
  include: [...baseRoutes, ...courseRoutes],
};

writeFileSync("./package.json", JSON.stringify(pkg, null, 2) + "\n");
console.log(`[generate-routes] Injected ${courseRoutes.length} course routes into reactSnap.include`);
