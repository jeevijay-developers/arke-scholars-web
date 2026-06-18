import { InlineMath, BlockMath } from "react-katex";

type Segment =
  | { type: "html"; content: string }
  | { type: "inline"; content: string }
  | { type: "block"; content: string };

// Decode HTML entities — runs twice to handle double-encoded strings like &amp;lt; → &lt; → <
function decodeEntities(s: string): string {
  const map: Record<string, string> = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'",
    "&nbsp;": " ", "&le;": "≤", "&ge;": "≥", "&ne;": "≠",
    "&alpha;": "α", "&beta;": "β", "&gamma;": "γ", "&delta;": "δ",
    "&lambda;": "λ", "&mu;": "μ", "&pi;": "π", "&sigma;": "σ",
    "&omega;": "ω", "&theta;": "θ", "&phi;": "φ", "&psi;": "ψ",
    "&epsilon;": "ε", "&zeta;": "ζ", "&eta;": "η", "&kappa;": "κ",
    "&nu;": "ν", "&xi;": "ξ", "&rho;": "ρ", "&tau;": "τ",
    "&upsilon;": "υ", "&chi;": "χ",
    "&rarr;": "→", "&larr;": "←", "&harr;": "↔", "&uarr;": "↑", "&darr;": "↓",
    "&plusmn;": "±", "&times;": "×", "&divide;": "÷", "&deg;": "°",
    "&sup2;": "²", "&sup3;": "³", "&frac12;": "½", "&frac14;": "¼",
    "&infin;": "∞", "&sum;": "∑", "&int;": "∫", "&part;": "∂",
  };
  const pattern = Object.keys(map).join("|");
  const re = new RegExp(pattern, "g");
  // Run twice to handle double-encoded entities (&amp;lt; → &lt; → <)
  let out = s.replace(re, (m) => map[m] ?? m);
  out = out.replace(re, (m) => map[m] ?? m);
  return out;
}

// Pre-process: decode double-encoded entities in text nodes only (not inside tag attributes)
function preDecodeHtml(input: string): string {
  // Replace entities that appear outside of HTML tags
  // Strategy: split on tags, decode text nodes only
  return input.replace(/(<[^>]*>)|([^<]+)/g, (_, tag, text) => {
    if (tag) return tag; // preserve HTML tags unchanged
    return decodeEntities(text);
  });
}

// Split a mixed HTML+LaTeX string into renderable segments.
// HTML tags are collected verbatim so we never split inside an attribute value.
// $$…$$ is block math; $…$ is inline math; everything else is HTML.
function segmentize(input: string): Segment[] {
  const segments: Segment[] = [];
  let i = 0;
  let htmlBuf = "";

  const flushHtml = () => {
    if (htmlBuf) { segments.push({ type: "html", content: htmlBuf }); htmlBuf = ""; }
  };

  while (i < input.length) {
    // Pass HTML tags through unchanged so we don't split on $ inside attributes
    if (input[i] === "<") {
      const close = input.indexOf(">", i);
      if (close === -1) { htmlBuf += input.slice(i); i = input.length; }
      else { htmlBuf += input.slice(i, close + 1); i = close + 1; }
      continue;
    }

    // Block math $$…$$
    if (input[i] === "$" && input[i + 1] === "$") {
      const end = input.indexOf("$$", i + 2);
      if (end !== -1) {
        flushHtml();
        segments.push({ type: "block", content: input.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }

    // Inline math $…$ (non-empty, no newline inside)
    if (input[i] === "$") {
      const end = input.indexOf("$", i + 1);
      if (end !== -1 && end > i + 1 && !input.slice(i + 1, end).includes("\n")) {
        flushHtml();
        segments.push({ type: "inline", content: input.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    htmlBuf += input[i];
    i++;
  }

  flushHtml();
  return segments;
}

interface Props {
  html: string;
  className?: string;
  inline?: boolean;
}

const LatexRenderer = ({ html, className = "", inline = false }: Props) => {
  const segments = segmentize(preDecodeHtml(html ?? ""));
  const Tag = inline ? "span" : "div";
  const baseClass = inline
    ? `latex-content [&_img]:max-h-20 [&_img]:w-auto [&_img]:inline-block [&_img]:align-middle ${className}`
    : `latex-content leading-relaxed [&_img]:max-h-72 [&_img]:w-auto [&_img]:inline-block [&_img]:align-middle ${className}`;

  return (
    <Tag className={baseClass}>
      {segments.map((seg, idx) => {
        if (seg.type === "html") {
          return (
            <span
              key={idx}
              // Mammoth-generated HTML is structured; images are already hosted in Storage
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: seg.content }}
            />
          );
        }

        if (seg.type === "inline") {
          return (
            <InlineMath
              key={idx}
              math={seg.content}
              renderError={() => (
                <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1 text-xs font-mono text-red-600">
                  ⚠ {seg.content}
                </span>
              )}
            />
          );
        }

        // block math
        return (
          <BlockMath
            key={idx}
            math={seg.content}
            renderError={() => (
              <div className="rounded bg-red-100 p-2 text-xs font-mono text-red-600">
                ⚠ LaTeX error: {seg.content}
              </div>
            )}
          />
        );
      })}
    </Tag>
  );
};

export default LatexRenderer;
