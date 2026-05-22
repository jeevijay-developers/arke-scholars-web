import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SUBJECTS_COMPETE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Swords } from "lucide-react";
import type { BattleFilters } from "@/hooks/useBattleMatchmaking";

const CLASS_LEVELS = ["6", "7", "8", "9", "10", "11", "12", "Dropper"];
const DEFAULT_EXAMS = ["JEE Main", "JEE Advanced", "NEET", "BITSAT", "KCET", "MHT-CET"];

type Props = {
  onEnterLobby: (filters: BattleFilters) => void;
  busy?: boolean;
};

export function FilterSelector({ onEnterLobby, busy = false }: Props) {
  const [classLevel, setClassLevel] = useState("11");
  const [targetExam, setTargetExam] = useState("JEE Main");
  const [subject, setSubject] = useState("Physics");
  const [topic, setTopic] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);

  // Pre-fill from user profile
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase
        .from("profiles")
        .select("class_level, target_exam")
        .eq("user_id", data.user.id)
        .maybeSingle()
        .then(({ data: profile }) => {
          if (profile?.class_level) setClassLevel(profile.class_level);
          if (profile?.target_exam) setTargetExam(profile.target_exam);
        });
    });
  }, []);

  // Load topics whenever subject / class / exam changes
  useEffect(() => {
    let cancelled = false;
    setTopic("");
    setTopics([]);
    setLoadingTopics(true);

    (async () => {
      let { data } = await supabase
        .from("compete_questions")
        .select("topic")
        .eq("subject", subject)
        .eq("is_active", true)
        .eq("class_level", classLevel)
        .eq("target_exam", targetExam);

      if (cancelled) return;

      let unique = [...new Set((data ?? []).map((r: { topic: string }) => r.topic as string))].sort();

      // Fallback: ignore class / exam filter if no results
      if (unique.length === 0) {
        const { data: fallback } = await supabase
          .from("compete_questions")
          .select("topic")
          .eq("subject", subject)
          .eq("is_active", true);
        if (!cancelled) {
          unique = [...new Set((fallback ?? []).map((r: { topic: string }) => r.topic as string))].sort();
        }
      }

      if (!cancelled) {
        setTopics(unique);
        if (unique.length > 0) setTopic(unique[0]);
        setLoadingTopics(false);
      }
    })();

    return () => { cancelled = true; };
  }, [subject, classLevel, targetExam]);

  const handleSubmit = () => {
    if (!classLevel || !targetExam || !subject || !topic) return;
    onEnterLobby({ classLevel, targetExam, subject, topic });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Class Level */}
        <div className="space-y-1.5">
          <Label>Class</Label>
          <Select value={classLevel} onValueChange={setClassLevel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLASS_LEVELS.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Target Exam */}
        <div className="space-y-1.5">
          <Label>Exam</Label>
          <Select value={targetExam} onValueChange={setTargetExam}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEFAULT_EXAMS.map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Subject */}
        <div className="space-y-1.5">
          <Label>Subject</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUBJECTS_COMPETE.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Topic */}
        <div className="space-y-1.5">
          <Label>Topic</Label>
          <Select value={topic} onValueChange={setTopic} disabled={loadingTopics || topics.length === 0}>
            <SelectTrigger>
              {loadingTopics
                ? <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</span>
                : <SelectValue placeholder={topics.length === 0 ? "No topics available" : "Select topic"} />
              }
            </SelectTrigger>
            <SelectContent>
              {topics.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        className="w-full gap-2"
        size="lg"
        onClick={handleSubmit}
        disabled={busy || !classLevel || !targetExam || !subject || !topic || loadingTopics}
      >
        {busy
          ? <><Loader2 className="h-5 w-5 animate-spin" />Finding opponent…</>
          : <><Swords className="h-5 w-5" />Find Battle</>
        }
      </Button>
    </div>
  );
}
