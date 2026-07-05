/**
 * Builds docs/ui-copy/insights-review.tsv — a friendly curation sheet for ALL
 * insights (adult + kid), with links/references and the dev AI's proposed rewrites.
 *
 * Source of truth for CURRENT copy: docs/ui-copy/catalog.json (run extract first).
 * Source of PROPOSED rewrites: docs/ui-copy/insights-proposed.json (optional;
 *   keyed by insight_id; any missing field falls back to the current text).
 *
 * Workflow:
 *   1) node tools/extract-ui-copy.mjs
 *   2) node tools/build-insights-review.mjs
 *   3) Open docs/ui-copy/insights-review.tsv in Excel / Google Sheets, edit the
 *      proposed_* columns, then hand it back to apply.
 *
 * Run: node tools/build-insights-review.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const uiDir = path.join(root, 'docs', 'ui-copy');
const catalogPath = path.join(uiDir, 'catalog.json');
const proposedPath = path.join(uiDir, 'insights-proposed.json');
const outPath = path.join(uiDir, 'insights-review.tsv');

function loadJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

/** RFC4180-style cell: quote when it contains tab/newline/quote; escape " as "". */
function cell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[\t\n\r"]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function main() {
  const catalog = loadJson(catalogPath, null);
  if (!catalog) {
    console.error('Missing catalog.json — run: node tools/extract-ui-copy.mjs');
    process.exit(1);
  }
  const proposed = loadJson(proposedPath, {});

  // Index catalog entries we care about.
  const get = (id) => catalog.entries.find((e) => e.id === id);

  // Preserve library order via the adult title entries.
  const order = catalog.entries.filter(
    (e) => e.category === 'insights_adult' && e.field === 'title'
  );

  const cols = [
    'insight_id',
    'category',
    'trigger',
    'sourceText',
    'sourceUrl',
    'current_adult_title',
    'current_adult_body',
    'current_kid_title',
    'current_kid_body',
    'proposed_adult_title',
    'proposed_adult_body',
    'proposed_kid_title',
    'proposed_kid_body',
    'notes',
  ];
  const lines = [cols.join('\t')];

  let withProposal = 0;
  for (const head of order) {
    const id = head.insight_id;
    const meta = head.meta || {};
    const aTitle = head.adult ?? '';
    const aBody = get(`insight.adult.${id}.body`)?.adult ?? '';
    const aSrcText = get(`insight.adult.${id}.sourceText`)?.adult ?? '';
    const aSrcUrl = get(`insight.adult.${id}.sourceUrl`)?.adult ?? '';
    const kTitle = get(`insight.kid.${id}.title`)?.kid ?? '';
    const kBody = get(`insight.kid.${id}.body`)?.kid ?? '';

    const p = proposed[id] || {};
    if (p.adult_title || p.adult_body || p.kid_title || p.kid_body || p.notes) withProposal++;

    const row = [
      id,
      meta.category ?? '',
      meta.triggerType ?? '',
      aSrcText,
      aSrcUrl,
      aTitle,
      aBody,
      kTitle,
      kBody,
      // proposed_* defaults to current so every cell is a usable starting point.
      p.adult_title ?? aTitle,
      p.adult_body ?? aBody,
      p.kid_title ?? kTitle,
      p.kid_body ?? kBody,
      p.notes ?? '',
    ];
    lines.push(row.map(cell).join('\t'));
  }

  fs.mkdirSync(uiDir, { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(
    `Wrote ${order.length} insight rows to ${path.relative(root, outPath)} ` +
      `(${withProposal} with dev-AI proposals${
        Object.keys(proposed).length ? '' : ', none yet — add docs/ui-copy/insights-proposed.json'
      }).`
  );
}

main();
