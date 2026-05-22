import { useEffect, useState } from "react";
import { Search, ChevronRight, Clock, FileText, Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { Link } from "react-router-dom";
import { useTests } from "@/hooks/useTests";
import { useAuth } from "@/context/AuthContext";
import { useEnrolledCourseIds } from "@/hooks/useEnrolledCourseIds";
import { supabase } from "@/integrations/supabase/client";

const subTabs = [
  { key: "all", label: "All Tests" },
  { key: "mock", label: "Mock Tests" },
  { key: "chapter", label: "Chapter Tests" },
  { key: "pyq", label: "Previous Year" },
  { key: "practice", label: "Practice" },
];

const TestListPage = () => {
  const [activeSub, setActiveSub] = useState("all");
  const [search, setSearch] = useState("");
  const { tests, loading } = useTests(activeSub);
  const { user, isStaff, isTeacher } = useAuth();
  const { enrolledCourseIds, loading: enrollmentLoading } = useEnrolledCourseIds();
  const [attemptStatus, setAttemptStatus] = useState<Record<string, string>>({});
  const [courseNames, setCourseNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const ids = [...new Set(tests.map((t) => t.course_id).filter(Boolean))] as string[];
    if (!ids.length) { setCourseNames({}); return; }
    supabase
      .from("courses")
      .select("id, name")
      .in("id", ids)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data ?? []).forEach((c) => { map[c.id] = c.name; });
        setCourseNames(map);
      });
  }, [tests]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("test_attempts")
      .select("test_id, status, score")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data ?? []).forEach((a) => {
          if (a.test_id) map[a.test_id] = a.status;
        });
        setAttemptStatus(map);
      });
  }, [user, tests]);

  const canSeeAll = isStaff || isTeacher;
  const visible = canSeeAll
    ? tests
    : tests.filter((t) => t.course_id === null || enrolledCourseIds.has(t.course_id));
  const filtered = visible.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="pb-20 lg:pb-0">
      <SEO title="My Tests" description="Access your assigned and attempted tests on ARKE Scholars." />
      <div className="bg-[hsl(var(--navy))] grid-texture px-4 pt-4 pb-3">
        <h1 className="text-lg font-black font-display text-white">Tests</h1>
        <p className="text-xs text-white/70">{filtered.length} test{filtered.length === 1 ? "" : "s"} available</p>
      </div>

      <div className="p-4 lg:p-6 space-y-4">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="text"
            placeholder="Search for tests..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {subTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSub(tab.key)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeSub === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading || enrollmentLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="font-display text-lg font-bold text-foreground">No tests yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Check back soon — new tests are added regularly.</p>
          </div>
        ) : (
          <div className="space-y-3 stagger-children">
            {filtered.map((t) => {
              const status = attemptStatus[t.id];
              return (
                <Link
                  key={t.id}
                  to={`/tests/${t.slug}/take`}
                  className="block rounded-2xl border border-border bg-card p-4 hover-lift hover:border-primary/30"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-primary uppercase">{t.test_type} · {t.exam_pattern}</p>
                      <h3 className="text-sm font-bold text-foreground mt-0.5">{t.title}</h3>
                      {t.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{t.description}</p>}
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" /> {t.total_questions} questions
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {t.duration_minutes} min
                        </span>
                        {t.subjects.length > 0 && <span>{t.subjects.join(" · ")}</span>}
                        {t.course_id
                          ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{courseNames[t.course_id] ?? "Course"}</span>
                          : <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-bold text-secondary">Free</span>
                        }
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {status === "submitted" && (
                        <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-[10px] font-bold text-secondary">Completed</span>
                      )}
                      {status === "in_progress" && (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-600">In Progress</span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TestListPage;
