import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Play, Pause, Loader2, CheckCircle2, ChevronDown } from "lucide-react";
import SEO from "@/components/SEO";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useCourseDetail } from "@/hooks/useCourseDetail";

// Auto-complete a lesson once the learner has watched this fraction of it.
const COMPLETION_THRESHOLD = 0.9;

const LecturePlayerPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { course, chapters, loading } = useCourseDetail(slug);

  const [enrolledId, setEnrolledId] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, { watched_seconds: number; is_completed: boolean }>>({});
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [expandedChapter, setExpandedChapter] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [notes, setNotes] = useState("");
  const [accessChecked, setAccessChecked] = useState(false);

  const [presignedUrl, setPresignedUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [watermarkPos, setWatermarkPos] = useState({ x: 10, y: 10 });
  const [hidden, setHidden] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSavedRef = useRef<number>(0);

  const flatLessons = useMemo(() => chapters.flatMap((c) => c.lessons), [chapters]);
  const activeLesson = flatLessons.find((l) => l.id === activeLessonId) ?? flatLessons[0];

  // Check enrollment + load progress
  useEffect(() => {
    if (authLoading || loading || !course) return;
    if (!user) {
      navigate(`/courses/${slug}`);
      return;
    }
    (async () => {
      const { data: enr } = await supabase
        .from("enrollments")
        .select("id")
        .eq("user_id", user.id)
        .eq("course_id", course.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!enr) {
        toast.info("Enroll in this course to start learning");
        navigate(`/courses/${slug}`);
        return;
      }
      setEnrolledId(enr.id);

      const { data: prog } = await supabase
        .from("lesson_progress")
        .select("lesson_slug, watched_seconds, is_completed")
        .eq("user_id", user.id)
        .eq("course_id", course.id);

      const map: Record<string, { watched_seconds: number; is_completed: boolean }> = {};
      (prog ?? []).forEach((p) => {
        map[p.lesson_slug] = { watched_seconds: p.watched_seconds, is_completed: p.is_completed };
      });
      setProgressMap(map);
      setAccessChecked(true);

      // Pick first incomplete lesson
      const next = flatLessons.find((l) => !map[l.slug]?.is_completed) ?? flatLessons[0];
      if (next) setActiveLessonId(next.id);
    })();
  }, [authLoading, loading, course, user, slug, navigate, flatLessons]);

  // Load lesson note when active lesson changes
  useEffect(() => {
    if (!user || !activeLesson) return;
    supabase
      .from("lesson_notes")
      .select("content")
      .eq("user_id", user.id)
      .eq("lesson_id", activeLesson.id)
      .maybeSingle()
      .then(({ data }) => setNotes(data?.content ?? ""));
  }, [user, activeLesson]);

  const fetchPresignedUrl = useCallback(async (lessonId: string) => {
    setVideoLoading(true);
    setPresignedUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke("get-video-url", {
        body: { lessonId },
      });
      if (error) throw error;
      console.log("Video URL:", data.videoUrl);
      setPresignedUrl(data.videoUrl);
    } catch (err) {
      console.error("Failed to get video URL", err);
      setPresignedUrl(null);
    } finally {
      setVideoLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeLesson?.id && accessChecked) {
      fetchPresignedUrl(activeLesson.id);
    }
  }, [activeLesson?.id, accessChecked, fetchPresignedUrl]);

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    console.error("Video failed to load", {
      src: v.src,
      errorCode: v.error?.code,
      errorMessage: v.error?.message,
    });
  };

  // Move watermark to a new random position every 6 seconds
  useEffect(() => {
    const move = () => setWatermarkPos({
      x: 5 + Math.random() * 65,
      y: 5 + Math.random() * 75,
    });
    move();
    const id = setInterval(move, 6000);
    return () => clearInterval(id);
  }, []);

  // Blur video when tab/window loses focus (deters screen-capture rigs)
  useEffect(() => {
    const onHide = () => setHidden(true);
    const onShow = () => setHidden(false);
    document.addEventListener("visibilitychange", () =>
      document.hidden ? onHide() : onShow()
    );
    window.addEventListener("blur", onHide);
    window.addEventListener("focus", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("blur", onHide);
      window.removeEventListener("focus", onShow);
    };
  }, []);

  const saveProgress = useCallback(
    async (currentSec: number, completed: boolean, lessonOverride?: typeof activeLesson) => {
      const lesson = lessonOverride ?? activeLesson;
      if (!user || !lesson || !course) return;
      const total = lesson.duration_seconds || 1;
      await supabase.from("lesson_progress").upsert(
        {
          user_id: user.id,
          course_id: course.id,
          lesson_slug: lesson.slug,
          lesson_title: lesson.title,
          watched_seconds: Math.floor(currentSec),
          total_seconds: total,
          is_completed: completed,
          last_watched_at: new Date().toISOString(),
        },
        { onConflict: "user_id,lesson_slug,course_id" } as never,
      );

      const nextMap = { ...progressMap, [lesson.slug]: { watched_seconds: Math.floor(currentSec), is_completed: completed } };
      setProgressMap(nextMap);
      const activeCompletedCount = flatLessons.filter((l) => nextMap[l.slug]?.is_completed).length;

      const percent = Math.min(100, Math.round((activeCompletedCount / Math.max(flatLessons.length, 1)) * 100));
      if (enrolledId) {
        await supabase
          .from("enrollments")
          .update({
            progress_percent: percent,
            completed_lessons: activeCompletedCount,
            last_lesson_title: lesson.title,
            last_accessed_at: new Date().toISOString(),
          })
          .eq("id", enrolledId);
      }

      if (completed) {
        await supabase.from("study_sessions").upsert(
          {
            user_id: user.id,
            session_date: new Date().toISOString().slice(0, 10),
            minutes_studied: Math.round(total / 60),
          },
          { onConflict: "user_id,session_date" } as never,
        );
      }
    },
    [activeLesson, user, course, enrolledId, flatLessons.length, progressMap],
  );

  const toggleComplete = async () => {
    if (!activeLesson) return;
    const isDone = progressMap[activeLesson.slug]?.is_completed;
    const watched = progressMap[activeLesson.slug]?.watched_seconds ?? (isDone ? 0 : activeLesson.duration_seconds);
    await saveProgress(watched, !isDone);
    toast.success(!isDone ? "Marked as complete" : "Marked as incomplete");
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !activeLesson) return;
    const now = Date.now();
    if (now - lastSavedRef.current > 5000) {
      lastSavedRef.current = now;
      saveProgress(v.currentTime, false);
    }
    if (v.duration && v.currentTime / v.duration >= COMPLETION_THRESHOLD && !progressMap[activeLesson.slug]?.is_completed) {
      saveProgress(v.currentTime, true);
      toast.success("Lesson completed!");
    }
  };

  const saveNotes = async () => {
    if (!user || !activeLesson) return;
    await supabase
      .from("lesson_notes")
      .upsert({ user_id: user.id, lesson_id: activeLesson.id, content: notes }, { onConflict: "user_id,lesson_id" } as never);
    toast.success("Notes saved");
  };

  if (loading || authLoading || !accessChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!course || !activeLesson) {
    return (
      <div className="p-10 text-center">
        <h1 className="font-display text-xl font-black text-foreground">No content available</h1>
        <Link to="/my-courses" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to My Courses
        </Link>
      </div>
    );
  }

  const completedCount = flatLessons.filter((l) => progressMap[l.slug]?.is_completed).length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "hsl(222, 47%, 8%)" }}>
      {course && activeLesson && (
        <SEO
          title={`${activeLesson.title} – ${course.name}`}
          description={`Watching ${course.name} on ARKE Scholars.`}
        />
      )}
      <header className="flex items-center justify-between px-4 py-3 bg-[hsl(var(--navy))]">
        <div className="flex items-center gap-3 min-w-0">
          <Link to={`/courses/${slug}`} className="text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="text-sm font-bold text-white truncate">{course.name}</span>
        </div>
        <span className="text-xs text-white/60 shrink-0">
          {completedCount}/{flatLessons.length}
        </span>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="flex-1 flex flex-col">
          <div className="w-full bg-black flex justify-center">
            <div className="relative aspect-video w-full bg-black">
              {videoLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              ) : presignedUrl ? (
                <>
                  <video
                    ref={videoRef}
                    key={activeLesson.id}
                    src={presignedUrl}
                    controls
                    controlsList="nodownload noremoteplayback"
                    disablePictureInPicture
                    onContextMenu={(e) => e.preventDefault()}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onTimeUpdate={onTimeUpdate}
                    onError={handleVideoError}
                    onLoadedMetadata={() => {
                      const v = videoRef.current;
                      const saved = progressMap[activeLesson.slug]?.watched_seconds;
                      if (v && saved && saved < (activeLesson.duration_seconds || 0) - 10) {
                        v.currentTime = saved;
                      }
                    }}
                    className="absolute inset-0 h-full w-full"
                    style={{ filter: hidden ? "blur(24px) brightness(0.3)" : "none", transition: "filter 0.3s" }}
                  />

                  {/* Blur overlay when window loses focus */}
                  {hidden && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                      <p className="text-white/60 text-sm font-medium select-none">Return to tab to continue watching</p>
                    </div>
                  )}

                  {/* Moving email watermark — burns user identity into any screen recording */}
                  <div
                    className="absolute z-20 pointer-events-none select-none transition-all duration-&lsqb;3000ms&rsqb; ease-in-out"
                    style={{ left: `${watermarkPos.x}%`, top: `${watermarkPos.y}%` }}
                  >
                    <span
                      className="text-white font-mono text-sm whitespace-nowrap"
                      style={{ opacity: 0.5, textShadow: "0 0 6px rgba(0,0,0,0.9)" }}
                    >
                      {user?.email}
                    </span>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm text-center px-4">
                  Purchase this course to watch videos.
                </div>
              )}
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-white">{activeLesson.title}</h2>
                <p className="text-xs text-white/50">{Math.round(activeLesson.duration_seconds / 60)} min</p>
              </div>
              <button
                onClick={toggleComplete}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${progressMap[activeLesson.slug]?.is_completed
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-white/10 text-white hover:bg-white/20"
                  }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                {progressMap[activeLesson.slug]?.is_completed ? "Completed" : "Mark as complete"}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:w-[320px] border-l border-white/10 bg-[hsl(var(--navy2))] overflow-y-auto">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-sm font-bold text-white">Course Content</h3>
            <p className="text-[10px] text-white/50 mt-1">
              {completedCount} of {flatLessons.length} completed
            </p>
            <div className="h-1.5 rounded-full bg-white/10 mt-2">
              <div
                className="h-1.5 rounded-full bg-secondary transition-all"
                style={{ width: `${flatLessons.length ? (completedCount / flatLessons.length) * 100 : 0}%` }}
              />
            </div>
          </div>
          {chapters.map((ch, ci) => (
            <div key={ch.id}>
              <button
                onClick={() => setExpandedChapter(expandedChapter === ci ? -1 : ci)}
                className="flex items-center justify-between w-full px-4 py-3 hover:bg-white/5 transition-colors"
              >
                <span className="text-xs font-bold text-white text-left">
                  {ch.title} ({ch.lessons.length})
                </span>
                <ChevronDown className={`h-4 w-4 text-white/50 transition-transform ${expandedChapter === ci ? "rotate-180" : ""}`} />
              </button>
              {expandedChapter === ci && (
                <div>
                  {ch.lessons.map((lec) => {
                    const isActive = lec.id === activeLesson.id;
                    const isDone = progressMap[lec.slug]?.is_completed;
                    return (
                      <button
                        key={lec.id}
                        onClick={() => setActiveLessonId(lec.id)}
                        className={`flex items-center gap-3 px-4 py-2.5 text-xs w-full text-left ${isActive ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-white/5"
                          } transition-colors`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4 text-secondary shrink-0" />
                        ) : isActive && playing ? (
                          <Pause className="h-4 w-4 text-primary shrink-0" />
                        ) : (
                          <Play className="h-4 w-4 text-white/60 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white/80 truncate">{lec.title}</p>
                          <p className="text-white/40 text-[10px]">{Math.round(lec.duration_seconds / 60)} min</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LecturePlayerPage;
