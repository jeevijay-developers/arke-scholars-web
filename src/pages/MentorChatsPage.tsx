import MentorChatPanel from "@/components/MentorChatPanel";
import { useMentorConversations } from "@/hooks/useMentorChat";

const MentorChatsPage = () => {
  const { conversations, loading, refresh } = useMentorConversations();
  return (
    <div className="flex h-full min-h-0 flex-col p-4 lg:p-6">
      <div className="mb-4 shrink-0">
        <h1 className="font-display text-2xl font-black text-foreground">Chats</h1>
        <p className="text-sm text-muted-foreground">Message your assigned students individually or as a group.</p>
      </div>
      <MentorChatPanel
        conversations={conversations}
        loading={loading}
        onActivity={refresh}
        emptyHint="No students assigned yet. Once an admin assigns students to you, they'll show up here."
      />
    </div>
  );
};

export default MentorChatsPage;
