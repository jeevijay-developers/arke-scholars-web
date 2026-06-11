import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ChevronDown, ChevronRight, ChevronLeft, FolderOpen,
  Radio, FileText, Play, Video, ClipboardList,
  ExternalLink, Loader2, BookOpen, Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import SEO from "@/components/SEO";

import folderIcon from "@/assets/SVGs/folder-blank.svg";
import videoIcon from "@/assets/SVGs/video.svg";
import pdfIcon from "@/assets/SVGs/pdf-document.svg";
import liveClassIcon from "@/assets/SVGs/live-class.svg";
import examIcon from "@/assets/SVGs/exam.svg";

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

// ── Icon / label maps ─────────────────────────────────────────────────────────

const TYPE_META: Record<ContentType, { label: string; Icon: React.ElementType; color: string; svgIcon: string }> = {
  live_class:       { label: "Live Class",  Icon: Radio,         color: "text-red-500",    svgIcon: liveClassIcon },
  pdf:              { label: "PDF",         Icon: FileText,      color: "text-red-400",    svgIcon: pdfIcon },
  recorded_lecture: { label: "Recorded",    Icon: Play,          color: "text-foreground", svgIcon: videoIcon },
  video:            { label: "Video",       Icon: Video,         color: "text-orange-500", svgIcon: videoIcon },
  test:             { label: "Test",        Icon: ClipboardList, color: "text-purple-500", svgIcon: examIcon },
};

// ── YouTube embed helper ──────────────────────────────────────────────────────

function youtubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

const S3_HOST      = "https://s3.ap-tokyo.megas4.com";
const S3_READ_BASE = "https://s3.ap-tokyo.megas4.com/biijszzsfufvateaffbvtjapmculhceod7agr";

function resolveS3Url(raw: string): string {
  if (!raw) return raw;
  if (raw.startsWith(S3_READ_BASE)) return raw;
  if (raw.startsWith(S3_HOST + "/")) {
    const path = raw.slice(S3_HOST.length + 1);
    return `${S3_READ_BASE}/${path}`;
  }
  if (raw.startsWith("http")) return raw;
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

// ── Mobile grid tiles ─────────────────────────────────────────────────────────

function FolderTile({ folder, onClick }: { folder: FolderRow; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-3 rounded-2xl active:bg-muted/70 hover:bg-muted/40 transition-colors text-center"
    >
      <div className="w-16 h-16 flex items-center justify-center">
        <img src={folderIcon} alt="folder" className="w-14 h-14 object-contain" />
      </div>
      <span className="text-xs font-medium text-foreground line-clamp-2 leading-tight w-full">{folder.name}</span>
    </button>
  );
}

function ContentTile({
  item,
  isSelected,
  isEnrolled,
  onClick,
}: {
  item: ContentItem;
  isSelected: boolean;
  isEnrolled: boolean;
  onClick: () => void;
}) {
  const locked = !isEnrolled && !item.is_free_preview;
  const meta = TYPE_META[item.type];

  return (
    <button
      onClick={onClick}
      disabled={locked}
      className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl transition-colors text-center ${
        isSelected
          ? "bg-primary/10"
          : locked
          ? "opacity-50 cursor-not-allowed"
          : "active:bg-muted/70 hover:bg-muted/40"
      }`}
    >
      <div className="w-16 h-16 flex items-center justify-center">
        <img src={meta.svgIcon} alt={meta.label} className="w-12 h-12 object-contain" />
      </div>
      <span className="text-xs font-medium text-foreground line-clamp-2 leading-tight w-full">{item.title}</span>
      <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{meta.label}</span>
      {item.is_free_preview && (
        <span className="absolute top-1 right-1 text-[8px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
          FREE
        </span>
      )}
      {locked && <Lock className="absolute top-2 right-2 h-3 w-3 text-muted-foreground" />}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const LearnCoursePage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);

  // Shared content state
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);

  // Mobile drill-down navigation
  const [mobileFolder, setMobileFolder] = useState<FolderRow | null>(null);     // opened top-level
  const [mobileSubfolder, setMobileSubfolder] = useState<FolderRow | null>(null); // opened subfolder

  // Desktop sidebar state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [desktopContentItems, setDesktopContentItems] = useState<ContentItem[]>([]);

  const contentRef = useRef<HTMLDivElement>(null);

  // Load course + enrollment + folders
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
      const level0 = all.filter((f) => f.parent_id === null);
      const withSubs: FolderRow[] = level0.map((f) => ({
        ...f,
        subFolders: all.filter((s) => s.parent_id === f.id).sort((a, b) => a.order - b.order),
      }));
      setFolders(withSubs);
      setLoading(false);
    };
    init();
  }, [courseId, user]);

  const fetchContent = useCallback(async (folderId: string) => {
    const { data } = await supabase
      .from("content_items")
      .select("*")
      .eq("folder_id", folderId)
      .order("order", { ascending: true });
    return (data ?? []) as ContentItem[];
  }, []);

  // Mobile: open a top-level folder — always load its own content too
  const mobileOpenFolder = async (folder: FolderRow) => {
    setMobileFolder(folder);
    setMobileSubfolder(null);
    setSelectedItem(null);
    setLoadingContent(true);
    const items = await fetchContent(folder.id);
    setContentItems(items);
    setLoadingContent(false);
  };

  // Mobile: open a subfolder
  const mobileOpenSubfolder = async (subfolder: FolderRow) => {
    setMobileSubfolder(subfolder);
    setSelectedItem(null);
    setLoadingContent(true);
    const items = await fetchContent(subfolder.id);
    setContentItems(items);
    setLoadingContent(false);
  };

  // Mobile: back navigation
  const mobileGoBack = async () => {
    if (selectedItem) {
      setSelectedItem(null);
    } else if (mobileSubfolder) {
      setMobileSubfolder(null);
      // Restore the parent folder's own content items
      setLoadingContent(true);
      const items = await fetchContent(mobileFolder!.id);
      setContentItems(items);
      setLoadingContent(false);
    } else if (mobileFolder) {
      setMobileFolder(null);
      setContentItems([]);
    }
  };

  // Mobile: select a content item
  const mobileSelectItem = (item: ContentItem) => {
    if (!isEnrolled && !item.is_free_preview) return;
    setSelectedItem(item);
    contentRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Desktop: folder select (existing behaviour)
  const desktopSelectFolder = useCallback(
    async (folder: FolderRow, depth: number) => {
      const hasSubs = (folder.subFolders?.length ?? 0) > 0;
      if (depth === 0 && hasSubs) {
        setExpandedIds((prev) => {
          const n = new Set(prev);
          n.has(folder.id) ? n.delete(folder.id) : n.add(folder.id);
          return n;
        });
      }
      setSelectedFolderId(folder.id);
      setSelectedItem(null);
      const items = await fetchContent(folder.id);
      setDesktopContentItems(items);
    },
    [fetchContent]
  );

  const desktopSelectItem = (item: ContentItem) => {
    if (!isEnrolled && !item.is_free_preview) return;
    setSelectedItem(item);
    if (window.innerWidth < 1024) contentRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  // ── Mobile header label ─────────────────────────────────────────────────────
  const mobileHeaderTitle = selectedItem?.title ?? mobileSubfolder?.name ?? mobileFolder?.name ?? course?.name ?? "";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-hidden lg:flex-row">
      {course && <SEO title={`${course.name} — Learn`} description={`Learning ${course.name}`} />}

      {/* ════════════════════════════════════════════════════════════════
          MOBILE LAYOUT  (hidden on lg+)
      ════════════════════════════════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col h-full overflow-hidden bg-background">
        {/* Mobile header */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-border bg-card">
          <button
            onClick={mobileFolder ? mobileGoBack : () => navigate("/my-courses")}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted active:bg-muted/70 transition-colors shrink-0"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            {!mobileFolder && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                {course?.target} · Class {course?.class}
              </p>
            )}
            <h1 className="text-sm font-bold text-foreground truncate">{mobileHeaderTitle}</h1>
          </div>
        </div>

        {/* Breadcrumb strip */}
        {(mobileFolder || mobileSubfolder) && (
          <div className="shrink-0 flex items-center gap-1 px-4 py-1.5 text-[10px] text-muted-foreground bg-muted/30 border-b border-border overflow-x-auto whitespace-nowrap">
            <button onClick={() => { setMobileFolder(null); setMobileSubfolder(null); setSelectedItem(null); setContentItems([]); }}
              className="hover:text-foreground transition-colors shrink-0">
              Home
            </button>
            {mobileFolder && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <button
                  onClick={async () => {
                    setMobileSubfolder(null);
                    setSelectedItem(null);
                    if (mobileSubfolder) {
                      setLoadingContent(true);
                      const items = await fetchContent(mobileFolder!.id);
                      setContentItems(items);
                      setLoadingContent(false);
                    }
                  }}
                  className="hover:text-foreground transition-colors shrink-0"
                >
                  {mobileFolder.name}
                </button>
              </>
            )}
            {mobileSubfolder && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <span className="text-foreground font-medium shrink-0">{mobileSubfolder.name}</span>
              </>
            )}
            {selectedItem && !mobileSubfolder && !mobileFolder?.subFolders?.length && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <span className="text-foreground font-medium shrink-0">{selectedItem.title}</span>
              </>
            )}
          </div>
        )}

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto" ref={contentRef}>
          {/* ── Content viewer ── */}
          {selectedItem ? (
            <div className="p-4 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">{selectedItem.title}</h2>
                {selectedItem.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{selectedItem.description}</p>
                )}
              </div>
              <ContentViewer item={selectedItem} />
            </div>
          ) : loadingContent ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !mobileFolder ? (
            /* ── Root: 2-col folder grid ── */
            folders.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
                <FolderOpen className="h-12 w-12 opacity-40" />
                <p className="text-sm font-medium">No content yet</p>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-2 gap-2">
                {folders.map((folder) => (
                  <FolderTile key={folder.id} folder={folder} onClick={() => mobileOpenFolder(folder)} />
                ))}
              </div>
            )
          ) : !mobileSubfolder ? (
            /* ── Inside a top-level folder: subfolders + its own content items ── */
            (mobileFolder.subFolders?.length ?? 0) === 0 && contentItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
                <FolderOpen className="h-10 w-10 opacity-40" />
                <p className="text-sm">No content in this folder</p>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-2 gap-2">
                {(mobileFolder.subFolders ?? []).map((sub) => (
                  <FolderTile key={sub.id} folder={sub} onClick={() => mobileOpenSubfolder(sub)} />
                ))}
                {contentItems.map((item) => (
                  <ContentTile
                    key={item.id}
                    item={item}
                    isSelected={selectedItem?.id === item.id}
                    isEnrolled={isEnrolled}
                    onClick={() => mobileSelectItem(item)}
                  />
                ))}
              </div>
            )
          ) : contentItems.length === 0 ? (
            /* ── Empty subfolder ── */
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
              <FolderOpen className="h-10 w-10 opacity-40" />
              <p className="text-sm">No content in this folder</p>
            </div>
          ) : (
            /* ── Subfolder content items grid ── */
            <div className="p-4 grid grid-cols-2 gap-2">
              {contentItems.map((item) => (
                <ContentTile
                  key={item.id}
                  item={item}
                  isSelected={selectedItem?.id === item.id}
                  isEnrolled={isEnrolled}
                  onClick={() => mobileSelectItem(item)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Enrollment CTA */}
        {!isEnrolled && (
          <div className="shrink-0 border-t border-border bg-card p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-foreground">Unlock full access</p>
              <p className="text-xs text-muted-foreground">Enroll to access all content</p>
            </div>
            <Link
              to={`/courses/${courseId}`}
              className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
            >
              Enroll Now
            </Link>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          DESKTOP LAYOUT  (hidden on mobile)
      ════════════════════════════════════════════════════════════════ */}
      <>
        {/* Left sidebar */}
        <aside className="hidden lg:flex lg:flex-col w-72 shrink-0 overflow-y-auto border-r border-border bg-card h-full">
          <div className="border-b border-border p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {course?.target} · Class {course?.class}
            </p>
            <h1 className="mt-0.5 text-sm font-bold text-foreground line-clamp-2">{course?.name}</h1>
          </div>
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
                    onSelect={() => desktopSelectFolder(folder, 0)}
                  />
                  {expandedIds.has(folder.id) &&
                    (folder.subFolders ?? []).map((sub) => (
                      <FolderItem
                        key={sub.id}
                        folder={sub}
                        depth={1}
                        isSelected={selectedFolderId === sub.id}
                        isExpanded={false}
                        onSelect={() => desktopSelectFolder(sub, 1)}
                      />
                    ))}
                </div>
              ))
            )}
          </nav>
        </aside>

        {/* Main content */}
        <main className="hidden lg:flex flex-1 flex-col overflow-hidden" ref={contentRef}>
          {!selectedFolderId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">Select a folder from the left to view content</p>
            </div>
          ) : (
            <div className="flex flex-1 overflow-hidden">
              {/* Desktop content list with SVG icons in a grid */}
              <div className="w-80 shrink-0 overflow-y-auto border-r border-border">
                {desktopContentItems.length === 0 ? (
                  <div className="flex h-32 items-center justify-center">
                    <p className="text-xs text-muted-foreground">No content in this folder</p>
                  </div>
                ) : (
                  <div className="p-3 grid grid-cols-2 gap-2">
                    {desktopContentItems.map((item) => {
                      const locked = !isEnrolled && !item.is_free_preview;
                      const meta = TYPE_META[item.type];
                      return (
                        <button
                          key={item.id}
                          onClick={() => desktopSelectItem(item)}
                          disabled={locked}
                          className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors text-center ${
                            selectedItem?.id === item.id
                              ? "bg-primary/10"
                              : locked
                              ? "opacity-50 cursor-not-allowed"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <img src={meta.svgIcon} alt={meta.label} className="w-10 h-10 object-contain" />
                          <span className="text-xs font-medium text-foreground line-clamp-2 leading-tight">{item.title}</span>
                          <span className="text-[9px] text-muted-foreground uppercase">{meta.label}</span>
                          {item.is_free_preview && (
                            <span className="absolute top-1 right-1 text-[8px] font-bold bg-green-100 text-green-700 px-1 py-0.5 rounded-full">
                              FREE
                            </span>
                          )}
                          {locked && <Lock className="absolute top-1.5 right-1.5 h-3 w-3 text-muted-foreground" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Desktop viewer */}
              <div className="flex-1 overflow-y-auto p-6">
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
      </>
    </div>
  );
};

// ── Desktop folder sidebar item ───────────────────────────────────────────────

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
        ? isExpanded
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        : <span className="w-3.5 shrink-0" />}
      <img
        src={folderIcon}
        alt="folder"
        className="h-4 w-4 shrink-0 object-contain"
      />
      <span className="text-xs font-medium truncate">{folder.name}</span>
    </button>
  );
}

export default LearnCoursePage;
