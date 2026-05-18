// Local test harness for parse-docx — runs the same parsing logic against a .docx file
// without uploading to Supabase. Images are referenced by media path only.
//
// Usage: node scripts/test-parse-docx.mjs <path-to-docx>

import { unzipSync } from "fflate";
import { readFileSync } from "node:fs";

// ───────── inlined parser (must match supabase/functions/parse-docx/index.ts) ─────────

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function findNextPara(xml, from) {
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
function findNextTable(xml, from) {
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
function extractTopLevelBlocks(bodyXml) {
  const blocks = [];
  let i = 0;
  while (i < bodyXml.length) {
    const pi = findNextPara(bodyXml, i);
    const ti = findNextTable(bodyXml, i);
    if (pi < 0 && ti < 0) break;
    let next, kind;
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
function paraText(paraXml) {
  return [...paraXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");
}
function paraIsBold(paraXml) {
  return /<w:b[ \/>]/.test(paraXml);
}
function paraImageRids(paraXml) {
  return [...paraXml.matchAll(/r:embed="([^"]+)"/g), ...paraXml.matchAll(/r:id="([^"]+)"/g)].map((m) => m[1]);
}
function buildParaHtml(paraXml, ridToImage) {
  const tokens = [];
  for (const m of paraXml.matchAll(/<w:r[ >]([\s\S]*?)<\/w:r>/g)) {
    const runXml = m[0];
    if (runXml.includes("<w:drawing>") || runXml.includes("<w:pict>")) continue;
    const isBold = /<w:b[ \/>]/.test(runXml);
    const text = [...runXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((mm) => mm[1]).join("");
    if (text) tokens.push({ pos: m.index, html: isBold ? `<strong>${escHtml(text)}</strong>` : escHtml(text) });
  }
  for (const m of paraXml.matchAll(/<w:drawing>([\s\S]*?)<\/w:drawing>/g)) {
    const rId = /r:embed="([^"]+)"/.exec(m[1])?.[1];
    if (!rId) continue;
    const img = ridToImage.get(rId);
    if (img?.url) tokens.push({ pos: m.index, html: `<img src="${escHtml(img.url)}" />` });
  }
  for (const m of paraXml.matchAll(/<w:pict>([\s\S]*?)<\/w:pict>/g)) {
    const rId = /r:id="([^"]+)"/.exec(m[1])?.[1] ?? /r:embed="([^"]+)"/.exec(m[1])?.[1];
    if (!rId) continue;
    const img = ridToImage.get(rId);
    if (img?.url) tokens.push({ pos: m.index, html: `<img src="${escHtml(img.url)}" />` });
  }
  tokens.sort((a, b) => a.pos - b.pos);
  return tokens.map((t) => t.html).join("").trim();
}
function tableCellHtml(tblXml, ridToImage) {
  const rows = [];
  for (const rowM of tblXml.matchAll(/<w:tr[ >]([\s\S]*?)<\/w:tr>/g)) {
    const cells = [];
    for (const cellM of rowM[1].matchAll(/<w:tc[ >]([\s\S]*?)<\/w:tc>/g)) {
      const cellXml = cellM[1];
      const paras = [];
      let pi = 0;
      while (pi < cellXml.length) {
        const start = findNextPara(cellXml, pi);
        if (start < 0) break;
        const end = cellXml.indexOf("</w:p>", start);
        if (end < 0) break;
        const html = buildParaHtml(cellXml.slice(start, end + 6), ridToImage);
        if (html) paras.push(html);
        pi = end + 6;
      }
      cells.push(paras.join("<br/>"));
    }
    rows.push(cells);
  }
  return rows;
}
function tableCellTexts(tblXml) {
  const rows = [];
  for (const rowM of tblXml.matchAll(/<w:tr[ >]([\s\S]*?)<\/w:tr>/g)) {
    const cells = [];
    for (const cellM of rowM[1].matchAll(/<w:tc[ >]([\s\S]*?)<\/w:tc>/g)) cells.push(paraText(cellM[1]).trim());
    rows.push(cells);
  }
  return rows;
}
function isMatchTable(tblXml) {
  const firstRow = tblXml.match(/<w:tr[ >]([\s\S]*?)<\/w:tr>/)?.[0] ?? "";
  const text = paraText(firstRow).toLowerCase();
  return text.includes("column a") || text.includes("column b") || text.includes("column i") || text.includes("column ii");
}
function parseRelationships(relsXml) {
  const map = new Map();
  for (const m of relsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) map.set(m[1], m[2].replace(/^\.?\//, ""));
  return map;
}
function detectTypeFromAnswer(raw) {
  const matches = [...raw.matchAll(/\((\d)\)/g)].map((m) => parseInt(m[1], 10));
  const distinct = [...new Set(matches)];
  if (distinct.length >= 2) return "mcq";
  if (distinct.length === 1) return "scq";
  if (/[A-Da-d]\s*[-→]\s*[P-Sp-s]/.test(raw)) return "match_column";
  if (/^-?\d+(\.\d+)?$/.test(raw.trim())) return "integer";
  return "scq";
}
function parseScqAnswer(raw) { const m = /\((\d)\)/.exec(raw); return m ? [parseInt(m[1], 10)] : []; }
function parseMcqAnswer(raw) { const all = [...raw.matchAll(/\((\d)\)/g)].map((m) => parseInt(m[1], 10)); return [...new Set(all)]; }
function parseIntegerAnswer(raw) { const m = /(-?\d+(?:\.\d+)?)/.exec(raw); return m ? parseFloat(m[1]) : null; }

function parseDocument(docXml, ridToImage) {
  const warnings = [];
  const questions = [];
  let skipped = 0;
  const bodyMatch = /<w:body>([\s\S]*)<\/w:body>/.exec(docXml);
  if (!bodyMatch) return { questions, skipped, warnings: ["no body"] };
  const blocks = extractTopLevelBlocks(bodyMatch[1]);
  let accum = null;
  let seenSection = false;

  function finalize(a) {
    try {
      const stemHtml = a.stemParas.join("<br/>").trim()
        .replace(/^<strong>\s*\d+\s*\.\s*<\/strong>\s*/i, "")
        .replace(/^\d+\s*\.\s+/, "");
      let type = a.type;
      if (a.matchRows.length > 1) type = "match_column";
      else if (/\bassertion\b/i.test(stemHtml) && /\breason\b/i.test(stemHtml)) type = "assertion_reasoning";
      else if (a.answerText) type = detectTypeFromAnswer(a.answerText);

      let o1="",o2="",o3="",o4="";
      if (type !== "integer" && type !== "match_column") {
        const cells = a.optCells.flat().filter((c) => c.trim().length > 0);
        for (const cell of cells) {
          const m = /^(?:<strong>\s*)?\(([1-4])\)\s*(?:<\/strong>\s*)?([\s\S]*)$/.exec(cell.trim());
          if (m) {
            const idx = parseInt(m[1], 10);
            const val = m[2].trim();
            if (idx===1) o1=val; else if (idx===2) o2=val; else if (idx===3) o3=val; else if (idx===4) o4=val;
          }
        }
        if (!o1 && !o2 && cells.length >= 2) [o1,o2,o3,o4] = [cells[0]??"",cells[1]??"",cells[2]??"",cells[3]??""];
      }

      let m1=null, m2=null;
      if (type === "match_column" && a.matchRows.length > 1) {
        const dataRows = a.matchRows.slice(1);
        const c1=[], c2=[];
        for (const row of dataRows) {
          if (row.length >= 2) {
            const km1 = /^\(([A-Z])\)\s*([\s\S]+)$/.exec(row[0].trim()) ?? /^([A-Z])[.)]\s*([\s\S]+)$/.exec(row[0].trim());
            const km2 = /^\(([A-Z])\)\s*([\s\S]+)$/.exec(row[1]?.trim() ?? "") ?? /^([A-Z])[.)]\s*([\s\S]+)$/.exec(row[1]?.trim() ?? "");
            if (km1) c1.push({key:km1[1], value:km1[2].trim()});
            if (km2) c2.push({key:km2[1], value:km2[2].trim()});
          }
        }
        if (c1.length) m1=c1; if (c2.length) m2=c2;
      }

      let correct_options=[], correct_integer=null, match_answer=null;
      if (a.answerText) {
        if (type === "scq") correct_options = parseScqAnswer(a.answerText);
        else if (type === "mcq") correct_options = parseMcqAnswer(a.answerText);
        else if (type === "integer") correct_integer = parseIntegerAnswer(a.answerText);
        else if (type === "match_column") match_answer = a.answerText.trim();
        else if (type === "assertion_reasoning") correct_options = parseScqAnswer(a.answerText);
      }

      let assertion_text=null, reason_text=null;
      if (type === "assertion_reasoning") {
        const plain = stemHtml.replace(/<[^>]+>/g, " ");
        const am = /assertion\s*(?:\(a\))?\s*[:\-]?\s*(.*?)(?=reason|$)/is.exec(plain);
        const rm = /reason\s*(?:\(r\))?\s*[:\-]?\s*(.*?)$/is.exec(plain);
        assertion_text = am?.[1]?.replace(/\s+/g, " ").trim() ?? null;
        reason_text = rm?.[1]?.replace(/\s+/g, " ").trim() ?? null;
      }

      const allImages = [];
      for (const rId of [...a.stemRids, ...a.solutionRids]) {
        const img = ridToImage.get(rId);
        if (img?.url && !allImages.includes(img.url)) allImages.push(img.url);
      }
      const solution_html = a.solutionParas.join("<br/>").trim();
      const has_latex = /\$[^$\n]+\$/.test(stemHtml) || /\$[^$\n]+\$/.test(solution_html);
      const valid = stemHtml.trim().length > 0 && (correct_options.length>0 || correct_integer!==null || match_answer!==null || m1!==null);
      if (!valid) warnings.push(`Q${a.num}: missing answer`);

      questions.push({
        question_number: a.num, type, stem_html: stemHtml,
        option_1: o1, option_2: o2, option_3: o3, option_4: o4,
        correct_options, correct_integer,
        match_col1: m1, match_col2: m2, match_answer,
        assertion_text, reason_text,
        images: allImages, solution_html, has_latex, needs_review: true,
      });
    } catch (e) {
      warnings.push(`Q${a.num}: ${e.message}`);
      skipped++;
    }
  }

  for (const block of blocks) {
    if (block.kind === "p") {
      const text = paraText(block.xml).trim();
      const bold = paraIsBold(block.xml);
      if (/^SECTION\s+(I|II|III|IV|V|VI|VII)/i.test(text)) {
        if (accum) { finalize(accum); accum = null; }
        seenSection = true;
        continue;
      }
      if (!seenSection) { skipped++; continue; }
      if (text.includes("|") && /exam\s*:/i.test(text)) continue;

      if (accum?.inSolution) {
        if (bold && /^\d+\.\s+\S/.test(text)) { /* fall through */ }
        else {
          const h = buildParaHtml(block.xml, ridToImage);
          if (h) accum.solutionParas.push(h);
          accum.solutionRids.push(...paraImageRids(block.xml));
          continue;
        }
      }
      if (bold && /^\d+\.\s+\S/.test(text)) {
        if (accum) finalize(accum);
        const numMatch = /^(\d+)\.\s+/.exec(text);
        const stemHtmlFull = buildParaHtml(block.xml, ridToImage);
        const stemHtmlClean = stemHtmlFull
          .replace(/^<strong>\s*\d+\s*\.\s*<\/strong>\s*/i, "")
          .replace(/^\d+\s*\.\s+/, "");
        accum = {
          num: parseInt(numMatch?.[1] ?? "0", 10), type: "scq",
          stemParas: [stemHtmlClean], stemRids: paraImageRids(block.xml),
          optCells: [], matchRows: [], matchRowsHtml: [],
          answerText: "", solutionParas: [], solutionRids: [],
          inSolution: false, optionsDone: false,
        };
        continue;
      }
      if (!accum) { skipped++; continue; }
      if (/^answer\s*:/i.test(text)) {
        accum.answerText = text.replace(/^answer\s*:\s*/i, "").trim();
        accum.optionsDone = true;
        continue;
      }
      if (/^solution\s*:?/i.test(text)) {
        accum.inSolution = true;
        const restHtml = buildParaHtml(block.xml, ridToImage)
          .replace(/^(?:<strong>\s*)?solution\s*:?\s*(?:<\/strong>\s*)?/i, "");
        if (restHtml.trim()) accum.solutionParas.push(restHtml);
        accum.solutionRids.push(...paraImageRids(block.xml));
        continue;
      }
      if (!accum.optionsDone) {
        const h = buildParaHtml(block.xml, ridToImage);
        if (h) accum.stemParas.push(h);
        accum.stemRids.push(...paraImageRids(block.xml));
      }
    } else {
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
  if (accum) finalize(accum);
  return { questions, skipped, warnings };
}

// ───────── main ─────────

const path = process.argv[2];
if (!path) { console.error("usage: node test-parse-docx.mjs <docx>"); process.exit(1); }

const buf = readFileSync(path);
const zip = unzipSync(new Uint8Array(buf));
const docXml = new TextDecoder().decode(zip["word/document.xml"]);
const relsXml = new TextDecoder().decode(zip["word/_rels/document.xml.rels"] ?? new Uint8Array());

const rIdToPath = parseRelationships(relsXml);
const ridToImage = new Map();
for (const [rId, target] of rIdToPath) {
  if (target.startsWith("media/")) ridToImage.set(rId, { url: `https://storage.example/${target}` });
}

const { questions, skipped, warnings } = parseDocument(docXml, ridToImage);
console.log(JSON.stringify({ count: questions.length, skipped, warnings, questions }, null, 2));
