/**
 * Merges docs/ui-copy/insights-proposed.json into catalog.full.tsv and applies to index.html.
 * Run: node tools/apply-insights-proposed.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const uiDir = path.join(root, 'docs', 'ui-copy');
const catalogPath = path.join(uiDir, 'catalog.json');
const proposedPath = path.join(uiDir, 'insights-proposed.json');
const tsvPath = path.join(uiDir, 'catalog.full.tsv');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function esc(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[\t\n\r"]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function main() {
  const catalog = loadJson(catalogPath);
  const proposed = loadJson(proposedPath);
  delete proposed._README;

  const ids = Object.keys(proposed);
  if (!ids.length) {
    console.log('No proposals in insights-proposed.json');
    return;
  }

  let merged = 0;
  for (const insightId of ids) {
    const p = proposed[insightId];
    const fields = [
      ['adult_title', 'title', 'adult'],
      ['adult_body', 'body', 'adult'],
      ['kid_title', 'title', 'kid'],
      ['kid_body', 'body', 'kid'],
    ];
    for (const [pKey, field, voice] of fields) {
      if (p[pKey] === undefined) continue;
      const catId = `insight.${voice}.${insightId}.${field}`;
      const entry = catalog.entries.find((e) => e.id === catId);
      if (!entry) {
        console.warn('Missing catalog entry:', catId);
        continue;
      }
      if (voice === 'adult') entry.adult = p[pKey];
      else entry.kid = p[pKey];
      merged++;
    }
  }

  const tsvLines = ['id\tcategory\tvariant\tadult\tkid\thtml'];
  for (const e of catalog.entries) {
    tsvLines.push(
      [esc(e.id), esc(e.category), esc(e.variant ?? ''), esc(e.adult), esc(e.kid), e.html ? 'yes' : 'no'].join('\t')
    );
  }
  fs.writeFileSync(tsvPath, tsvLines.join('\n'), 'utf8');
  console.log(`Merged ${merged} field(s) from ${ids.length} insight(s) into catalog.full.tsv`);

  const r = spawnSync(process.execPath, [path.join(__dirname, 'apply-ui-copy.mjs'), tsvPath], {
    cwd: root,
    stdio: 'inherit',
  });
  process.exit(r.status ?? 1);
}

main();
