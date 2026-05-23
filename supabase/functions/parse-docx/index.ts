import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-info",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionType = "scq" | "mcq" | "integer" | "match_column" | "assertion_reasoning";

interface MatchEntry { key: string; value: string }

interface ImageRef { url: string }

interface ParsedQuestion {
  question_number: number;
  type: QuestionType;
  stem_html: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  correct_options: number[];
  correct_integer: number | null;
  match_col1: MatchEntry[] | null;
  match_col2: MatchEntry[] | null;
  match_answer: string | null;
  assertion_text: string | null;
  reason_text: string | null;
  images: string[];
  solution_html: string;
  has_latex: boolean;
  needs_review: boolean;
}

// ─── XML helpers ──────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function findNextPara(xml: string, from: number): number {
  let i = from;
  while (i < xml.length) {
    const j = xml.indexOf("<w:p", i);
    if (j < 0) return -1;
    const ch = xml[j + 4];
    if (ch === ">" || ch === " ") return j;
    i = j + 4;
  }
  return -1;
}

function findNextTable(xml: string, from: number): number {
  let i = from;
  while (i < xml.length) {
    const j = xml.indexOf("<w:tbl", i);
    if (j < 0) return -1;
    const ch = xml[j + 6];
    if (ch === ">" || ch === " ") return j;
    i = j + 6;
  }
  return -1;
}

interface Block { kind: "p" | "tbl"; xml: string }

function extractTopLevelBlocks(bodyXml: string): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < bodyXml.length) {
    const pi = findNextPara(bodyXml, i);
    const ti = findNextTable(bodyXml, i);
    if (pi < 0 && ti < 0) break;

    let next: number;
    let kind: "p" | "tbl";
    if (pi < 0) { next = ti; kind = "tbl"; }
    else if (ti < 0) { next = pi; kind = "p"; }
    else if (pi < ti) { next = pi; kind = "p"; }
    else { next = ti; kind = "tbl"; }

    if (kind === "p") {
      const end = bodyXml.indexOf("</w:p>", next);
      if (end < 0) { i = next + 4; continue; }
      blocks.push({ kind: "p", xml: bodyXml.slice(next, end + 6) });
      i = end + 6;
    } else {
      let depth = 1;
      let j = next + 6;
      while (j < bodyXml.length && depth > 0) {
        const nextOpen = findNextTable(bodyXml, j);
        const nextClose = bodyXml.indexOf("</w:tbl>", j);
        if (nextClose < 0) { j = bodyXml.length; break; }
        if (nextOpen >= 0 && nextOpen < nextClose) { depth++; j = nextOpen + 6; }
        else { depth--; j = nextClose + 8; }
      }
      blocks.push({ kind: "tbl", xml: bodyXml.slice(next, j) });
      i = j;
    }
  }
  return blocks;
}

function paraText(paraXml: string): string {
  return [...paraXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1]).join("");
}

function paraIsBold(paraXml: string): boolean {
  return /<w:b[ \/>]/.test(paraXml);
}

function paraImageRids(paraXml: string): string[] {
  return [...paraXml.matchAll(/r:embed="([^"]+)"/g), ...paraXml.matchAll(/r:id="([^"]+)"/g)]
    .map((m) => m[1]);
}

// Build HTML for one <w:p>: text runs (bold preserved) + <img> tags in document order.
function buildParaHtml(paraXml: string, ridToImage: Map<string, ImageRef>): string {
  type Token = { pos: number; html: string };
  const tokens: Token[] = [];

  for (const m of paraXml.matchAll(/<w:r[ >]([\s\S]*?)<\/w:r>/g)) {
    const runXml = m[0];
    if (runXml.includes("<w:drawing>") || runXml.includes("<w:pict>")) continue;
    const isBold = /<w:b[ \/>]/.test(runXml);
    const text = [...runXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((mm) => mm[1]).join("");
    if (text) {
      tokens.push({
        pos: m.index!,
        html: isBold ? `<strong>${escHtml(text)}</strong>` : escHtml(text),
      });
    }
  }

  for (const m of paraXml.matchAll(/<w:drawing>([\s\S]*?)<\/w:drawing>/g)) {
    const rId = /r:embed="([^"]+)"/.exec(m[1])?.[1];
    if (!rId) continue;
    const img = ridToImage.get(rId);
    if (img?.url) tokens.push({ pos: m.index!, html: `<img src="${escHtml(img.url)}" />` });
  }

  for (const m of paraXml.matchAll(/<w:pict>([\s\S]*?)<\/w:pict>/g)) {
    const rId = /r:id="([^"]+)"/.exec(m[1])?.[1] ?? /r:embed="([^"]+)"/.exec(m[1])?.[1];
    if (!rId) continue;
    const img = ridToImage.get(rId);
    if (img?.url) tokens.push({ pos: m.index!, html: `<img src="${escHtml(img.url)}" />` });
  }

  tokens.sort((a, b) => a.pos - b.pos);
  return tokens.map((t) => t.html).join("").trim();
}

// HTML per cell: join inner paragraphs with <br>, preserving images and bold.
function tableCellHtml(tblXml: string, ridToImage: Map<string, ImageRef>): string[][] {
  const rows: string[][] = [];
  for (const rowM of tblXml.matchAll(/<w:tr[ >]([\s\S]*?)<\/w:tr>/g)) {
    const cells: string[] = [];
    for (const cellM of rowM[1].matchAll(/<w:tc[ >]([\s\S]*?)<\/w:tc>/g)) {
      const cellXml = cellM[1];
      const paras: string[] = [];
      let pi = 0;
      while (pi < cellXml.length) {
        const start = findNextPara(cellXml, pi);
        if (start < 0) break;
        const end = cellXml.indexOf("</w:p>", start);
        if (end < 0) break;
        const paraXml = cellXml.slice(start, end + 6);
        const html = buildParaHtml(paraXml, ridToImage);
        if (html) paras.push(html);
        pi = end + 6;
      }
      cells.push(paras.join("<br/>"));
    }
    rows.push(cells);
  }
  return rows;
}

function tableCellTexts(tblXml: string): string[][] {
  const rows: string[][] = [];
  for (const rowM of tblXml.matchAll(/<w:tr[ >]([\s\S]*?)<\/w:tr>/g)) {
    const cells: string[] = [];
    for (const cellM of rowM[1].matchAll(/<w:tc[ >]([\s\S]*?)<\/w:tc>/g)) {
      cells.push(paraText(cellM[1]).trim());
    }
    rows.push(cells);
  }
  return rows;
}

function isMatchTable(tblXml: string): boolean {
  const firstRow = tblXml.match(/<w:tr[ >]([\s\S]*?)<\/w:tr>/)?.[0] ?? "";
  const text = paraText(firstRow).toLowerCase();
  return text.includes("column a") || text.includes("column b") ||
         text.includes("column i") || text.includes("column ii");
}

function parseRelationships(relsXml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of relsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    map.set(m[1], m[2].replace(/^\.?\//, ""));
  }
  return map;
}

// ─── Type / answer detection ──────────────────────────────────────────────────

function detectTypeFromAnswer(raw: string): QuestionType {
  const matches = [...raw.matchAll(/\((\d)\)/g)].map((m) => parseInt(m[1], 10));
  const distinct = [...new Set(matches)];
  if (distinct.length >= 2) return "mcq";
  if (distinct.length === 1) return "scq";

  // Match-column answer pattern: "A-P, B-Q, C-R, D-S" or "A→P; B→Q"
  if (/[A-Da-d]\s*[-→]\s*[P-Sp-s]/.test(raw)) return "match_column";

  // Integer
  if (/^-?\d+(\.\d+)?$/.test(raw.trim())) return "integer";

  return "scq";
}

function parseScqAnswer(raw: string): number[] {
  const m = /\((\d)\)/.exec(raw);
  return m ? [parseInt(m[1], 10)] : [];
}

function parseMcqAnswer(raw: string): number[] {
  const all = [...raw.matchAll(/\((\d)\)/g)].map((m) => parseInt(m[1], 10));
  return [...new Set(all)];
}

function parseIntegerAnswer(raw: string): number | null {
  const m = /(-?\d+(?:\.\d+)?)/.exec(raw);
  return m ? parseFloat(m[1]) : null;
}

// ─── Main document parser ─────────────────────────────────────────────────────

function parseDocument(
  docXml: string,
  ridToImage: Map<string, ImageRef>,
): { questions: ParsedQuestion[]; skipped: number; warnings: string[] } {
  const warnings: string[] = [];
  const questions: ParsedQuestion[] = [];
  let skipped = 0;

  const bodyMatch = /<w:body>([\s\S]*)<\/w:body>/.exec(docXml);
  if (!bodyMatch) return { questions, skipped, warnings: ["Could not locate <w:body> in document XML"] };
  const bodyXml = bodyMatch[1];

  const blocks = extractTopLevelBlocks(bodyXml);

  interface Accum {
    num: number;
    type: QuestionType;       // initial guess; overridden in finalize from answer
    stemParas: string[];
    stemRids: string[];
    optCells: string[][];     // HTML per cell
    matchRows: string[][];    // plain text per cell (for parsing key/value)
    matchRowsHtml: string[][];// HTML per cell (for display)
    answerText: string;
    solutionParas: string[];
    solutionRids: string[];
    inSolution: boolean;
    optionsDone: boolean;
  }

  let accum: Accum | null = null;
  let seenSection = false;

  function finalizeQuestion(a: Accum): void {
    try {
      let stemHtml = a.stemParas.join("<br/>").trim()
        .replace(/^<strong>\s*\d+\s*\.\s*<\/strong>\s*/i, "")
        .replace(/^\d+\s*\.\s+/, "");

      // ── Determine type from answer (override structural defaults) ──────────
      let type: QuestionType = a.type;
      if (a.matchRows.length > 1) {
        type = "match_column";
      } else if (/\bassertion\b/i.test(stemHtml) && /\breason\b/i.test(stemHtml)) {
        type = "assertion_reasoning";
      } else if (a.answerText) {
        type = detectTypeFromAnswer(a.answerText);
      }

      // ── Options (HTML) ────────────────────────────────────────────────────
      let option_1 = "", option_2 = "", option_3 = "", option_4 = "";
      if (type !== "integer" && type !== "match_column") {
        const allCells = a.optCells.flat().filter((c) => c.trim().length > 0);
        for (const cell of allCells) {
          // Allow optional leading <strong> or whitespace around "(N)"
          const m = /^(?:<strong>\s*)?\(([1-4])\)\s*(?:<\/strong>\s*)?([\s\S]*)$/.exec(cell.trim());
          if (m) {
            const idx = parseInt(m[1], 10);
            const val = m[2].trim();
            if (idx === 1) option_1 = val;
            else if (idx === 2) option_2 = val;
            else if (idx === 3) option_3 = val;
            else if (idx === 4) option_4 = val;
          }
        }
        if (!option_1 && !option_2 && allCells.length >= 2) {
          [option_1, option_2, option_3, option_4] = [
            allCells[0] ?? "",
            allCells[1] ?? "",
            allCells[2] ?? "",
            allCells[3] ?? "",
          ];
        }

        // ── Fallback: options inline inside stem, separated by <br/> ──────────
        // Word docs commonly put the question + 4 options in a single paragraph
        // with line breaks between them. In that case neither the paragraph-
        // option detector nor the table extractor fires. Split by <br/> and
        // peel off any segment that starts with "(1)".."(4)".
        if (!option_1 && !option_2 && !option_3 && !option_4) {
          const segments = stemHtml.split(/<br\s*\/?>/i);
          const stemKept: string[] = [];
          const found: Record<number, string> = {};
          for (const seg of segments) {
            const stripped = seg.replace(/<[^>]+>/g, "").trim();
            const m = /^\(([1-4])\)\s*(.*)$/s.exec(stripped);
            if (m) {
              const idx = parseInt(m[1], 10);
              // Strip leading "(N)" + surrounding tags from the HTML segment
              const cleanedHtml = seg
                .replace(/^\s*(?:<[^>]+>\s*)*\(\s*[1-4]\s*\)\s*(?:<\/[^>]+>\s*)*/, "")
                .trim();
              found[idx] = cleanedHtml || m[2].trim();
            } else if (stripped) {
              stemKept.push(seg);
            }
          }
          if (Object.keys(found).length >= 2) {
            option_1 = found[1] ?? "";
            option_2 = found[2] ?? "";
            option_3 = found[3] ?? "";
            option_4 = found[4] ?? "";
            stemHtml = stemKept.join("<br/>").trim();
          }
        }
      }

      // ── Match column ──────────────────────────────────────────────────────
      let match_col1: MatchEntry[] | null = null;
      let match_col2: MatchEntry[] | null = null;
      if (type === "match_column" && a.matchRows.length > 1) {
        const dataRows = a.matchRows.slice(1); // skip header row
        const col1: MatchEntry[] = [];
        const col2: MatchEntry[] = [];
        for (const row of dataRows) {
          if (row.length >= 2) {
            const k1m = /^\(([A-Z])\)\s*([\s\S]+)$/.exec(row[0].trim()) ?? /^([A-Z])[.)]\s*([\s\S]+)$/.exec(row[0].trim());
            const k2m = /^\(([A-Z])\)\s*([\s\S]+)$/.exec(row[1]?.trim() ?? "") ?? /^([A-Z])[.)]\s*([\s\S]+)$/.exec(row[1]?.trim() ?? "");
            if (k1m) col1.push({ key: k1m[1], value: k1m[2].trim() });
            if (k2m) col2.push({ key: k2m[1], value: k2m[2].trim() });
          }
        }
        if (col1.length) match_col1 = col1;
        if (col2.length) match_col2 = col2;
      }

      // ── Answer fields ─────────────────────────────────────────────────────
      let correct_options: number[] = [];
      let correct_integer: number | null = null;
      let match_answer: string | null = null;

      if (a.answerText) {
        if (type === "scq") correct_options = parseScqAnswer(a.answerText);
        else if (type === "mcq") correct_options = parseMcqAnswer(a.answerText);
        else if (type === "integer") correct_integer = parseIntegerAnswer(a.answerText);
        else if (type === "match_column") match_answer = a.answerText.trim();
        else if (type === "assertion_reasoning") correct_options = parseScqAnswer(a.answerText);
      }

      // ── Assertion / Reason extraction (plain text from stem) ──────────────
      let assertion_text: string | null = null;
      let reason_text: string | null = null;
      if (type === "assertion_reasoning") {
        const plain = stemHtml.replace(/<[^>]+>/g, " ");
        const aMatch = /assertion\s*(?:\(a\))?\s*[:\-]?\s*(.*?)(?=reason|$)/is.exec(plain);
        const rMatch = /reason\s*(?:\(r\))?\s*[:\-]?\s*(.*?)$/is.exec(plain);
        assertion_text = aMatch?.[1]?.replace(/\s+/g, " ").trim() ?? null;
        reason_text = rMatch?.[1]?.replace(/\s+/g, " ").trim() ?? null;
      }

      // ── Images: flat URL list (stem + solution) ───────────────────────────
      const allImages: string[] = [];
      for (const rId of [...a.stemRids, ...a.solutionRids]) {
        const img = ridToImage.get(rId);
        if (img?.url && !allImages.includes(img.url)) allImages.push(img.url);
      }

      // ── Solution HTML ─────────────────────────────────────────────────────
      const solution_html = a.solutionParas.join("<br/>").trim();

      const has_latex = /\$[^$\n]+\$/.test(stemHtml) || /\$[^$\n]+\$/.test(solution_html);

      const valid =
        stemHtml.trim().length > 0 &&
        (correct_options.length > 0 ||
          correct_integer !== null ||
          match_answer !== null ||
          match_col1 !== null);

      if (!valid) {
        warnings.push(`Q${a.num}: missing answer — added with needs_review=true`);
      }

      questions.push({
        question_number: a.num,
        type,
        stem_html: stemHtml,
        option_1,
        option_2,
        option_3,
        option_4,
        correct_options,
        correct_integer,
        match_col1,
        match_col2,
        match_answer,
        assertion_text,
        reason_text,
        images: allImages,
        solution_html,
        has_latex,
        needs_review: true,
      });
    } catch (e) {
      warnings.push(`Q${a.num}: parse error — ${e instanceof Error ? e.message : e}`);
      skipped++;
    }
  }

  for (const block of blocks) {
    if (block.kind === "p") {
      const text = paraText(block.xml).trim();
      const bold = paraIsBold(block.xml);

      // Skip SECTION header lines (descriptive — type is auto-detected from the answer)
      if (/^SECTION\s+(I|II|III|IV|V|VI|VII)/i.test(text)) {
        if (accum) { finalizeQuestion(accum); accum = null; }
        seenSection = true;
        continue;
      }

      // Skip everything before the first SECTION header (cover page, instruction list, etc.)
      if (!seenSection) { skipped++; continue; }

      // Skip italic descriptor sub-line under section header (contains pipes + "Exam:")
      if (text.includes("|") && /exam\s*:/i.test(text)) continue;

      // Solution accumulation — must precede question-boundary test
      if (accum?.inSolution) {
        if (bold && /^\d+\.\s+\S/.test(text)) {
          // Fall through to start a new question
        } else {
          const h = buildParaHtml(block.xml, ridToImage);
          if (h) accum.solutionParas.push(h);
          accum.solutionRids.push(...paraImageRids(block.xml));
          continue;
        }
      }

      // Question boundary (bold-numbered)
      if (bold && /^\d+\.\s+\S/.test(text)) {
        if (accum) finalizeQuestion(accum);
        const numMatch = /^(\d+)\.\s+/.exec(text);
        const stemHtmlFull = buildParaHtml(block.xml, ridToImage);
        const stemHtmlClean = stemHtmlFull
          .replace(/^<strong>\s*\d+\s*\.\s*<\/strong>\s*/i, "")
          .replace(/^\d+\s*\.\s+/, "");
        accum = {
          num: parseInt(numMatch?.[1] ?? "0", 10),
          type: "scq",
          stemParas: [stemHtmlClean],
          stemRids: paraImageRids(block.xml),
          optCells: [],
          matchRows: [],
          matchRowsHtml: [],
          answerText: "",
          solutionParas: [],
          solutionRids: [],
          inSolution: false,
          optionsDone: false,
        };
        continue;
      }

      if (!accum) { skipped++; continue; }

      // Answer line
      if (/^answer\s*:/i.test(text)) {
        accum.answerText = text.replace(/^answer\s*:\s*/i, "").trim();
        accum.optionsDone = true;
        continue;
      }

      // Solution line
      if (/^solution\s*:?/i.test(text)) {
        accum.inSolution = true;
        const restHtml = buildParaHtml(block.xml, ridToImage)
          .replace(/^(?:<strong>\s*)?solution\s*:?\s*(?:<\/strong>\s*)?/i, "");
        if (restHtml.trim()) accum.solutionParas.push(restHtml);
        accum.solutionRids.push(...paraImageRids(block.xml));
        continue;
      }

      // Default: stem continuation or inline option paragraph
      if (!accum.optionsDone) {
        const rawText = paraText(block.xml).trim();
        const h = buildParaHtml(block.xml, ridToImage);
        // Option paragraph on its own line: starts with (1), (2), (3), or (4)
        if (/^\([1-4]\)\s/.test(rawText) && h) {
          accum.optCells.push([h]);
        } else if (h) {
          accum.stemParas.push(h);
          accum.stemRids.push(...paraImageRids(block.xml));
        }
      }
    } else {
      // Table block
      if (!accum) { skipped++; continue; }
      if (accum.optionsDone) continue;

      if (isMatchTable(block.xml)) {
        accum.matchRows = tableCellTexts(block.xml);
        accum.matchRowsHtml = tableCellHtml(block.xml, ridToImage);
        accum.type = "match_column";
        accum.optionsDone = true;
      } else {
        accum.optCells = tableCellHtml(block.xml, ridToImage);
        accum.optionsDone = true;
      }
    }
  }

  if (accum) finalizeQuestion(accum);

  return { questions, skipped, warnings };
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

    // ── 1. Unzip ──────────────────────────────────────────────────────────────
    const uint8 = new Uint8Array(await file.arrayBuffer());
    const unzipped = unzipSync(uint8);

    const docXmlBytes = unzipped["word/document.xml"];
    const docXml = docXmlBytes ? new TextDecoder().decode(docXmlBytes) : "";

    const relsBytes = unzipped["word/_rels/document.xml.rels"];
    const relsXml = relsBytes ? new TextDecoder().decode(relsBytes) : "";

    const mediaEntries = Object.entries(unzipped)
      .filter(([p]) => p.startsWith("word/media/"))
      .sort(([a], [b]) => a.localeCompare(b));

    // ── 2. Upload all media to Storage ────────────────────────────────────────
    const uploadResults = await Promise.all(
      mediaEntries.map(async ([path, data]) => {
        const ext = path.split(".").pop()?.toLowerCase() ?? "png";
        const uuid = crypto.randomUUID();
        const storagePath = `${paperId}/${uuid}.${ext}`;
        const contentType =
          ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
            ext === "gif" ? "image/gif" :
              ext === "svg" ? "image/svg+xml" :
                ext === "wmf" || ext === "emf" ? "image/png" :
                  "image/png";

        const { error } = await admin.storage
          .from("question-images")
          .upload(storagePath, data, { contentType, upsert: false });

        if (error) {
          console.error(`Upload failed ${path}:`, error.message);
          return { mediaPath: path.replace("word/", ""), url: "" };
        }
        const { data: urlData } = admin.storage.from("question-images").getPublicUrl(storagePath);
        return { mediaPath: path.replace("word/", ""), url: urlData.publicUrl };
      }),
    );

    // ── 3. Build rId → ImageRef map ──────────────────────────────────────────
    const rIdToPath = parseRelationships(relsXml);
    const pathToImage = new Map<string, ImageRef>();
    uploadResults.forEach(({ mediaPath, url }) => {
      if (url) pathToImage.set(mediaPath, { url });
    });
    const ridToImage = new Map<string, ImageRef>();
    for (const [rId, target] of rIdToPath) {
      const img = pathToImage.get(target);
      if (img) ridToImage.set(rId, img);
    }

    // ── 4. Parse document ─────────────────────────────────────────────────────
    const { questions, skipped, warnings } = parseDocument(docXml, ridToImage);

    return respond({ questions, skipped, warnings });
  } catch (e) {
    console.error("parse-docx error", e);
    return respond({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
