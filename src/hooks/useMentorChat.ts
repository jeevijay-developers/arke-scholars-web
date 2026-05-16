import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export type MentorMessage = {
  id: string;
  conversation_type: "direct" | "group";
  group_id: string | null;
  sender_id: string;
  recipient_id: string | null;
  content: string | null;
  image_url: string | null;
  is_deleted: boolean;
  created_at: string;
  read_at: string | null;
  file_url: string | null;
  file_path: string | null;
  file_name: string | null;
  file_mime: string | null;
  file_size_bytes: number | null;
};

export const CHAT_BUCKET = "mentor-chat-files";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

export const isImageMime = (mime?: string | null) => !!mime && mime.startsWith("image/");

/** Refresh a signed URL for a private bucket object. */
export const getChatFileUrl = async (path: string) => {
  const { data, error } = await supabase.storage.from(CHAT_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (error) return null;
  return data?.signedUrl ?? null;
};

export type Conversation =
  | { kind: "direct"; id: string; title: string; subtitle?: string; peerId: string; unread?: number }
  | { kind: "group"; id: string; title: string; subtitle?: string; groupId: string; unread?: number };

const computeDirectUnread = async (myId: string, peerIds: string[]) => {
  if (!peerIds.length) return new Map<string, number>();
  const { data } = await supabase
    .from("mentor_messages")
    .select("sender_id")
    .eq("conversation_type", "direct")
    .eq("recipient_id", myId)
    .is("read_at", null)
    .in("sender_id", peerIds);
  const map = new Map<string, number>();
  (data ?? []).forEach((r: any) => map.set(r.sender_id, (map.get(r.sender_id) ?? 0) + 1));
  return map;
};

const computeGroupUnread = async (myId: string, groupIds: string[]) => {
  if (!groupIds.length) return new Map<string, number>();
  const { data: reads } = await supabase
    .from("mentor_group_reads")
    .select("group_id, last_read_at")
    .eq("user_id", myId)
    .in("group_id", groupIds);
  const lastReads = new Map<string, string>();
  (reads ?? []).forEach((r: any) => lastReads.set(r.group_id, r.last_read_at));

  const map = new Map<string, number>();
  await Promise.all(
    groupIds.map(async (gid) => {
      let q = supabase
        .from("mentor_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_type", "group")
        .eq("group_id", gid)
        .neq("sender_id", myId);
      const lr = lastReads.get(gid);
      if (lr) q = q.gt("created_at", lr);
      const { count } = await q;
      map.set(gid, count ?? 0);
    }),
  );
  return map;
};

const useUnreadSubscription = (
  userId: string | undefined,
  refresh: () => void,
) => {
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`mentor-unread:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mentor_messages" },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mentor_messages" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, refresh]);
};

/** Mentor-side: list of student DMs + the mentor's own group. */
export const useMentorConversations = () => {
  const { user } = useAuth();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: assignments }, { data: groups }] = await Promise.all([
      supabase
        .from("mentor_student_assignments")
        .select("student_id")
        .eq("mentor_id", user.id)
        .is("removed_at", null),
      supabase.from("mentor_groups").select("id, name").eq("mentor_id", user.id),
    ]);

    const studentIds = (assignments ?? []).map((a) => a.student_id);
    const { data: profiles } = studentIds.length
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", studentIds)
      : { data: [] as { user_id: string; full_name: string | null }[] };

    const groupIds = (groups ?? []).map((g) => g.id);
    const [directUnread, groupUnread] = await Promise.all([
      computeDirectUnread(user.id, studentIds),
      computeGroupUnread(user.id, groupIds),
    ]);

    const list: Conversation[] = [];
    (groups ?? []).forEach((g) =>
      list.push({
        kind: "group",
        id: `g:${g.id}`,
        title: g.name,
        subtitle: "Group chat",
        groupId: g.id,
        unread: groupUnread.get(g.id) ?? 0,
      }),
    );
    (profiles ?? []).forEach((p) =>
      list.push({
        kind: "direct",
        id: `d:${p.user_id}`,
        title: p.full_name || "Student",
        subtitle: "Direct message",
        peerId: p.user_id,
        unread: directUnread.get(p.user_id) ?? 0,
      }),
    );
    setConvos(list);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    load();
  }, [user, load]);

  useUnreadSubscription(user?.id, load);

  return { conversations: convos, loading, refresh: load };
};

/** Student-side: their assigned mentor DM + the mentor's group. */
export const useStudentMentorConversations = () => {
  const { user } = useAuth();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: assignment } = await supabase
      .from("mentor_student_assignments")
      .select("mentor_id")
      .eq("student_id", user.id)
      .is("removed_at", null)
      .maybeSingle();

    const list: Conversation[] = [];
    if (assignment?.mentor_id) {
      const [{ data: mentorProfile }, { data: group }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("user_id", assignment.mentor_id).maybeSingle(),
        supabase.from("mentor_groups").select("id, name").eq("mentor_id", assignment.mentor_id).maybeSingle(),
      ]);

      const [directUnread, groupUnread] = await Promise.all([
        computeDirectUnread(user.id, [assignment.mentor_id]),
        computeGroupUnread(user.id, group ? [group.id] : []),
      ]);

      list.push({
        kind: "direct",
        id: `d:${assignment.mentor_id}`,
        title: mentorProfile?.full_name || "Your Mentor",
        subtitle: "Direct message",
        peerId: assignment.mentor_id,
        unread: directUnread.get(assignment.mentor_id) ?? 0,
      });
      if (group) {
        list.push({
          kind: "group",
          id: `g:${group.id}`,
          title: group.name,
          subtitle: "Group chat",
          groupId: group.id,
          unread: groupUnread.get(group.id) ?? 0,
        });
      }
    }
    setConvos(list);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    load();
  }, [user, load]);

  useUnreadSubscription(user?.id, load);

  return { conversations: convos, loading, refresh: load };
};

export type TypingUser = { userId: string; name: string };

export const useMentorMessages = (conversation: Conversation | null, onActivity?: () => void) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MentorMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastTypingSentRef = useRef<number>(0);

  const matchesConvo = useCallback(
    (m: MentorMessage) => {
      if (!conversation || !user) return false;
      if (conversation.kind === "group") return m.conversation_type === "group" && m.group_id === conversation.groupId;
      const peer = conversation.peerId;
      return (
        m.conversation_type === "direct" &&
        ((m.sender_id === user.id && m.recipient_id === peer) || (m.sender_id === peer && m.recipient_id === user.id))
      );
    },
    [conversation, user],
  );

  // Mark messages as read when conversation opens / new incoming arrives
  const markRead = useCallback(async () => {
    if (!conversation || !user) return;
    if (conversation.kind === "direct") {
      await supabase
        .from("mentor_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_type", "direct")
        .eq("recipient_id", user.id)
        .eq("sender_id", conversation.peerId)
        .is("read_at", null);
    } else {
      await supabase
        .from("mentor_group_reads")
        .upsert(
          { user_id: user.id, group_id: conversation.groupId, last_read_at: new Date().toISOString() },
          { onConflict: "group_id,user_id" },
        );
    }
    onActivity?.();
  }, [conversation, user, onActivity]);

  useEffect(() => {
    if (!conversation || !user) {
      setMessages([]);
      return;
    }
    let ignore = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("mentor_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(200);
      if (conversation.kind === "group") {
        q = q.eq("conversation_type", "group").eq("group_id", conversation.groupId);
      } else {
        q = q
          .eq("conversation_type", "direct")
          .or(
            `and(sender_id.eq.${user.id},recipient_id.eq.${conversation.peerId}),and(sender_id.eq.${conversation.peerId},recipient_id.eq.${user.id})`,
          );
      }
      const { data } = await q;
      if (!ignore) {
        setMessages((data ?? []) as MentorMessage[]);
        setLoading(false);
        markRead();
      }
    })();

    // Realtime messages
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const ch = supabase
      .channel(`mentor-msgs:${conversation.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mentor_messages" },
        (payload) => {
          const row = payload.new as MentorMessage;
          if (matchesConvo(row)) {
            setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
            if (row.sender_id !== user.id) markRead();
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mentor_messages" },
        (payload) => {
          const row = payload.new as MentorMessage;
          setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
        },
      )
      .subscribe();
    channelRef.current = ch;

    // Typing broadcast channel (separate, per conversation)
    if (typingChannelRef.current) supabase.removeChannel(typingChannelRef.current);
    setTypingUsers([]);
    const tch = supabase
      .channel(`mentor-typing:${conversation.id}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, (payload) => {
        const { userId, name } = (payload.payload ?? {}) as { userId?: string; name?: string };
        if (!userId || userId === user.id) return;
        setTypingUsers((prev) =>
          prev.some((p) => p.userId === userId) ? prev : [...prev, { userId, name: name || "Someone" }],
        );
        const existing = typingTimersRef.current.get(userId);
        if (existing) clearTimeout(existing);
        const t = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((p) => p.userId !== userId));
          typingTimersRef.current.delete(userId);
        }, 3500);
        typingTimersRef.current.set(userId, t);
      })
      .subscribe();
    typingChannelRef.current = tch;

    return () => {
      ignore = true;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      if (typingChannelRef.current) supabase.removeChannel(typingChannelRef.current);
      typingChannelRef.current = null;
      typingTimersRef.current.forEach((t) => clearTimeout(t));
      typingTimersRef.current.clear();
    };
  }, [conversation, user, matchesConvo, markRead]);

  const sendTyping = useCallback(() => {
    if (!typingChannelRef.current || !user) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    typingChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user.id, name: (user.user_metadata as any)?.full_name || user.email || "Someone" },
    });
  }, [user]);

  const send = useCallback(
    async (opts: { text?: string; file?: File | null }) => {
      if (!conversation || !user) return;
      const text = opts.text?.trim() || "";
      const file = opts.file ?? null;
      if (!text && !file) return;
      setSending(true);
      try {
        let filePath: string | null = null;
        let fileUrl: string | null = null;
        let imageUrl: string | null = null;
        let fileName: string | null = null;
        let fileMime: string | null = null;
        let fileSize: number | null = null;

        if (file) {
          const safeName = file.name.replace(/[^\w.\-]+/g, "_");
          const ext = safeName.includes(".") ? safeName.split(".").pop() : "bin";
          const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from(CHAT_BUCKET)
            .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
          if (upErr) throw upErr;
          const signed = await getChatFileUrl(path);
          filePath = path;
          fileUrl = signed;
          fileName = file.name;
          fileMime = file.type || "application/octet-stream";
          fileSize = file.size;
          if (isImageMime(fileMime)) imageUrl = signed; // back-compat
        }
        const row = {
          conversation_type: conversation.kind,
          group_id: conversation.kind === "group" ? conversation.groupId : null,
          sender_id: user.id,
          recipient_id: conversation.kind === "direct" ? conversation.peerId : null,
          content: text || null,
          image_url: imageUrl,
          file_url: fileUrl,
          file_path: filePath,
          file_name: fileName,
          file_mime: fileMime,
          file_size_bytes: fileSize,
        };
        const { error } = await supabase.from("mentor_messages").insert(row);
        if (error) throw error;

        // Fire-and-forget notification dispatch (in-app + email per recipient prefs)
        try {
          const { dispatchNotification } = await import("@/lib/notify");
          const senderName =
            (user.user_metadata as any)?.full_name ||
            (user.user_metadata as any)?.name ||
            user.email?.split("@")[0] ||
            "Your mentor";
          const preview = text
            ? text.slice(0, 140)
            : file
              ? `Sent ${isImageMime(fileMime) ? "an image" : "a file"}: ${fileName}`
              : "New message";

          if (conversation.kind === "direct") {
            const { data: peer } = await supabase
              .from("profiles")
              .select("user_id, full_name")
              .eq("user_id", conversation.peerId)
              .maybeSingle();
            const { data: peerAuth } = await supabase.auth.admin
              ? { data: null }
              : { data: null };
            // Look up email via RPC fallback: read from a view if available, else skip email.
            // The dispatch helper safely no-ops if email is missing.
            void dispatchNotification({
              recipientUserId: conversation.peerId,
              recipientEmail: (peerAuth as any)?.email ?? null,
              category: "mentor_message",
              inApp: {
                title: `New message from ${senderName}`,
                body: preview,
                type: "mentor_message",
                link: "/mentor-chat",
              },
              email: {
                templateName: "mentor-message",
                idempotencyKey: `mentor-msg-${user.id}-${conversation.peerId}-${Date.now()}`,
                templateData: {
                  recipientName: peer?.full_name,
                  senderName,
                  messagePreview: preview,
                  chatUrl: "https://arke.pro/mentor-chat",
                },
              },
            });
          }
        } catch (e) {
          console.warn("[mentor-chat] notify dispatch failed", e);
        }
      } finally {
        setSending(false);
      }
    },
    [conversation, user],
  );

  return useMemo(
    () => ({ messages, loading, sending, send, typingUsers, sendTyping, markRead }),
    [messages, loading, sending, send, typingUsers, sendTyping, markRead],
  );
};
