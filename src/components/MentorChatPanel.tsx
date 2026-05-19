import { useEffect, useRef, useState } from "react";
import { Paperclip, Send, Users, MessageCircle, X, Check, CheckCheck, FileText, Download } from "lucide-react";
import { Conversation, useMentorMessages, MentorMessage, isImageMime, getChatFileUrl } from "@/hooks/useMentorChat";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  conversations: Conversation[];
  loading?: boolean;
  emptyHint?: string;
  onActivity?: () => void;
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatBytes = (bytes?: number | null) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Renders a single attachment (image thumbnail or file card), refreshing signed URLs on demand. */
const Attachment = ({ message, mine }: { message: MentorMessage; mine: boolean }) => {
  const initialUrl = message.file_url || message.image_url;
  const [url, setUrl] = useState<string | null>(initialUrl);
  const mime = message.file_mime || (message.image_url ? "image/*" : null);
  const isImage = isImageMime(mime) || (!!message.image_url && !message.file_mime);

  // Refresh signed URL on mount if we have a path (signed URLs may expire).
  useEffect(() => {
    let cancelled = false;
    if (message.file_path) {
      getChatFileUrl(message.file_path).then((u) => {
        if (!cancelled && u) setUrl(u);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [message.file_path]);

  const handleOpen = async () => {
    let target = url;
    if (message.file_path) {
      const fresh = await getChatFileUrl(message.file_path);
      if (fresh) target = fresh;
    }
    if (target) window.open(target, "_blank", "noopener,noreferrer");
  };

  if (isImage) {
    return (
      <button type="button" onClick={handleOpen} className="block">
        {url ? (
          <img
            src={url}
            alt={message.file_name || "attachment"}
            className="mb-1 max-h-64 cursor-zoom-in rounded-lg object-cover"
            loading="lazy"
            onError={async () => {
              if (message.file_path) {
                const fresh = await getChatFileUrl(message.file_path);
                if (fresh) setUrl(fresh);
              }
            }}
          />
        ) : (
          <div className="mb-1 flex h-32 w-48 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
            Loading image…
          </div>
        )}
      </button>
    );
  }

  // Non-image attachment: file card
  return (
    <button
      type="button"
      onClick={handleOpen}
      className={`mb-1 flex w-full max-w-[260px] items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
        mine
          ? "border-primary-foreground/30 bg-primary-foreground/10 hover:bg-primary-foreground/15"
          : "border-border bg-muted/40 hover:bg-muted/60"
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
          mine ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/15 text-primary"
        }`}
      >
        <FileText className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-xs font-semibold ${mine ? "text-primary-foreground" : "text-foreground"}`}>
          {message.file_name || "Attachment"}
        </p>
        <p className={`truncate text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {formatBytes(message.file_size_bytes)}
          {mime ? ` · ${mime.split("/")[1]?.toUpperCase() || mime}` : ""}
        </p>
      </div>
      <Download className={`h-4 w-4 shrink-0 ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`} />
    </button>
  );
};

const MentorChatPanel = ({ conversations, loading, emptyHint, onActivity }: Props) => {
  const { user } = useAuth();
  const [active, setActive] = useState<Conversation | null>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, loading: msgsLoading, sending, send, typingUsers, sendTyping } = useMentorMessages(
    active,
    onActivity,
  );

  // Build/cleanup an object URL preview only for image attachments
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setFilePreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Keep active selection in sync with refreshed conversations (preserves unread updates)
  // Only swap when the id actually changes — otherwise we'd thrash the messages effect
  // every time the parent refreshes, causing a re-fetch loop.
  useEffect(() => {
    if (!active && conversations[0]) {
      setActive(conversations[0]);
      return;
    }
    if (active && !conversations.some((c) => c.id === active.id) && conversations[0]) {
      setActive(conversations[0]);
    }
  }, [conversations, active]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, typingUsers.length]);

  const handlePickFile = (f: File | null) => {
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast.error("File too large. Maximum size is 20MB.");
      return;
    }
    setFile(f);
  };

  const handleSend = async () => {
    if (!text.trim() && !file) return;
    try {
      await send({ text, file });
      setText("");
      setFile(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send message");
    }
  };

  const typingLabel = (() => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0].name} is typing…`;
    if (typingUsers.length === 2) return `${typingUsers[0].name} and ${typingUsers[1].name} are typing…`;
    return `${typingUsers.length} people are typing…`;
  })();

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[280px_1fr]">
      {/* Conversation list */}
      <aside className="flex flex-col border-r border-border bg-muted/20">
        <div className="border-b border-border p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Conversations</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-xs text-muted-foreground">Loading…</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">{emptyHint ?? "No conversations yet."}</div>
          ) : (
            conversations.map((c) => {
              const isActive = active?.id === c.id;
              const Icon = c.kind === "group" ? Users : MessageCircle;
              const unread = c.unread ?? 0;
              return (
                <button
                  key={c.id}
                  onClick={() => setActive(c)}
                  className={`flex w-full items-center gap-3 border-b border-border/40 px-3 py-3 text-left transition-colors ${
                    isActive ? "bg-secondary/15" : "hover:bg-muted/40"
                  }`}
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full ${c.kind === "group" ? "bg-primary/15 text-primary" : "bg-secondary/15 text-secondary"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm ${unread > 0 && !isActive ? "font-bold text-foreground" : "font-semibold text-foreground"}`}>
                      {c.title}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">{c.subtitle}</p>
                  </div>
                  {unread > 0 && !isActive && (
                    <span className="ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Active thread */}
      <section className="flex min-w-0 flex-col">
        {active ? (
          <>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{active.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {typingLabel ?? active.subtitle}
                </p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-background/40 p-4">
              {msgsLoading ? (
                <p className="text-center text-xs text-muted-foreground">Loading messages…</p>
              ) : messages.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground">No messages yet — say hello 👋</p>
              ) : (
                messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  const isDirect = m.conversation_type === "direct";
                  const hasAttachment = !!(m.file_url || m.image_url || m.file_path);
                  const isGroup = active.kind === "group";
                  const memberProfiles = isGroup && active.kind === "group" ? active.memberProfiles : undefined;
                  const senderProfile = !mine && isGroup && memberProfiles ? memberProfiles[m.sender_id] : undefined;
                  const senderInitials = senderProfile
                    ? senderProfile.name.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
                    : "?";
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      {/* Student avatar — only shown to mentor in group chats */}
                      {!mine && isGroup && senderProfile && (
                        <div className="mr-2 shrink-0 self-end">
                          <div className="h-7 w-7 rounded-full bg-secondary/20 text-[10px] font-bold text-secondary overflow-hidden flex items-center justify-center">
                            {senderProfile.avatar
                              ? <img src={senderProfile.avatar} alt={senderProfile.name} className="h-full w-full object-cover" />
                              : senderInitials}
                          </div>
                        </div>
                      )}
                      <div className={`max-w-[75%] ${!mine && isGroup && senderProfile ? "flex flex-col" : ""}`}>
                        {/* Student name label — mentor-only, group only */}
                        {!mine && isGroup && senderProfile && (
                          <p className="mb-0.5 ml-1 text-[10px] font-semibold text-muted-foreground">{senderProfile.name}</p>
                        )}
                        <div
                          className={`rounded-2xl px-3 py-2 text-sm shadow-sm ${
                            mine ? "bg-primary text-primary-foreground" : "bg-card text-foreground border border-border"
                          }`}
                        >
                          {hasAttachment && <Attachment message={m} mine={mine} />}
                          {m.content ? <p className="whitespace-pre-wrap break-words">{m.content}</p> : null}
                          <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            <span>{formatTime(m.created_at)}</span>
                            {mine && isDirect && (
                              m.read_at ? (
                                <CheckCheck className="h-3 w-3" aria-label="Seen" />
                              ) : (
                                <Check className="h-3 w-3" aria-label="Sent" />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {typingLabel && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border bg-card p-3">
              {file && (
                <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-muted/40 p-1 pr-2">
                  {filePreview ? (
                    <img src={filePreview} alt="preview" className="h-12 w-12 rounded object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-primary/15 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatBytes(file.size)}</p>
                  </div>
                  <button onClick={() => setFile(null)} className="ml-2 text-muted-foreground hover:text-foreground" aria-label="Remove attachment">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <label className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground" title="Attach image or document">
                  <Paperclip className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z"
                    className="hidden"
                    onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <textarea
                  rows={1}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (e.target.value.trim()) sendTyping();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type a message…"
                  className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <Button onClick={handleSend} disabled={sending || (!text.trim() && !file)} className="h-10">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a conversation to start chatting.
          </div>
        )}
      </section>
    </div>
  );
};

export default MentorChatPanel;
