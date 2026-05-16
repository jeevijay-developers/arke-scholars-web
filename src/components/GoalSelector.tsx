import { ChevronDown, Target } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const goals = ["IIT JEE", "NEET", "Boards", "JEE + NEET"];

interface GoalSelectorProps {
  value?: string;
  onChange?: (val: string) => void;
}

const GoalSelector = ({ value = "IIT JEE", onChange }: GoalSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  const handleSelect = async (g: string) => {
    setOpen(false);
    if (g === value) return;
    const previous = value;
    onChange?.(g); // optimistic
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ goal: g })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      onChange?.(previous);
      toast.error("Could not save goal");
    } else {
      toast.success(`Goal set to ${g}`);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={saving}
        className="flex items-center gap-2 rounded-pill bg-primary-light px-3 py-1.5 text-sm font-bold font-display text-primary hover:bg-primary/10 transition-colors disabled:opacity-60"
      >
        <Target className="h-3.5 w-3.5" /> {value}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-40 rounded-lg border border-border bg-card shadow-lg py-1">
          {goals.map((g) => (
            <button
              key={g}
              onClick={() => handleSelect(g)}
              className={`block w-full px-3 py-2 text-left text-sm font-medium hover:bg-primary-light transition-colors ${g === value ? 'text-primary bg-primary-light' : 'text-foreground'}`}
            >
              {g}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default GoalSelector;
