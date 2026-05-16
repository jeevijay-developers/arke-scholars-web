import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface FormattedAnswerProps {
  content: string;
  className?: string;
  tone?: "default" | "primary" | "secondary";
}

/**
 * Renders AI / educator answer text from markdown into clean, readable HTML
 * with consistent typography (no raw ** or * showing through).
 */
export const FormattedAnswer = ({ content, className, tone = "default" }: FormattedAnswerProps) => {
  const accent =
    tone === "primary"
      ? "marker:text-primary"
      : tone === "secondary"
      ? "marker:text-secondary"
      : "marker:text-muted-foreground";

  return (
    <div
      className={cn(
        "text-sm leading-relaxed text-foreground space-y-2 break-words",
        "[&_p]:leading-relaxed [&_p]:text-foreground",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        "[&_em]:italic",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1",
        "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1",
        "[&_li]:text-foreground",
        "[&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-2",
        "[&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-2",
        "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-1",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_code]:font-mono",
        "[&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:overflow-x-auto",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        "[&_a]:text-primary [&_a]:underline",
        "[&_table]:w-full [&_table]:text-xs [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
        accent,
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
};

export default FormattedAnswer;
