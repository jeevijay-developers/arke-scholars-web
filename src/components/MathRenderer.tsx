import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/contrib/mhchem";
import { cn } from "@/lib/utils";

type Props = {
  content: string;
  className?: string;
  inline?: boolean;
};

/**
 * Renders markdown with LaTeX math (KaTeX) and chemistry (\ce{}) support.
 * Inline math: $...$  Block math: $$...$$  Chemistry: $\ce{H2O}$
 */
const MathRenderer = ({ content, className, inline = false }: Props) => {
  if (!content) return null;
  const Tag = inline ? "span" : "div";
  return (
    <Tag className={cn("math-content", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: false, trust: true }]]}
        skipHtml
        components={
          inline
            ? {
                p: ({ children }) => <span>{children}</span>,
              }
            : undefined
        }
      >
        {content}
      </ReactMarkdown>
    </Tag>
  );
};

export default MathRenderer;
