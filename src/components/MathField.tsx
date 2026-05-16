import { useEffect, useRef } from "react";
import "mathlive";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (latex: string) => void;
  placeholder?: string;
  className?: string;
};

/**
 * Controlled wrapper around the MathLive <math-field> web component.
 * Stores plain LaTeX string. Use $...$ delimiters when embedding into markdown.
 */
const MathField = ({ value, onChange, placeholder, className }: Props) => {
  const ref = useRef<HTMLElement & { value: string }>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.value !== value) el.value = value;
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => onChange((el as any).value ?? "");
    el.addEventListener("input", handler);
    return () => el.removeEventListener("input", handler);
  }, [onChange]);

  const Tag = "math-field" as any;
  return (
    <Tag
      ref={ref}
      placeholder={placeholder}
      class={cn(
        "block w-full min-h-[44px] rounded-lg border border-border bg-card px-3 py-2 text-sm",
        className,
      )}
      style={{ display: "block" }}
    />
  );
};

export default MathField;
