import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Folder, FolderOpen, GripVertical, Plus, Pencil, Trash2,
  Radio, FileText, Play, Video, ClipboardList, Loader2,
  ChevronRight, ChevronDown, X, Upload, ExternalLink, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useConfirm } from "@/components/ConfirmDialog";

// ── Types ─────────────────────────────────────────────────────────────────────

type ContentType = "live_class" | "pdf" | "recorded_lecture" | "video" | "test";

type FolderRow = {
  id: string;
  course_id: string;
  parent_id: string | null;
  name: string;
  order: number;
  subFolders?: FolderRow[];
};

type ContentItem = {
  id: string;
  course_id: string;
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
  order: number;
  is_free_preview: boolean;
};

type TestOption = { id: string; title: string; total_questions: number };

// ── Type icons ────────────────────────────────────────────────────────────────

const TYPE_META: Record<ContentType, { label: string; Icon: React.ElementType; color: string }> = {
  live_class:       { label: "Live Class",        Icon: Radio,         color: "text-red-500" },
  pdf:              { label: "PDF",               Icon: FileText,      color: "text-red-400" },
  recorded_lecture: { label: "Recorded Lecture",  Icon: Play,          color: "text-foreground" },
  video:            { label: "Video",             Icon: Video,         color: "text-orange-500" },
  test:             { label: "Test",              Icon: ClipboardList, color: "text-purple-500" },
};

// ── Sortable folder item ──────────────────────────────────────────────────────

function SortableFolder({
  folder,
  depth,
  isSelected,
  isExpanded,
  onSelect,
  onExpand,
  onAddSub,
  onRename,
  onDelete,
}: {
  folder: FolderRow;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onExpand: () => void;
  onAddSub: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: folder.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const hasSubs = (folder.subFolders?.length ?? 0) > 0;

  return (
    <div ref={setNodeRef} style={{ paddingLeft: `${8 + depth * 16}px`, ...style }} className={`flex items-center gap-1 rounded-lg py-1.5 group cursor-pointer ${isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-foreground"}`}>
      <button {...attributes} {...listeners} className="shrink-0 cursor-grab opacity-0 group-hover:opacity-50 hover:!opacity-100">
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      {depth === 0 && hasSubs ? (
        <button onClick={(e) => { e.stopPropagation(); onExpand(); }} className="shrink-0">
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      ) : (
        <span className="shrink-0 w-3.5" />
      )}
      <button onClick={onSelect} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
        {isExpanded ? <FolderOpen className="h-3.5 w-3.5 shrink-0" /> : <Folder className="h-3.5 w-3.5 shrink-0" />}
        <span className="text-xs font-medium truncate">{folder.name}</span>
      </button>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
        {depth === 0 && (
          <button onClick={(e) => { e.stopPropagation(); onAddSub(); }} title="Add sub-folder" className="p-1 rounded hover:bg-primary/10 text-primary">
            <Plus className="h-3 w-3" />
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); onRename(); }} title="Rename" className="p-1 rounded hover:bg-muted">
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete" className="p-1 rounded hover:bg-destructive/10 text-destructive">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ── Sortable content row ──────────────────────────────────────────────────────

function SortableContentRow({
  item,
  onEdit,
  onDelete,
}: { item: ContentItem; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const meta = TYPE_META[item.type];

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 group">
      <button {...attributes} {...listeners} className="shrink-0 cursor-grab text-muted-foreground/50 group-hover:text-muted-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <meta.Icon className={`h-4 w-4 shrink-0 ${meta.color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
        <p className="text-[10px] text-muted-foreground uppercase">{meta.label}{item.is_free_preview ? " · FREE PREVIEW" : ""}</p>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0">
        <button onClick={onEdit} className="rounded-md p-1.5 text-primary hover:bg-primary/10">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={onDelete} className="rounded-md p-1.5 text-destructive hover:bg-destructive/10">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const AdminCourseContentV2Page = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirm();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const [courseName, setCourseName] = useState("");
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);

  // New folder input
  const [addingFolder, setAddingFolder] = useState<{ parentId: string | null } | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [savingFolder, setSavingFolder] = useState(false);

  // Rename
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Right panel
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ContentType>("video");

  // Form fields
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fFileUrl, setFFileUrl] = useState("");
  const [fVideoUrl, setFVideoUrl] = useState("");
  const [fVideoSource, setFVideoSource] = useState<"s3" | "youtube">("youtube");
  const [fZoomLink, setFZoomLink] = useState("");
  const [fScheduledAt, setFScheduledAt] = useState("");
  const [fTestId, setFTestId] = useState("");
  const [fIsFreePreview, setFIsFreePreview] = useState(false);
  const [testOptions, setTestOptions] = useState<TestOption[]>([]);
  const [savingItem, setSavingItem] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Load course name
  useEffect(() => {
    if (!courseId) return;
    supabase.from("courses").select("name").eq("id", courseId).maybeSingle().then(({ data }) => {
      if (data) setCourseName((data as any).name);
    });
  }, [courseId]);

  // Load folders
  const loadFolders = useCallback(async () => {
    if (!courseId) return;
    setLoadingFolders(true);
    const { data } = await supabase
      .from("folders")
      .select("*")
      .eq("course_id", courseId)
      .order("order", { ascending: true });
    const all = (data ?? []) as FolderRow[];
    const level2 = all.filter((f) => f.parent_id === null);
    const withSubs: FolderRow[] = level2.map((f) => ({
      ...f,
      subFolders: all.filter((s) => s.parent_id === f.id).sort((a, b) => a.order - b.order),
    }));
    setFolders(withSubs);
    setLoadingFolders(false);
  }, [courseId]);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  // Load content for selected folder
  useEffect(() => {
    if (!selectedFolderId) { setContentItems([]); return; }
    setLoadingContent(true);
    supabase
      .from("content_items")
      .select("*")
      .eq("folder_id", selectedFolderId)
      .order("order", { ascending: true })
      .then(({ data }) => {
        setContentItems((data ?? []) as ContentItem[]);
        setLoadingContent(false);
      });
  }, [selectedFolderId]);

  // Load tests for dropdown
  useEffect(() => {
    supabase
      .from("tests")
      .select("id, title, total_questions")
      .eq("is_published", true)
      .then(({ data }) => setTestOptions((data ?? []) as TestOption[]));
  }, []);

  // ── Folder CRUD ───────────────────────────────────────────────────────────

  const createFolder = async () => {
    if (!courseId || !newFolderName.trim() || !addingFolder) return;
    setSavingFolder(true);
    const siblingIds = addingFolder.parentId
      ? folders.find((f) => f.id === addingFolder.parentId)?.subFolders?.map((s) => s.id) ?? []
      : folders.map((f) => f.id);
    const { error } = await supabase.from("folders").insert({
      course_id: courseId,
      parent_id: addingFolder.parentId,
      name: newFolderName.trim(),
      order: siblingIds.length,
    });
    setSavingFolder(false);
    if (error) return toast.error(error.message);
    setNewFolderName("");
    setAddingFolder(null);
    loadFolders();
  };

  const renameFolder = async (id: string) => {
    if (!renameValue.trim()) return;
    const { error } = await supabase.from("folders").update({ name: renameValue.trim() }).eq("id", id);
    if (error) return toast.error(error.message);
    setRenamingId(null);
    loadFolders();
  };

  const deleteFolder = async (folder: FolderRow) => {
    const hasChildren =
      (folder.subFolders?.length ?? 0) > 0 ||
      contentItems.some((c) => c.folder_id === folder.id);
    const confirmed = await confirm({
      title: `Delete "${folder.name}"?`,
      description: hasChildren
        ? "This will delete all sub-folders and content inside. This cannot be undone."
        : "This folder will be permanently deleted.",
      confirmLabel: "Delete",
    });
    if (!confirmed) return;
    const { error } = await supabase.from("folders").delete().eq("id", folder.id);
    if (error) return toast.error(error.message);
    if (selectedFolderId === folder.id) setSelectedFolderId(null);
    loadFolders();
    toast.success("Folder deleted");
  };

  // ── Folder DnD reorder ────────────────────────────────────────────────────

  const handleFolderDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // Check if both are top-level or both sub-folders of same parent
    const topIds = folders.map((f) => f.id);
    if (topIds.includes(activeId) && topIds.includes(overId)) {
      const oldIdx = topIds.indexOf(activeId);
      const newIdx = topIds.indexOf(overId);
      const reordered = arrayMove(folders, oldIdx, newIdx);
      setFolders(reordered);
      await Promise.all(reordered.map((f, i) => supabase.from("folders").update({ order: i }).eq("id", f.id)));
      return;
    }

    // Sub-folder reorder
    for (const parent of folders) {
      const subIds = (parent.subFolders ?? []).map((s) => s.id);
      if (subIds.includes(activeId) && subIds.includes(overId)) {
        const oldIdx = subIds.indexOf(activeId);
        const newIdx = subIds.indexOf(overId);
        const reordered = arrayMove(parent.subFolders!, oldIdx, newIdx);
        setFolders(folders.map((f) => f.id === parent.id ? { ...f, subFolders: reordered } : f));
        await Promise.all(reordered.map((s, i) => supabase.from("folders").update({ order: i }).eq("id", s.id)));
        return;
      }
    }
  };

  // ── Content DnD reorder ───────────────────────────────────────────────────

  const handleContentDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIdx = contentItems.findIndex((c) => c.id === String(active.id));
    const newIdx = contentItems.findIndex((c) => c.id === String(over.id));
    const reordered = arrayMove(contentItems, oldIdx, newIdx);
    setContentItems(reordered);
    await Promise.all(reordered.map((c, i) => supabase.from("content_items").update({ order: i }).eq("id", c.id)));
  };

  // ── Content CRUD ──────────────────────────────────────────────────────────

  const openAddPanel = () => {
    setEditingItem(null);
    setSelectedType("video");
    resetForm();
    setPanelOpen(true);
  };

  const openEditPanel = (item: ContentItem) => {
    setEditingItem(item);
    setSelectedType(item.type);
    setFTitle(item.title);
    setFDesc(item.description ?? "");
    setFFileUrl(item.file_url ?? "");
    setFVideoUrl(item.video_url ?? "");
    setFVideoSource(item.video_source ?? "youtube");
    setFZoomLink(item.zoom_link ?? "");
    setFScheduledAt(item.scheduled_at ? item.scheduled_at.slice(0, 16) : "");
    setFTestId(item.test_id ?? "");
    setFIsFreePreview(item.is_free_preview);
    setPanelOpen(true);
  };

  const resetForm = () => {
    setFTitle(""); setFDesc(""); setFFileUrl(""); setFVideoUrl("");
    setFVideoSource("youtube"); setFZoomLink(""); setFScheduledAt("");
    setFTestId(""); setFIsFreePreview(false); setUploadProgress(null);
  };

  const handleS3Upload = async (file: File, setUrl: (u: string) => void) => {
    setUploadProgress(0);
    try {
      // Get presigned URL from edge function
      const { data: presign, error: pErr } = await supabase.functions.invoke("get-upload-url", {
        body: { fileName: file.name, fileType: file.type },
      });
      if (pErr || !presign?.uploadUrl) throw new Error(pErr?.message ?? "Failed to get upload URL");

      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };
      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error("Upload failed")));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.open("PUT", presign.uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      setUrl(presign.fileUrl);
      setUploadProgress(null);
      toast.success("File uploaded");
    } catch (e: any) {
      setUploadProgress(null);
      toast.error(e.message ?? "Upload failed");
    }
  };

  const saveContentItem = async () => {
    if (!selectedFolderId || !courseId) return toast.error("Select a folder first");
    if (!fTitle.trim()) return toast.error("Title is required");

    setSavingItem(true);
    const payload: Record<string, any> = {
      course_id: courseId,
      folder_id: selectedFolderId,
      type: selectedType,
      title: fTitle.trim(),
      description: fDesc || null,
      file_url: fFileUrl || null,
      video_url: fVideoUrl || null,
      video_source: (selectedType === "video" || selectedType === "recorded_lecture") ? fVideoSource : null,
      zoom_link: fZoomLink || null,
      scheduled_at: fScheduledAt ? new Date(fScheduledAt).toISOString() : null,
      test_id: fTestId || null,
      is_free_preview: fIsFreePreview,
    };

    let error;
    if (editingItem) {
      ({ error } = await supabase.from("content_items").update(payload).eq("id", editingItem.id));
    } else {
      payload.order = contentItems.length;
      ({ error } = await supabase.from("content_items").insert(payload));
    }

    setSavingItem(false);
    if (error) return toast.error(error.message);
    toast.success(editingItem ? "Updated" : "Added");
    setPanelOpen(false);
    // Reload content
    const { data } = await supabase
      .from("content_items")
      .select("*")
      .eq("folder_id", selectedFolderId)
      .order("order", { ascending: true });
    setContentItems((data ?? []) as ContentItem[]);
  };

  const deleteContentItem = async (item: ContentItem) => {
    const ok = await confirm({ title: `Delete "${item.title}"?`, description: "This cannot be undone.", confirmLabel: "Delete" });
    if (!ok) return;
    await supabase.from("content_items").delete().eq("id", item.id);
    setContentItems((prev) => prev.filter((c) => c.id !== item.id));
    toast.success("Deleted");
  };

  // ── Selected folder metadata ──────────────────────────────────────────────

  const selectedFolder = (() => {
    for (const f of folders) {
      if (f.id === selectedFolderId) return f;
      for (const s of f.subFolders ?? []) {
        if (s.id === selectedFolderId) return s;
      }
    }
    return null;
  })();

  const allFolderIds = [
    ...folders.map((f) => f.id),
    ...folders.flatMap((f) => (f.subFolders ?? []).map((s) => s.id)),
  ];

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      {ConfirmDialog}

      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex items-center gap-3 bg-card shrink-0">
        <button onClick={() => navigate("/admin/courses")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Course Content</p>
          <h1 className="text-sm font-bold text-foreground">{courseName || "Loading…"}</h1>
        </div>
      </div>

      {/* Three-panel body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Folder Tree ──────────────────────────────────────────── */}
        <aside className="w-64 shrink-0 border-r border-border bg-card flex flex-col overflow-hidden">
          <div className="px-3 pt-3 pb-2 border-b border-border shrink-0 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">Folders</p>
            {addingFolder?.parentId === null ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") setAddingFolder(null); }}
                  placeholder="Folder name"
                  className="flex-1 text-xs rounded border border-border bg-background px-2 py-1 outline-none focus:border-primary"
                />
                <button onClick={createFolder} disabled={savingFolder} className="text-primary text-xs font-semibold">
                  {savingFolder ? "…" : "Add"}
                </button>
                <button onClick={() => setAddingFolder(null)}><X className="h-3 w-3 text-muted-foreground" /></button>
              </div>
            ) : (
              <button
                onClick={() => { setAddingFolder({ parentId: null }); setNewFolderName(""); }}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary w-full"
              >
                <Plus className="h-3.5 w-3.5" /> Add Folder
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-1">
            {loadingFolders ? (
              <div className="flex h-20 items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFolderDragEnd}>
                <SortableContext items={allFolderIds} strategy={verticalListSortingStrategy}>
                  {folders.map((folder) => (
                    <div key={folder.id}>
                      {renamingId === folder.id ? (
                        <div className="flex items-center gap-1 px-2 py-1">
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") renameFolder(folder.id); if (e.key === "Escape") setRenamingId(null); }}
                            className="flex-1 text-xs rounded border border-border bg-background px-2 py-1 outline-none focus:border-primary"
                          />
                          <button onClick={() => renameFolder(folder.id)} className="text-primary text-xs font-semibold">OK</button>
                        </div>
                      ) : (
                        <SortableFolder
                          folder={folder}
                          depth={0}
                          isSelected={selectedFolderId === folder.id}
                          isExpanded={expandedFolderIds.has(folder.id)}
                          onSelect={() => setSelectedFolderId(folder.id)}
                          onExpand={() => setExpandedFolderIds((prev) => {
                            const n = new Set(prev);
                            n.has(folder.id) ? n.delete(folder.id) : n.add(folder.id);
                            return n;
                          })}
                          onAddSub={() => { setAddingFolder({ parentId: folder.id }); setNewFolderName(""); setExpandedFolderIds((p) => new Set([...p, folder.id])); }}
                          onRename={() => { setRenamingId(folder.id); setRenameValue(folder.name); }}
                          onDelete={() => deleteFolder(folder)}
                        />
                      )}
                      {/* Sub-folders */}
                      {expandedFolderIds.has(folder.id) && (
                        <div>
                          {(folder.subFolders ?? []).map((sub) => (
                            <div key={sub.id}>
                              {renamingId === sub.id ? (
                                <div className="flex items-center gap-1 px-2 py-1 pl-8">
                                  <input
                                    autoFocus
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") renameFolder(sub.id); if (e.key === "Escape") setRenamingId(null); }}
                                    className="flex-1 text-xs rounded border border-border bg-background px-2 py-1 outline-none focus:border-primary"
                                  />
                                  <button onClick={() => renameFolder(sub.id)} className="text-primary text-xs font-semibold">OK</button>
                                </div>
                              ) : (
                                <SortableFolder
                                  folder={sub}
                                  depth={1}
                                  isSelected={selectedFolderId === sub.id}
                                  isExpanded={false}
                                  onSelect={() => setSelectedFolderId(sub.id)}
                                  onExpand={() => {}}
                                  onAddSub={() => {}}
                                  onRename={() => { setRenamingId(sub.id); setRenameValue(sub.name); }}
                                  onDelete={() => deleteFolder(sub)}
                                />
                              )}
                            </div>
                          ))}
                          {/* Inline: add sub-folder */}
                          {addingFolder?.parentId === folder.id && (
                            <div className="flex items-center gap-1 px-2 py-1 pl-8">
                              <input
                                autoFocus
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") setAddingFolder(null); }}
                                placeholder="Sub-folder name"
                                className="flex-1 text-xs rounded border border-border bg-background px-2 py-1 outline-none focus:border-primary"
                              />
                              <button onClick={createFolder} disabled={savingFolder} className="text-primary text-xs font-semibold">
                                {savingFolder ? "…" : "Add"}
                              </button>
                              <button onClick={() => setAddingFolder(null)}><X className="h-3 w-3 text-muted-foreground" /></button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>

        </aside>

        {/* ── Center: Content List ───────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
          <div className="border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0">
            <p className="text-sm font-semibold text-foreground">
              {selectedFolder ? selectedFolder.name : "Select a folder"}
            </p>
            {selectedFolderId && (
              <button
                onClick={openAddPanel}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Add Content
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {!selectedFolderId ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">Select a folder to view its content</p>
              </div>
            ) : loadingContent ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : contentItems.length === 0 ? (
              <div className="flex flex-col h-full items-center justify-center gap-3">
                <p className="text-sm text-muted-foreground">No content yet</p>
                <button onClick={openAddPanel} className="flex items-center gap-1.5 rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary">
                  <Plus className="h-3.5 w-3.5" /> Add Content
                </button>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleContentDragEnd}>
                <SortableContext items={contentItems.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  {contentItems.map((item) => (
                    <SortableContentRow
                      key={item.id}
                      item={item}
                      onEdit={() => openEditPanel(item)}
                      onDelete={() => deleteContentItem(item)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* ── Right: Add / Edit Panel ────────────────────────────────────── */}
        {panelOpen ? (
          <div className="w-80 shrink-0 flex flex-col overflow-hidden bg-card">
            <div className="border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0">
              <p className="text-sm font-semibold text-foreground">{editingItem ? "Edit Content" : "Add Content"}</p>
              <button onClick={() => setPanelOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Type selector */}
              {!editingItem && (
                <div className="grid grid-cols-5 gap-1.5">
                  {(Object.entries(TYPE_META) as [ContentType, (typeof TYPE_META)[ContentType]][]).map(([type, meta]) => (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-colors ${
                        selectedType === type ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                      }`}
                    >
                      <meta.Icon className={`h-4 w-4 ${meta.color}`} />
                      <span className="text-[9px] font-medium text-foreground leading-tight">{meta.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Common: title */}
              <PanelField label="Title">
                <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} className={panelInput} placeholder="Content title" />
              </PanelField>

              {/* Type-specific fields */}
              {selectedType === "live_class" && (
                <>
                  <PanelField label="Zoom Link">
                    <input value={fZoomLink} onChange={(e) => setFZoomLink(e.target.value)} className={panelInput} placeholder="https://zoom.us/j/..." />
                  </PanelField>
                  <PanelField label="Scheduled At">
                    <input type="datetime-local" value={fScheduledAt} onChange={(e) => setFScheduledAt(e.target.value)} className={panelInput} />
                  </PanelField>
                </>
              )}

              {selectedType === "pdf" && (
                <PanelField label="PDF File">
                  <UploadOrUrl value={fFileUrl} onChange={setFFileUrl} accept=".pdf" progress={uploadProgress} onUpload={(f) => handleS3Upload(f, setFFileUrl)} />
                </PanelField>
              )}

              {selectedType === "recorded_lecture" && (
                <PanelField label="Video File (S3)">
                  <UploadOrUrl value={fFileUrl} onChange={setFFileUrl} accept="video/*" progress={uploadProgress} onUpload={(f) => handleS3Upload(f, setFFileUrl)} />
                </PanelField>
              )}

              {selectedType === "video" && (
                <>
                  <PanelField label="Source">
                    <div className="flex gap-2">
                      {(["youtube", "s3"] as const).map((src) => (
                        <button key={src} onClick={() => setFVideoSource(src)}
                          className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors ${fVideoSource === src ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/30"}`}>
                          {src === "youtube" ? "YouTube" : "S3"}
                        </button>
                      ))}
                    </div>
                  </PanelField>
                  {fVideoSource === "youtube" ? (
                    <PanelField label="YouTube URL">
                      <input value={fVideoUrl} onChange={(e) => setFVideoUrl(e.target.value)} className={panelInput} placeholder="https://youtube.com/watch?v=..." />
                      {fVideoUrl && fVideoUrl.includes("youtube") && (
                        <a href={fVideoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 mt-1 text-[10px] text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" /> Preview
                        </a>
                      )}
                    </PanelField>
                  ) : (
                    <PanelField label="Video File (S3)">
                      <UploadOrUrl value={fVideoUrl} onChange={setFVideoUrl} accept="video/*" progress={uploadProgress} onUpload={(f) => handleS3Upload(f, setFVideoUrl)} />
                    </PanelField>
                  )}
                </>
              )}

              {selectedType === "test" && (
                <PanelField label="Test">
                  <select value={fTestId} onChange={(e) => setFTestId(e.target.value)} className={panelInput}>
                    <option value="">— Select test —</option>
                    {testOptions.map((t) => (
                      <option key={t.id} value={t.id}>{t.title} ({t.total_questions}q)</option>
                    ))}
                  </select>
                </PanelField>
              )}

              <div className="flex items-center gap-2">
                <input id="freePreview" type="checkbox" checked={fIsFreePreview} onChange={(e) => setFIsFreePreview(e.target.checked)} className="accent-primary h-4 w-4" />
                <label htmlFor="freePreview" className="text-xs font-medium text-foreground cursor-pointer">Free preview (visible without enrollment)</label>
              </div>
            </div>

            <div className="border-t border-border p-3 shrink-0">
              <button
                onClick={saveContentItem}
                disabled={savingItem}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : editingItem ? "Save Changes" : "Add Content"}
              </button>
            </div>
          </div>
        ) : (
          <div className="w-80 shrink-0 flex items-center justify-center bg-muted/20">
            <p className="text-sm text-muted-foreground">Select a folder and click "+ Add Content"</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Small helpers ─────────────────────────────────────────────────────────────

const panelInput =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground";

function PanelField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function UploadOrUrl({
  value,
  onChange,
  accept,
  progress,
  onUpload,
}: {
  value: string;
  onChange: (v: string) => void;
  accept: string;
  progress: number | null;
  onUpload: (f: File) => void;
}) {
  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <span className="flex-1 text-xs text-foreground truncate">{value}</span>
          <button onClick={() => onChange("")} className="text-muted-foreground hover:text-destructive shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label className="block cursor-pointer">
          <input type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
          <div className="rounded-lg border-2 border-dashed border-border bg-background p-4 flex flex-col items-center gap-1 hover:border-primary transition-colors">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Click to upload</p>
          </div>
        </label>
      )}
      {progress !== null && (
        <div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{progress}%</p>
        </div>
      )}
    </div>
  );
}

export default AdminCourseContentV2Page;
