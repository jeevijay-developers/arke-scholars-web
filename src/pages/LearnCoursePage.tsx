import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronDown, ChevronRight, Folder, FolderOpen,
  Radio, FileText, Play, Video, ClipboardList,
  ExternalLink, Loader2, BookOpen, Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import SEO from "@/components/SEO";

// ── Types ─────────────────────────────────────────────────────────────────────

type ContentType = "live_class" | "pdf" | "recorded_lecture" | "video" | "test";

type FolderRow = {
  id: string;
  parent_id: string | null;
  name: string;
  order: number;
  subFolders?: FolderRow[];
};

type ContentItem = {
  id: string;
  folder_id: string;
  type: ContentType;
  title: string;
  description: string | null;
  file_url: string | null;
  video_url: string | null;
  video_source: "s3" | "youtube" | null;
  zoom_link: string | null;
  scheduled_at: string | null;
  test_id: string | null;
  is_free_preview: boolean;
};

type Course = {
  id: string;
  name: string;
  thumbnail_url: string | null;
  target: string;
  class: string;
};

// ── Icon map ──────────────────────────────────────────────────────────────────

const TYPE_META: Record<ContentType, { label: string; Icon: React.ElementType; color: string }> = {
  live_class:       { label: "Live Class",        Icon: Radio,         color: "text-red-500" },
  pdf:              { label: "PDF",               Icon: FileText,      color: "text-red-400" },
  recorded_lecture: { label: "Recorded",          Icon: Play,          color: "text-foreground" },
  video:            { label: "Video",             Icon: Video,         color: "text-orange-500" },
  test:             { label: "Test",              Icon: ClipboardList, color: "text-purple-500" },
};

// ── YouTube embed helper ──────────────────────────────────────────────────────

function youtubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

const S3_HOST      = "https://s3.ap-tokyo.megas4.com";
const S3_READ_BASE = "https://s3.ap-tokyo.megas4.com/biijszzsfufvateaffbvtjapmculhceod7agr";

// Normalize any S3 video URL to the correct bucket-prefixed form.
// Handles three stored formats:
//   (a) correct:  https://s3.ap-tokyo.megas4.com/biijsz.../arke/xxx.mp4  → unchanged
//   (b) legacy:   https://s3.ap-tokyo.megas4.com/arke/xxx.mp4            → inject bucket
//   (c) bare key: arke/xxx.mp4                                            → prepend S3_READ_BASE
// Any other https:// URL (external host) is returned unchanged.
function resolveS3Url(raw: string): string {
  if (!raw) return raw;
  if (raw.startsWith(S3_READ_BASE)) return raw;
  if (raw.startsWith(S3_HOST + "/")) {
    const path = raw.slice(S3_HOST.length + 1);
    return `${S3_READ_BASE}/${path}`;
  }
  if (raw.startsWith("http")) return raw; // non-S3 external URL
  const key = raw.startsWith("/") ? raw.slice(1) : raw;
  return `${S3_READ_BASE}/${key}`;
}

// ── Content viewer ────────────────────────────────────────────────────────────

function ContentViewer({ item }: { item: ContentItem }) {
  if (item.type === "video" || item.type === "recorded_lecture") {
    const isYT = item.video_source === "youtube" || (item.video_url?.includes("youtube") ?? false);
    const ytId = item.video_url ? youtubeId(item.video_url) : null;

    if (isYT && ytId) {
      return (
        <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${ytId}`}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      );
    }

    // Resolve URL regardless of video_source — handles legacy no-bucket S3 URLs too
    const rawUrl = item.video_url ?? item.file_url;
    if (rawUrl) {
      const src = resolveS3Url(rawUrl);
      return (
        <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
          <video
            key={src}
            src={src}
            controls
            className="h-full w-full"
            onError={(e) => console.error("Video load error", src, e)}
          />
        </div>
      );
    }
  }

  if (item.type === "pdf" && item.file_url) {
    return (
      <div className="flex h-[70vh] flex-col gap-3">
        <iframe src={item.file_url} title={item.title} className="flex-1 w-full rounded-xl border border-border" />
        <a href={item.file_url} download target="_blank" rel="noreferrer"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted">
          <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
        </a>
      </div>
    );
  }

  if (item.type === "live_class") {
    const scheduled = item.scheduled_at ? new Date(item.scheduled_at) : null;
    const past = scheduled ? scheduled < new Date() : false;
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-16">
        <Radio className="h-12 w-12 text-red-500" />
        <div className="text-center">
          <h3 className="text-xl font-bold text-foreground">{item.title}</h3>
          {scheduled && (
            <p className="mt-1 text-sm text-muted-foreground">
              {past ? "Took place on" : "Scheduled for"}{" "}
              {scheduled.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
        </div>
        {item.zoom_link && (
          item.zoom_link.startsWith("/") ? (
            <Link
              to={item.zoom_link}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90"
            >
              {past ? "Watch Recording" : "Join Class"}
            </Link>
          ) : (
            <a
              href={item.zoom_link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90"
            >
              <ExternalLink className="h-4 w-4" />
              {past ? "Watch Recording" : "Join Class"}
            </a>
          )
        )}
        {!item.zoom_link && <p className="text-sm text-muted-foreground">Link not available yet.</p>}
      </div>
    );
  }

  if (item.type === "test" && item.test_id) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-16">
        <ClipboardList className="h-12 w-12 text-purple-500" />
        <div className="text-center">
          <h3 className="text-xl font-bold text-foreground">{item.title}</h3>
          {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
        </div>
        <Link
          to={`/tests/${item.test_id}/take`}
          className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-bold text-white hover:bg-purple-700"
        >
          Start Test <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
      <BookOpen className="h-10 w-10" />
      <p className="text-sm">Content not available</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const LearnCoursePage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Load course + enrollment check + folders
  useEffect(() => {
    if (!courseId || !user) return;
    const init = async () => {
      setLoading(true);
      const [courseRes, enrollRes, foldersRes] = await Promise.all([
        supabase.from("courses").select("id, name, thumbnail_url, target, class").eq("id", courseId).maybeSingle(),
        supabase.from("enrollments").select("id").eq("course_id", courseId).eq("user_id", user.id).eq("is_active", true).maybeSingle(),
        supabase.from("folders").select("id, parent_id, name, order").eq("course_id", courseId).order("order", { ascending: true }),
      ]);

      if (courseRes.data) setCourse(courseRes.data as Course);
      setIsEnrolled(!!enrollRes.data);

      const all = (foldersRes.data ?? []) as FolderRow[];
      const level2 = all.filter((f) => f.parent_id === null);
      const withSubs: FolderRow[] = level2.map((f) => ({
        ...f,
        subFolders: all.filter((s) => s.parent_id === f.id).sort((a, b) => a.order - b.order),
      }));
      setFolders(withSubs);
      setLoading(false);
    };
    init();
  }, [courseId, user]);

  // Load content when folder selected
  const loadFolderContent = useCallback(async (folderId: string) => {
    setLoadingContent(true);
    setSelectedItem(null);
    const { data } = await supabase
      .from("content_items")
      .select("*")
      .eq("folder_id", folderId)
      .order("order", { ascending: true });
    setContentItems((data ?? []) as ContentItem[]);
    setLoadingContent(false);
  }, []);

  const selectFolder = (folder: FolderRow, depth: number) => {
    const hasSubs = (folder.subFolders?.length ?? 0) > 0;
    // Always expand/collapse parent folders that have subfolders
    if (depth === 0 && hasSubs) {
      setExpandedIds((prev) => {
        const n = new Set(prev);
        n.has(folder.id) ? n.delete(folder.id) : n.add(folder.id);
        return n;
      });
    }
    // Always load this folder's own content regardless of subfolders
    setSelectedFolderId(folder.id);
    loadFolderContent(folder.id);
  };

  const selectItem = (item: ContentItem) => {
    if (!isEnrolled && !item.is_free_preview) return;
    setSelectedItem(item);
    // Scroll to content area on mobile
    if (window.innerWidth < 1024) contentRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden lg:flex-row">
      {course && <SEO title={`${course.name} — Learn`} description={`Learning ${course.name}`} />}

      {/* ── Left sidebar ── */}
      <aside className="w-full shrink-0 overflow-y-auto border-b border-border bg-card lg:w-72 lg:border-b-0 lg:border-r lg:h-full">
        {/* Course header */}
        <div className="border-b border-border p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {course?.target} · Class {course?.class}
          </p>
          <h1 className="mt-0.5 text-sm font-bold text-foreground line-clamp-2">{course?.name}</h1>
        </div>

        {/* Folder tree */}
        <nav className="p-2">
          {folders.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground text-center">No content yet</p>
          ) : (
            folders.map((folder) => (
              <div key={folder.id}>
                <FolderItem
                  folder={folder}
                  depth={0}
                  isSelected={selectedFolderId === folder.id}
                  isExpanded={expandedIds.has(folder.id)}
                  onSelect={() => selectFolder(folder, 0)}
                />
                {expandedIds.has(folder.id) && (folder.subFolders ?? []).map((sub) => (
                  <FolderItem
                    key={sub.id}
                    folder={sub}
                    depth={1}
                    isSelected={selectedFolderId === sub.id}
                    isExpanded={false}
                    onSelect={() => selectFolder(sub, 1)}
                  />
                ))}
              </div>
            ))
          )}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main className="flex flex-1 flex-col overflow-hidden" ref={contentRef}>
        {/* Content list OR viewer */}
        {!selectedFolderId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">Select a folder from the left to view content</p>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
            {/* Content list */}
            <div className="w-full shrink-0 overflow-y-auto border-b border-border lg:w-80 lg:border-b-0 lg:border-r">
              {loadingContent ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : contentItems.length === 0 ? (
                <div className="flex h-32 items-center justify-center">
                  <p className="text-xs text-muted-foreground">No content in this folder</p>
                </div>
              ) : (
                <ul className="p-2 space-y-1">
                  {contentItems.map((item) => {
                    const locked = !isEnrolled && !item.is_free_preview;
                    const meta = TYPE_META[item.type];
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => selectItem(item)}
                          disabled={locked}
                          className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                            selectedItem?.id === item.id
                              ? "bg-primary/10 text-primary"
                              : locked
                              ? "opacity-50 cursor-not-allowed hover:bg-transparent"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <meta.Icon className={`h-4 w-4 shrink-0 ${meta.color}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-foreground">{item.title}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{meta.label}</p>
                          </div>
                          {item.is_free_preview && (
                            <span className="shrink-0 rounded-full bg-secondary/20 px-1.5 py-0.5 text-[9px] font-bold text-secondary uppercase">Free</span>
                          )}
                          {locked && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Viewer */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6">
              {selectedItem ? (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{selectedItem.title}</h2>
                    {selectedItem.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{selectedItem.description}</p>
                    )}
                  </div>
                  <ContentViewer item={selectedItem} />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-center">
                  <div className="space-y-2">
                    <Play className="mx-auto h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Select a lesson to begin</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Enrollment CTA if not enrolled */}
        {!isEnrolled && (
          <div className="border-t border-border bg-card p-4 flex items-center justify-between gap-4 shrink-0">
            <div>
              <p className="text-sm font-bold text-foreground">Unlock full access</p>
              <p className="text-xs text-muted-foreground">Enroll to access all content in this course</p>
            </div>
            <Link
              to={`/courses/${courseId}`}
              className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
            >
              Enroll Now
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function FolderItem({
  folder,
  depth,
  isSelected,
  isExpanded,
  onSelect,
}: {
  folder: FolderRow;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
}) {
  const hasSubs = (folder.subFolders?.length ?? 0) > 0;
  return (
    <button
      onClick={onSelect}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
      className={`w-full flex items-center gap-2 rounded-xl py-2 pr-2 text-left transition-colors ${
        isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-foreground"
      }`}
    >
      {depth === 0 && hasSubs
        ? (isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />)
        : <span className="w-3.5 shrink-0" />}
      {isExpanded ? <FolderOpen className="h-3.5 w-3.5 shrink-0" /> : <Folder className="h-3.5 w-3.5 shrink-0" />}
      <span className="text-xs font-medium truncate">{folder.name}</span>
    </button>
  );
}

export default LearnCoursePage;
