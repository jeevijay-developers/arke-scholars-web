import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";
import mammoth from "https://esm.sh/mammoth@1.8.0/mammoth.browser.min";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-info",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionType = "scq" | "mcq" | "integer" | "match_column" | "assertion_reasoning";
type ImageType = "equation" | "chemistry" | "diagram";

interface MatchEntry { key: string; value: string }

export interface RichImage {
  url: string;
  type: ImageType;
  mol?: string;     // MDL MOL V2000 format (chemistry only)
  smiles?: string;  // SMILES string (chemistry only)
}

interface ProcessedImage extends RichImage {
  latexB64?: string; // btoa(latex) — equation only; consumed during HTML post-processing
  molB64?: string;   // btoa(mol)   — chemistry only
}

interface ParsedQuestion {
  question_number: number;
  type: QuestionType;
  stem_html: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  correct_options: number[];
  correct_integer: null;
  match_col1: MatchEntry[] | null;
  match_col2: MatchEntry[] | null;
  assertion_text: string | null;
  reason_text: string | null;
  images: string[];          // all image Storage URLs (kept for DB compat)
  rich_images: RichImage[];  // structured: type + chemistry data
  has_latex: boolean;
  omml_detected: boolean;
  needs_review: boolean;
}

// ─── Gemini Vision image classifier ──────────────────────────────────────────

async function classifyImage(
  imageBytes: Uint8Array,
  mimeType: string,
  geminiKey: string,
): Promise<{ type: ImageType; latex?: string; mol?: string; smiles?: string }> {
  // Build base64 in chunks to avoid call-stack overflow on large images
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < imageBytes.length; i += CHUNK) {
    binary += String.fromCharCode(
      ...imageBytes.subarray(i, Math.min(i + CHUNK, imageBytes.length)),
    );
  }
  const base64 = btoa(binary);

  const body = {
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: base64 } },
        {
          text: `You are analyzing an image from a JEE/NEET academic exam paper (Indian competitive exam).
Classify this image as exactly ONE of:
1. "equation" — a mathematical formula, expression, or equation
2. "chemistry" — a chemical structure, molecule, bond diagram, or reaction scheme
3. "diagram" — a graph, geometric figure, table, apparatus diagram, or any other image

Respond ONLY with valid JSON (absolutely no markdown fences, no extra text, no explanation):
• If equation:  {"type":"equation","latex":"<complete KaTeX-compatible LaTeX code>"}
• If chemistry: {"type":"chemistry","mol":"<valid MDL MOL V2000 text>","smiles":"<SMILES string>"}
• If diagram:   {"type":"diagram"}

For equations: produce complete, self-contained LaTeX (use \\frac, \\sum, \\int etc. as needed).
For chemistry: produce the full MDL MOL V2000 block including the counts line and atom/bond table.`,
        },
      ],
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      console.error("Gemini error:", res.status, await res.text());
      return { type: "diagram" };
    }
    const data = await res.json();
    const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    // Strip any accidental markdown code fences Gemini sometimes adds
    const cleaned = raw.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed as { type: ImageType; latex?: string; mol?: string; smiles?: string };
  } catch (e) {
    console.error("classifyImage error:", e);
    return { type: "diagram" };
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ error: "Unauthorized" }, 401);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const paperId = (formData.get("paper_id") as string | null)?.trim();

    if (!file || !paperId) return respond({ error: "Missing file or paper_id" }, 400);
    if (!file.name.toLowerCase().endsWith(".docx")) {
      return respond({ error: "File must be a .docx" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceKey);

    // ── 1. Read & clone the ArrayBuffer ────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    // Clone before fflate: unzipSync can detach the buffer in some Deno builds
    const arrayBufferForMammoth = arrayBuffer.slice(0);
    const uint8 = new Uint8Array(arrayBuffer);

    // ── 2. Unzip — extract media files and raw document XML ───────────────────
    const unzipped = unzipSync(uint8);
    const docXmlBytes = unzipped["word/document.xml"];
    const docXml = docXmlBytes ? new TextDecoder().decode(docXmlBytes) : "";

    // Sort alphabetically — Word adds media in document order which typically
    // matches alphabetical (image1.png, image2.png, …)
    const mediaEntries = Object.entries(unzipped)
      .filter(([p]) => p.startsWith("word/media/"))
      .sort(([a], [b]) => a.localeCompare(b));

    // ── 3. Upload all media to Storage in parallel ────────────────────────────
    const uploadResults = await Promise.all(
      mediaEntries.map(async ([path, data]) => {
        const ext = path.split(".").pop()?.toLowerCase() ?? "png";
        const uuid = crypto.randomUUID();
        const storagePath = `${paperId}/${uuid}.${ext}`;
        // Treat WMF/EMF Word vector formats as PNG for content-type (browser can't render them anyway)
        const contentType =
          ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
          ext === "gif" ? "image/gif" :
          ext === "svg" ? "image/svg+xml" :
          "image/png";

        const { error } = await admin.storage
          .from("question-images")
          .upload(storagePath, data, { contentType, upsert: false });

        if (error) {
          console.error(`Upload failed ${path}:`, error.message);
          return { url: "", data, contentType };
        }
        const { data: urlData } = admin.storage
          .from("question-images")
          .getPublicUrl(storagePath);
        return { url: urlData.publicUrl, data, contentType };
      }),
    );

    // ── 4. Classify every image with Gemini in parallel ───────────────────────
    // Falls back gracefully to "diagram" if GEMINI_API_KEY is not set or call fails.
    const imageResults: ProcessedImage[] = await Promise.all(
      uploadResults.map(async ({ url, data, contentType }) => {
        if (!url) return { url, type: "diagram" as ImageType };

        const cls = geminiKey
          ? await classifyImage(data, contentType, geminiKey)
          : { type: "diagram" as ImageType };

        const result: ProcessedImage = { url, type: cls.type ?? "diagram" };

        if (cls.type === "equation" && cls.latex) {
          // btoa is safe here — LaTeX is ASCII
          result.latexB64 = btoa(cls.latex);
        }
        if (cls.type === "chemistry") {
          if (cls.mol) { result.mol = cls.mol; result.molB64 = btoa(cls.mol); }
          if (cls.smiles) result.smiles = cls.smiles;
        }

        return result;
      }),
    );

    // ── 5. mammoth: docx → HTML, embedding classification in <img> attributes ─
    let imgIdx = 0;
    const mammothResult = await mammoth.convertToHtml(
      { arrayBuffer: arrayBufferForMammoth },
      {
        convertImage: mammoth.images.imgElement((_img: unknown) => {
          const r = imageResults[imgIdx++];
          if (!r?.url) return Promise.resolve({ src: "" });

          const attrs: Record<string, string> = { src: r.url };

          if (r.type === "equation" && r.latexB64) {
            attrs["data-img-type"] = "equation";
            attrs["data-latex-b64"] = r.latexB64;
          } else if (r.type === "chemistry") {
            attrs["data-img-type"] = "chemistry";
            if (r.molB64) attrs["data-mol-b64"] = r.molB64;
            if (r.smiles) attrs["data-smiles"] = r.smiles;
          }
          // diagram: plain <img src="..."> — no extra attributes

          return Promise.resolve(attrs);
        }),
      },
    );

    // ── 6. Post-process HTML: replace equation <img> tags with $$LaTeX$$ ──────
    // This makes LatexRenderer (which already handles $$…$$) render them as KaTeX
    // without any frontend changes.
    let html = mammothResult.value;
    html = html.replace(
      /<img\b[^>]*?data-img-type="equation"[^>]*?(?:\/>|>)/gi,
      (match) => {
        const b64 = /data-latex-b64="([^"]+)"/.exec(match)?.[1];
        if (!b64) return "";
        try {
          return `<span class="gemini-eq">$$${atob(b64)}$$</span>`;
        } catch {
          return "";
        }
      },
    );

    // ── 7. Parse HTML into structured question objects ────────────────────────
    const urlToRichImage = new Map<string, RichImage>(
      imageResults
        .filter((r) => r.url)
        .map((r) => [r.url, { url: r.url, type: r.type, mol: r.mol, smiles: r.smiles }]),
    );

    const questions = parseQuestions(html, docXml, urlToRichImage);

    return respond({ questions });
  } catch (e) {
    console.error("parse-docx error", e);
    return respond({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

// ─── Question parser ──────────────────────────────────────────────────────────
//
// Chemistry.docx format (confirmed from raw XML inspection):
//   • Each question is ONE Word paragraph.
//   • The question number is bold (<w:b/>) → mammoth emits <strong>N.</strong>.
//   • Stem AND all four options are inline in that same paragraph, e.g.:
//       <p><strong>46.</strong>	[Ni(NH3)6]Cl2 … (1) 4	(2) 3	(3) 2	(4) 5</p>
//   • Match-column: separate <w:tbl> table after the question paragraph;
//     4 cells per row: key₁, val₁, key₂, val₂.  Options come in a paragraph
//     after </table>.

function parseQuestions(
  html: string,
  docXml: string,
  urlToRichImage: Map<string, RichImage>,
): ParsedQuestion[] {
  const BOUNDARY_RE = /<p[^>]*>\s*<(?:strong|b)[^>]*>\s*(\d{1,3})\s*\./gi;
  const boundaries: { index: number; num: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = BOUNDARY_RE.exec(html)) !== null) {
    boundaries.push({ index: m.index, num: parseInt(m[1], 10) });
  }

  // Keep first occurrence of each question number
  const seen = new Set<number>();
  const unique = boundaries.filter(({ num }) => {
    if (seen.has(num)) return false;
    seen.add(num);
    return true;
  });

  return unique.flatMap(({ index, num }, i) => {
    const end = unique[i + 1]?.index ?? html.length;
    const block = html.slice(index, end);
    try {
      return [buildQuestion(block, num, docXml, urlToRichImage)];
    } catch (e) {
      console.error(`Skipping Q${num} — parse error:`, e);
      return [];
    }
  });
}

function buildQuestion(
  block: string,
  num: number,
  docXml: string,
  urlToRichImage: Map<string, RichImage>,
): ParsedQuestion {
  const lower = block.toLowerCase();
  const omml_detected = detectOmml(docXml, num);

  // ── Collect images referenced in this question block ─────────────────────
  const images: string[] = [];
  const rich_images: RichImage[] = [];
  const IMG_RE = /<img[^>]+src="([^"]+)"/gi;
  let im: RegExpExecArray | null;
  while ((im = IMG_RE.exec(block)) !== null) {
    const url = im[1];
    if (!url) continue;
    images.push(url);
    const ri = urlToRichImage.get(url);
    rich_images.push(ri ?? { url, type: "diagram" });
  }

  // $$…$$ added by equation post-processing also counts as LaTeX
  const has_latex = /\$[^$]+\$/.test(block);

  // ── Detect question type ──────────────────────────────────────────────────
  let type: QuestionType = "scq";
  if (block.includes("<table")) {
    type = "match_column";
  } else if (lower.includes("assertion") && lower.includes("reason")) {
    type = "assertion_reasoning";
  }

  // ── Split stem from options ───────────────────────────────────────────────
  let stemHtml = "";
  let optionsRaw = "";

  if (type === "match_column") {
    const tableIdx = block.indexOf("<table");
    stemHtml = (tableIdx >= 0 ? block.slice(0, tableIdx) : block).trim();
    const tableEnd = block.indexOf("</table>");
    optionsRaw = tableEnd >= 0 ? block.slice(tableEnd + 8) : "";
  } else {
    const splitIdx = indexOfTextOutsideTags(block, "(1)");
    if (splitIdx >= 0) {
      stemHtml = block.slice(0, splitIdx).trim();
      optionsRaw = block.slice(splitIdx);
    } else {
      stemHtml = block.trim();
      if (type === "scq") type = "integer";
    }
  }

  // ── Extract options (1)–(4) ────────────────────────────────────────────────
  let option_1 = "", option_2 = "", option_3 = "", option_4 = "";
  if (type !== "integer") {
    const opts = extractInlineOptions(optionsRaw);
    option_1 = opts[0] ?? "";
    option_2 = opts[1] ?? "";
    option_3 = opts[2] ?? "";
    option_4 = opts[3] ?? "";
  }

  // ── Match column table ────────────────────────────────────────────────────
  let match_col1: MatchEntry[] | null = null;
  let match_col2: MatchEntry[] | null = null;
  if (type === "match_column") {
    const parsed = parseMatchTable(block);
    match_col1 = parsed.col1.length ? parsed.col1 : null;
    match_col2 = parsed.col2.length ? parsed.col2 : null;
  }

  // ── Assertion / reason ────────────────────────────────────────────────────
  let assertion_text: string | null = null;
  let reason_text: string | null = null;
  if (type === "assertion_reasoning") {
    const plain = stemHtml.replace(/<[^>]+>/g, " ");
    const aMatch = /assertion\s*(?:\(a\))?\s*[:\-]?\s*(.*?)(?=reason|$)/is.exec(plain);
    const rMatch = /reason\s*(?:\(r\))?\s*[:\-]?\s*(.*?)$/is.exec(plain);
    assertion_text = aMatch?.[1]?.replace(/\s+/g, " ").trim() ?? null;
    reason_text = rMatch?.[1]?.replace(/\s+/g, " ").trim() ?? null;
  }

  return {
    question_number: num,
    type,
    stem_html: stemHtml,
    option_1,
    option_2,
    option_3,
    option_4,
    correct_options: [],
    correct_integer: null,
    match_col1,
    match_col2,
    assertion_text,
    reason_text,
    images,
    rich_images,
    has_latex,
    omml_detected,
    needs_review: true,
  };
}

// Return the index where `needle` appears outside any HTML tag (< … >).
function indexOfTextOutsideTags(html: string, needle: string): number {
  let inTag = false;
  for (let i = 0; i <= html.length - needle.length; i++) {
    if (html[i] === "<") { inTag = true; continue; }
    if (html[i] === ">") { inTag = false; continue; }
    if (!inTag && html.slice(i, i + needle.length) === needle) return i;
  }
  return -1;
}

// Extract option texts from an inline string like:
//   "(1) 4\t(2) 3\t(3) 2\t(4) 5"  or  "(1) a-P; b-Q\t(2) a-S; b-R\t…"
function extractInlineOptions(html: string): string[] {
  const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const result = ["", "", "", ""];
  const parts = plain.split(/(?=\(\s*[1-4]\s*\))/);
  for (const part of parts) {
    const m = /^\(\s*([1-4])\s*\)\s*(.*)$/.exec(part.trim());
    if (m) {
      const idx = parseInt(m[1], 10) - 1;
      if (idx >= 0 && idx < 4) result[idx] = m[2].trim();
    }
  }
  return result;
}

// Parse first <table> in the block.
// Chemistry.docx match-column table: 4 cells per data row:
//   cell[0]=col-I key, cell[1]=col-I value, cell[2]=col-II key, cell[3]=col-II value
function parseMatchTable(block: string): { col1: MatchEntry[]; col2: MatchEntry[] } {
  const col1: MatchEntry[] = [];
  const col2: MatchEntry[] = [];

  const tableMatch = /<table[\s\S]*?<\/table>/i.exec(block);
  if (!tableMatch) return { col1, col2 };

  const ROW_RE = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowM: RegExpExecArray | null;
  let firstRow = true;
  while ((rowM = ROW_RE.exec(tableMatch[0])) !== null) {
    if (firstRow) { firstRow = false; continue; }

    const cells: string[] = [];
    const CELL_RE = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellM: RegExpExecArray | null;
    while ((cellM = CELL_RE.exec(rowM[1])) !== null) {
      cells.push(cellM[1].replace(/<[^>]+>/g, "").trim());
    }

    if (cells.length >= 4) {
      const k1 = cells[0].replace(/[().]/g, "").trim();
      const k2 = cells[2].replace(/[().]/g, "").trim();
      if (k1) col1.push({ key: k1, value: cells[1] });
      if (k2) col2.push({ key: k2, value: cells[3] });
    } else if (cells.length >= 2) {
      const c1 = /^([a-zA-Z])\s*[.)]\s*(.+)$/s.exec(cells[0]);
      const c2 = /^([A-Z])\s*[.)]\s*(.+)$/s.exec(cells[1]);
      if (c1) col1.push({ key: c1[1], value: c1[2].trim() });
      if (c2) col2.push({ key: c2[1], value: c2[2].trim() });
    }
  }

  return { col1, col2 };
}

// Detect OMML equations near a specific question number in the raw XML
function detectOmml(docXml: string, questionNum: number): boolean {
  if (!docXml.includes("<m:oMath")) return false;

  const numRe = new RegExp(
    `<w:t[^>]*>\\s*${questionNum}\\s*\\.\\s*<\\/w:t>`,
    "g",
  );
  const startMatch = numRe.exec(docXml);
  if (!startMatch) return false;

  const nextRe = new RegExp(
    `<w:t[^>]*>\\s*${questionNum + 1}\\s*\\.\\s*<\\/w:t>`,
    "g",
  );
  nextRe.lastIndex = startMatch.index + 1;
  const nextMatch = nextRe.exec(docXml);
  const end = nextMatch
    ? nextMatch.index
    : Math.min(startMatch.index + 8000, docXml.length);

  return docXml.slice(startMatch.index, end).includes("<m:oMath");
}
