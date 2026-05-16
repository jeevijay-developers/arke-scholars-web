import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";
import mammoth from "https://esm.sh/mammoth@1.8.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-info",
};

// ─── Types ──────────────────────────────────────────────────────────────────

type QuestionType = "scq" | "mcq" | "integer" | "match_column" | "assertion_reasoning";

interface MatchEntry { key: string; value: string }

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
  images: string[];
  has_latex: boolean;
  omml_detected: boolean;
  needs_review: boolean;
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
    const admin = createClient(supabaseUrl, serviceKey);

    // ── 1. Read the docx as ArrayBuffer ────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // ── 2. Unzip — extract images and the raw document XML ─────────────────
    const unzipped = unzipSync(uint8);

    const docXmlBytes = unzipped["word/document.xml"];
    const docXml = docXmlBytes ? new TextDecoder().decode(docXmlBytes) : "";

    // Sort media files alphabetically — Word adds them in document order,
    // which typically matches alphabetical order (image1.png, image2.png…)
    const mediaEntries = Object.entries(unzipped)
      .filter(([path]) => path.startsWith("word/media/"))
      .sort(([a], [b]) => a.localeCompare(b));

    // ── 3. Upload all images to Storage, collect public URLs ────────────────
    const uploadedUrls: string[] = [];

    for (const [path, data] of mediaEntries) {
      const ext = path.split(".").pop()?.toLowerCase() ?? "png";
      const uuid = crypto.randomUUID();
      const storagePath = `${paperId}/${uuid}.${ext}`;
      const contentType =
        ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
        ext === "gif" ? "image/gif" :
        "image/png";

      const { error } = await admin.storage
        .from("question-images")
        .upload(storagePath, data, { contentType, upsert: false });

      if (error) {
        console.error(`Image upload failed for ${path}:`, error.message);
        uploadedUrls.push("");
      } else {
        const { data: urlData } = admin.storage
          .from("question-images")
          .getPublicUrl(storagePath);
        uploadedUrls.push(urlData.publicUrl);
      }
    }

    // ── 4. Convert docx → HTML via mammoth ─────────────────────────────────
    // Sequential image mapping: mammoth processes images in document order,
    // which matches the sorted word/media/ order used above.
    let imgIdx = 0;
    const mammothResult = await mammoth.convertToHtml(
      { arrayBuffer },
      {
        convertImage: mammoth.images.imgElement((_img: unknown) => {
          return Promise.resolve({ src: uploadedUrls[imgIdx++] ?? "" });
        }),
      },
    );

    const html: string = mammothResult.value;

    // ── 5. Parse HTML into question objects ─────────────────────────────────
    const questions = parseQuestions(html, docXml);

    return respond({ questions });
  } catch (e) {
    console.error("parse-docx error", e);
    return respond({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

// ─── Question parser ──────────────────────────────────────────────────────────

function parseQuestions(html: string, docXml: string): ParsedQuestion[] {
  // mammoth renders bold as <strong>. Question numbers are bold-formatted
  // at the start of a paragraph: <p><strong>46.</strong> stem text…
  // Also handle the case where the whole paragraph is bold:
  // <p><strong>46. stem text…</strong>
  const BOUNDARY_RE = /<p[^>]*>\s*<(?:strong|b)[^>]*>\s*(\d{1,3})\s*\./gi;

  const boundaries: { index: number; num: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = BOUNDARY_RE.exec(html)) !== null) {
    boundaries.push({ index: m.index, num: parseInt(m[1], 10) });
  }

  // Deduplicate by question number (keep first occurrence)
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
      return [buildQuestion(block, num, docXml)];
    } catch (e) {
      console.error(`Skipping question ${num} — parse error:`, e);
      return [];
    }
  });
}

function buildQuestion(block: string, num: number, docXml: string): ParsedQuestion {
  const lower = block.toLowerCase();

  // Detect OMML (Word equation editor) for this question
  const omml_detected = detectOmml(docXml, num);

  // Detect any $…$ or $$…$$ LaTeX markers
  const has_latex = /\$[^$]+\$/.test(block);

  // Collect Storage URLs of embedded images
  const images: string[] = [];
  const IMG_RE = /<img[^>]+src="([^"]+)"/gi;
  let im: RegExpExecArray | null;
  while ((im = IMG_RE.exec(block)) !== null) {
    images.push(im[1]);
  }

  // ── Detect question type ─────────────────────────────────────────────────
  let type: QuestionType = "scq";

  if (block.includes("<table")) {
    type = "match_column";
  } else if (lower.includes("assertion") && lower.includes("reason")) {
    type = "assertion_reasoning";
  }

  // ── Split stem from options ───────────────────────────────────────────────
  // Options start with (1), (2), (3), (4) in their own paragraphs
  const OPT_START_RE = /<p[^>]*>\s*(?:<[^>]+>)?\s*\(\s*1\s*\)/i;
  const optMatch = type === "match_column" ? null : OPT_START_RE.exec(block);

  const stemHtml = optMatch ? block.slice(0, optMatch.index).trim() : block.trim();
  const optionsHtml = optMatch ? block.slice(optMatch.index) : "";

  // Integer type: no options found, not a table, not assertion-reasoning
  if (type === "scq" && !optMatch) type = "integer";

  // ── Extract options (1)–(4) ───────────────────────────────────────────────
  let option_1 = "", option_2 = "", option_3 = "", option_4 = "";

  if (type === "scq" || type === "mcq") {
    const opts = extractOptions(optionsHtml);
    option_1 = opts[0] ?? "";
    option_2 = opts[1] ?? "";
    option_3 = opts[2] ?? "";
    option_4 = opts[3] ?? "";
  }

  // ── Extract assertion / reason text ──────────────────────────────────────
  let assertion_text: string | null = null;
  let reason_text: string | null = null;

  if (type === "assertion_reasoning") {
    const plain = stemHtml.replace(/<[^>]+>/g, " ");
    const aMatch = /assertion\s*(?:\(a\))?\s*[:\-]?\s*(.*?)(?=reason|$)/is.exec(plain);
    const rMatch = /reason\s*(?:\(r\))?\s*[:\-]?\s*(.*?)$/is.exec(plain);
    assertion_text = aMatch?.[1]?.replace(/\s+/g, " ").trim() ?? null;
    reason_text = rMatch?.[1]?.replace(/\s+/g, " ").trim() ?? null;
  }

  // ── Parse match-column table ──────────────────────────────────────────────
  let match_col1: MatchEntry[] | null = null;
  let match_col2: MatchEntry[] | null = null;

  if (type === "match_column") {
    const parsed = parseMatchTable(block);
    match_col1 = parsed.col1.length ? parsed.col1 : null;
    match_col2 = parsed.col2.length ? parsed.col2 : null;
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
    has_latex,
    omml_detected,
    needs_review: true,
  };
}

// Extract text of options (1)–(4) from the HTML block after the stem
function extractOptions(html: string): string[] {
  const result: string[] = ["", "", "", ""];
  const PARA_RE = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;

  while ((m = PARA_RE.exec(html)) !== null) {
    const inner = m[1];
    const stripped = inner.replace(/<[^>]+>/g, "").trim();
    const match = /^\(\s*([1-4])\s*\)\s*(.*)$/s.exec(stripped);
    if (match) {
      const idx = parseInt(match[1], 10) - 1;
      // Preserve the inner HTML (may contain <img> or <strong>)
      result[idx] = inner
        .replace(/^\s*(?:<[^>]+>)?\s*\(\s*[1-4]\s*\)\s*(?:<\/[^>]+>)?\s*/, "")
        .trim();
    }
  }

  return result;
}

// Parse the first <table> in the block into two column arrays
function parseMatchTable(block: string): { col1: MatchEntry[]; col2: MatchEntry[] } {
  const col1: MatchEntry[] = [];
  const col2: MatchEntry[] = [];

  const tableMatch = /<table[\s\S]*?<\/table>/i.exec(block);
  if (!tableMatch) return { col1, col2 };

  const tableHtml = tableMatch[0];
  const ROW_RE = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowM: RegExpExecArray | null;
  let firstRow = true;

  while ((rowM = ROW_RE.exec(tableHtml)) !== null) {
    if (firstRow) { firstRow = false; continue; } // skip header

    const cells: string[] = [];
    const CELL_RE = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellM: RegExpExecArray | null;
    while ((cellM = CELL_RE.exec(rowM[1])) !== null) {
      cells.push(cellM[1].replace(/<[^>]+>/g, "").trim());
    }

    if (cells.length >= 1) {
      const c1 = /^([a-zA-Z])\s*[.)\s]\s*(.*)$/s.exec(cells[0]);
      if (c1) col1.push({ key: c1[1], value: c1[2].trim() });
    }
    if (cells.length >= 2) {
      const c2 = /^([A-Z])\s*[.)\s]\s*(.*)$/s.exec(cells[1]);
      if (c2) col2.push({ key: c2[1], value: c2[2].trim() });
    }
  }

  return { col1, col2 };
}

// Detect OMML equations near a specific question number in the raw document XML
function detectOmml(docXml: string, questionNum: number): boolean {
  if (!docXml.includes("<m:oMath")) return false;

  // Find the XML text node that contains "N." (the question number marker)
  const numRe = new RegExp(
    `<w:t[^>]*>\\s*${questionNum}\\s*\\.\\s*<\\/w:t>`,
    "g",
  );
  const startMatch = numRe.exec(docXml);
  if (!startMatch) return false;

  // Boundary: start of the next question number in the XML
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
