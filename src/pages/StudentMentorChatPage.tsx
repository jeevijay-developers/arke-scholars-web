import { useEffect, useState } from "react";
import { Star, Flag } from "lucide-react";
import MentorChatPanel from "@/components/MentorChatPanel";
import MentorReviewCard from "@/components/MentorReviewCard";
import ReportDialog from "@/components/ReportDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStudentMentorConversations } from "@/hooks/useMentorChat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

const StudentMentorChatPage = () => {
  const { conversations, loading, refresh } = useStudentMentorConversations();
  const { user } = useAuth();
  const [rateOpen, setRateOpen] = useState(false);
  const [mentor, setMentor] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data: a } = await supabase
        .from("mentor_student_assignments")
        .select("mentor_id")
        .eq("student_id", user.id)
        .is("removed_at", null)
        .order("assigned_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!a?.mentor_id || cancelled) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", a.mentor_id)
        .maybeSingle();
      if (!cancelled) setMentor({ id: a.mentor_id, name: p?.full_name || "Your Mentor" });
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return (
    <div className="flex h-full min-h-0 flex-col p-4 lg:p-6">
      <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-black text-foreground">Mentor Chat</h1>
          <p className="text-sm text-muted-foreground">
            Talk directly with your assigned mentor.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {mentor && (
            <ReportDialog
              reportedName={mentor.name}
              reportedRole="mentor"
              reportedUserId={mentor.id}
              trigger={
                <Button size="sm" variant="outline">
                  <Flag className="h-4 w-4" />
                  Report mentor
                </Button>
              }
            />
          )}
          <Button size="sm" onClick={() => setRateOpen(true)}>
            <Star className="h-4 w-4" />
            Rate your mentor
          </Button>
        </div>
      </div>
      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rate your mentor</DialogTitle>
          </DialogHeader>
          <MentorReviewCard />
        </DialogContent>
      </Dialog>
      <MentorChatPanel
        conversations={conversations}
        loading={loading}
        onActivity={refresh}
        emptyHint="You haven't been assigned a mentor yet. Once you are, the chat will open up here."
      />
    </div>
  );
};

export default StudentMentorChatPage;
