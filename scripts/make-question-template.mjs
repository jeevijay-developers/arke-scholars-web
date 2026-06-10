/**
 * Generates arke-question-template.docx — the Arke Scholars question paper template.
 *
 * Run: node scripts/make-question-template.mjs
 * Output: public/arke-question-template.docx
 *
 * Paragraph styles read by parse-docx:
 *   Q-Number   bold numbered line       "1."
 *   Q-Stem     question text
 *   Q-Option   each option              "(1) length and mass"
 *   Q-Answer   correct answer line      "Answer: (3)"
 *   Q-Solution solution explanation
 *   Q-Topic    topic label              "Topic: Kinematics"
 *
 * Equations: write LaTeX inside $...$ for inline math or $$...$$ for display.
 * The parser also reads Word's built-in equation objects (Alt+=).
 *
 * Match-the-Following: place a 2-column table (header row "Column A" | "Column B",
 * data rows "(A) item" | "(P) item") immediately after the Q-Stem paragraph.
 * Set Answer to "Answer: A-P, B-Q, C-R, D-S".
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, convertInchesToTwip,
} from "docx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// ── Style definitions ─────────────────────────────────────────────────────────

const BASE_FONT = "Times New Roman";
const BASE_SIZE = 24; // 12pt in half-points

function makeStyle(id, name, opts = {}) {
  return {
    id,
    name,
    basedOn: "Normal",
    next: opts.next ?? "Normal",
    quickFormat: true,
    run: {
      font: BASE_FONT,
      size: opts.size ?? BASE_SIZE,
      bold: opts.bold ?? false,
      color: opts.color ?? "000000",
      italics: opts.italic ?? false,
    },
    paragraph: {
      spacing: { before: opts.spaceBefore ?? 80, after: opts.spaceAfter ?? 40 },
      indent: opts.indent ? { left: convertInchesToTwip(opts.indent) } : undefined,
      alignment: opts.align ?? AlignmentType.JUSTIFIED,
    },
  };
}

const paragraphStyles = [
  makeStyle("Q-Number", "Q-Number", { bold: true, size: 24, spaceBefore: 160, spaceAfter: 40, next: "Q-Stem" }),
  makeStyle("Q-Stem",   "Q-Stem",   { size: 24, spaceBefore: 40, spaceAfter: 40, next: "Q-Option" }),
  makeStyle("Q-Option", "Q-Option", { size: 24, indent: 0.3, spaceBefore: 20, spaceAfter: 20, next: "Q-Option" }),
  makeStyle("Q-Answer", "Q-Answer", { bold: true, color: "1a7a3c", size: 22, spaceBefore: 60, spaceAfter: 20, next: "Q-Solution" }),
  makeStyle("Q-Solution","Q-Solution",{ italic: true, color: "444444", size: 22, spaceBefore: 20, spaceAfter: 80, next: "Q-Number" }),
  makeStyle("Q-Topic",  "Q-Topic",  { color: "666666", size: 20, spaceBefore: 160, spaceAfter: 40, next: "Q-Number" }),
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const p = (style, text, extra = {}) =>
  new Paragraph({ style, children: [new TextRun({ text, font: BASE_FONT, ...extra })] });

const plain = (text, extra = {}) =>
  new Paragraph({ children: [new TextRun({ text, font: BASE_FONT, size: BASE_SIZE, ...extra })] });

const hr = () =>
  new Paragraph({
    children: [new TextRun({ text: "─".repeat(60), color: "cccccc", size: 18 })],
    spacing: { before: 120, after: 120 },
  });

const sectionHeader = (text) =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26, font: BASE_FONT })],
    spacing: { before: 200, after: 80 },
  });

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" };
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

/** Build a match-the-following table. colA/colB are arrays of { key, value } */
function matchTable(colA, colB) {
  const maxRows = Math.max(colA.length, colB.length);
  const headerRow = new TableRow({
    children: [
      new TableCell({
        borders,
        width: { size: 4320, type: WidthType.DXA },
        shading: { fill: "E8EDF5" },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: "Column A", bold: true, font: BASE_FONT, size: 22 })] })],
      }),
      new TableCell({
        borders,
        width: { size: 4320, type: WidthType.DXA },
        shading: { fill: "E8EDF5" },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: "Column B", bold: true, font: BASE_FONT, size: 22 })] })],
      }),
    ],
  });

  const dataRows = Array.from({ length: maxRows }, (_, i) =>
    new TableRow({
      children: [
        new TableCell({
          borders,
          width: { size: 4320, type: WidthType.DXA },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: colA[i] ? `(${colA[i].key}) ${colA[i].value}` : "", font: BASE_FONT, size: 22 })] })],
        }),
        new TableCell({
          borders,
          width: { size: 4320, type: WidthType.DXA },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: colB[i] ? `(${colB[i].key}) ${colB[i].value}` : "", font: BASE_FONT, size: 22 })] })],
        }),
      ],
    })
  );

  return new Table({
    width: { size: 8640, type: WidthType.DXA },
    columnWidths: [4320, 4320],
    rows: [headerRow, ...dataRows],
  });
}

// ── Document ──────────────────────────────────────────────────────────────────

const doc = new Document({
  styles: { paragraphStyles },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 }, // US Letter
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [

        // ── Cover ─────────────────────────────────────────────────────────
        new Paragraph({
          children: [new TextRun({ text: "ARKE SCHOLARS — Question Paper Template", bold: true, size: 32, font: BASE_FONT, color: "1a3a7a" })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 240 },
        }),

        plain("Apply the paragraph styles (Home → Styles panel) to each part of every question. The Arke system reads these styles to import questions automatically.", { size: 22 }),
        new Paragraph({ spacing: { before: 0, after: 120 } }), // spacer

        // Style reference
        ...([
          "Q-Number   →  Bold line with the question number only.    Example:  1.",
          "Q-Stem     →  Question text (one or more paragraphs).",
          "Q-Option   →  Each answer option.                         Example:  (1) Only A",
          "Q-Answer   →  Correct answer.                             Example:  Answer: (3)",
          "Q-Solution →  Full solution (one or more paragraphs).",
          "Q-Topic    →  Optional topic label.                       Example:  Topic: Kinematics",
        ].map((line) =>
          new Paragraph({
            children: [new TextRun({ text: line, size: 19, font: "Courier New" })],
            spacing: { before: 30, after: 30 },
          })
        )),

        new Paragraph({ spacing: { before: 0, after: 80 } }),
        plain("Equations: type LaTeX inside $...$ for inline math or $$...$$ for display math. Alternatively, use Word's built-in equation editor (Alt + =) — both formats are imported correctly.", { size: 21, italics: true, color: "555555" }),
        plain("Match-the-Following: after the Q-Stem paragraph, insert a 2-column table whose header row contains \"Column A\" and \"Column B\". Data rows use the format (A) item / (P) item.", { size: 21, italics: true, color: "555555" }),

        hr(),

        // ── SECTION I: Single Correct ──────────────────────────────────────
        sectionHeader("SECTION I  (Single Correct Choice)"),

        // Q1 — plain text, no equations
        p("Q-Topic",    "Topic: Units and Dimensions"),
        p("Q-Number",   "1.", { bold: true }),
        p("Q-Stem",     "Temperature can be expressed as a derived quantity in terms of which of the following?"),
        p("Q-Option",   "(1) Length and mass"),
        p("Q-Option",   "(2) Mass and time"),
        p("Q-Option",   "(3) Length, mass and time"),
        p("Q-Option",   "(4) None of these"),
        p("Q-Answer",   "Answer: (4)", { bold: true, color: "1a7a3c" }),
        p("Q-Solution", "Temperature is a fundamental (base) SI quantity — it cannot be derived from length, mass, or time.", { italics: true }),

        hr(),

        // ── SECTION II: Multiple Correct ──────────────────────────────────
        sectionHeader("SECTION II  (Multiple Correct Choice)"),

        // Q2 — LaTeX equations with $...$
        p("Q-Topic",    "Topic: Oscillations"),
        p("Q-Number",   "2.", { bold: true }),
        p("Q-Stem",     "In damped SHM the displacement is $x = a_0 e^{-\\frac{bt}{2m}} \\sin(\\omega t + \\alpha)$. Which of the following are correct?"),
        p("Q-Option",   "(1) Dimensions of $b/m$ are the same as $T^{-1}$"),
        p("Q-Option",   "(2) Dimensions of $a_0 \\omega$ are $[LT^{-1}]$"),
        p("Q-Option",   "(3) Dimensions of $1/b$ are $[MT^{-1}]^{-1}$"),
        p("Q-Option",   "(4) The amplitude decays as $e^{-bt/2m}$"),
        p("Q-Answer",   "Answer: (1), (2), (4)", { bold: true, color: "1a7a3c" }),
        p("Q-Solution", "From the exponent $bt/2m$ being dimensionless: $[b] = [m/t] = [MT^{-1}]$. So $[1/b] = [M^{-1}T]$, not $[MT^{-1}]^{-1}$ — option (3) is wrong. $[a_0\\omega] = [L][T^{-1}] = [LT^{-1}]$ ✓. Amplitude envelope is $a_0 e^{-bt/2m}$ ✓.", { italics: true }),

        hr(),

        // ── SECTION III: Integer Answer ────────────────────────────────────
        sectionHeader("SECTION III  (Integer Answer Type)"),

        // Q3 — LaTeX in stem and solution
        p("Q-Topic",    "Topic: Kinematics"),
        p("Q-Number",   "3.", { bold: true }),
        p("Q-Stem",     "A particle starts from rest and moves with acceleration $a = (2t)$ m/s². The distance (in m) covered in the first 3 seconds is:"),
        p("Q-Answer",   "Answer: 9", { bold: true, color: "1a7a3c" }),
        p("Q-Solution", "$v = \\int a\\,dt = t^2$. Distance $s = \\int_0^3 t^2\\,dt = \\left[\\frac{t^3}{3}\\right]_0^3 = 9$ m.", { italics: true }),

        hr(),

        // ── SECTION IV: Match the Following ───────────────────────────────
        sectionHeader("SECTION IV  (Match the Following)"),

        // Q4 — match table
        p("Q-Topic",    "Topic: Thermodynamics"),
        p("Q-Number",   "4.", { bold: true }),
        p("Q-Stem",     "Match each quantity in Column A with its SI unit in Column B."),

        matchTable(
          [
            { key: "A", value: "Energy" },
            { key: "B", value: "Power" },
            { key: "C", value: "Pressure" },
            { key: "D", value: "Electric charge" },
          ],
          [
            { key: "P", value: "Pascal (Pa)" },
            { key: "Q", value: "Joule (J)" },
            { key: "R", value: "Coulomb (C)" },
            { key: "S", value: "Watt (W)" },
          ],
        ),

        p("Q-Answer",   "Answer: A-Q, B-S, C-P, D-R", { bold: true, color: "1a7a3c" }),
        p("Q-Solution", "Energy → Joule (J); Power → Watt (W); Pressure → Pascal (Pa); Charge → Coulomb (C).", { italics: true }),

        hr(),

        // Q5 — match table with LaTeX in cells
        p("Q-Topic",    "Topic: Mechanics"),
        p("Q-Number",   "5.", { bold: true }),
        p("Q-Stem",     "Match each expression in Column A with the physical quantity it represents in Column B."),

        matchTable(
          [
            { key: "A", value: "$\\frac{1}{2}mv^2$" },
            { key: "B", value: "$mgh$" },
            { key: "C", value: "$\\frac{mv^2}{r}$" },
            { key: "D", value: "$I\\alpha$" },
          ],
          [
            { key: "P", value: "Torque" },
            { key: "Q", value: "Gravitational potential energy" },
            { key: "R", value: "Centripetal force" },
            { key: "S", value: "Kinetic energy" },
          ],
        ),

        p("Q-Answer",   "Answer: A-S, B-Q, C-R, D-P", { bold: true, color: "1a7a3c" }),
        p("Q-Solution", "$\\frac{1}{2}mv^2$ = KE; $mgh$ = GPE; $\\frac{mv^2}{r}$ = centripetal force; $I\\alpha$ = torque (Newton's 2nd law for rotation).", { italics: true }),

        hr(),

        new Paragraph({
          children: [new TextRun({ text: "Add your questions below this line following the same style pattern.", size: 20, color: "888888", italics: true, font: BASE_FONT })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
        }),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
const outPath = path.join(outDir, "arke-question-template.docx");
fs.writeFileSync(outPath, buffer);
console.log(`Template written to: ${outPath}`);
