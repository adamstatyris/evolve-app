/**
 * Applies edited catalog TSV (Excel-style quoted fields) to index.html.
 * Run: node tools/apply-ui-copy.mjs <path-to-catalog.tsv>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');

/** Excel / RFC-style TSV with quoted fields and "" escapes; multiline inside quotes. */
function parseExcelTsv(content) {
  const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === '\t') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c === '\r') {
      /* ignore CR */
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Fix literal "u201c" etc. (no \\u prefix) from broken spreadsheet exports */
function fixBrokenUnicodeNames(s) {
  if (!s) return s;
  return String(s)
    .replace(/\bu201c/gi, '\u201c')
    .replace(/\bu201d/gi, '\u201d')
    .replace(/\bu2019/gi, '\u2019')
    .replace(/\bu2018/gi, '\u2018')
    .replace(/\bu2014/gi, '\u2014')
    .replace(/\bu2026/gi, '\u2026')
    .replace(/\bu([0-9a-f]{4})\b/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

function jsq(s) {
  if (s == null) return "''";
  return (
    "'" +
    String(s)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '')
      .replace(/\n/g, '\\n') +
    "'"
  );
}

function quoteKidAdult(kid, adult) {
  const qA = `'${String(adult).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '').replace(/\n/g, '\\n')}'`;
  const k = String(kid);
  const needsDouble = k.includes("'") || k.includes('\n') || k.includes('\r');
  const qK = needsDouble
    ? `"${k.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '').replace(/\n/g, '\\n')}"`
    : `'${k.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '').replace(/\n/g, '\\n')}'`;
  return `kid?${qK}:${qA}`;
}

function writeQuotedFields(fields) {
  return fields.map((f) => `'${String(f).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`).join(',');
}

function sliceConstObject(src, name) {
  const key = `const ${name}=`;
  const start = src.indexOf(key);
  if (start < 0) return null;
  let i = start + key.length;
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] !== '{') return null;
  let depth = 0;
  const begin = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(begin, i + 1);
    }
  }
  return null;
}

function extractBracketArray(src, constName) {
  const key = `const ${constName}=`;
  const start = src.indexOf(key);
  if (start < 0) return null;
  let i = start + key.length;
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] !== '[') return null;
  let depth = 0;
  const begin = i;
  for (; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') {
      depth--;
      if (depth === 0) return src.slice(begin, i + 1);
    }
  }
  return null;
}

function safeEvalObject(expr) {
  return Function(`"use strict"; return (${expr});`)();
}

function parseDotPath(pathStr) {
  const out = [];
  for (const part of pathStr.split('.')) {
    const m = part.match(/^([^[\]]+)(\[[0-9]+\])?$/);
    if (!m) throw new Error(`Bad path part: ${part}`);
    out.push(m[1]);
    if (m[2]) out.push(Number(m[2].slice(1, -1)));
  }
  return out;
}

function setDeep(obj, pathArr, value) {
  let cur = obj;
  for (let i = 0; i < pathArr.length - 1; i++) {
    cur = cur[pathArr[i]];
  }
  cur[pathArr[pathArr.length - 1]] = value;
}

function serWizardBlock(W) {
  function serSide(x, ind) {
    return [
      `${ind}brandSub:${jsq(x.brandSub)},`,
      `${ind}step0:{title:${jsq(x.step0.title)},sub:${jsq(x.step0.sub)}},`,
      `${ind}step1:{title:${jsq(x.step1.title)},sub:${jsq(x.step1.sub)},lblName:${jsq(x.step1.lblName)},lblDob:${jsq(x.step1.lblDob)},lblStart:${jsq(x.step1.lblStart)}},`,
      `${ind}step2:{title:${jsq(x.step2.title)},note:${jsq(x.step2.note)}}`,
    ].join('\n');
  }
  return `const ONBOARDING_WIZARD_COPY={
  adult:{
${serSide(W.adult, '    ')}
  },
  kid:{
${serSide(W.kid, '    ')}
  }
};`;
}

function serIntroBlock(I) {
  function serSide(x, ind) {
    const steps = x.steps
      .map(
        (s) =>
          `${ind}{title:${jsq(s.title)},html:${jsq(s.html)}}`
      )
      .join(',\n');
    return `${ind}brandTitle:${jsq(x.brandTitle)},\n${ind}brandSub:${jsq(x.brandSub)},\n${ind}steps:[\n${steps}\n${ind}]`;
  }
  return `const ONBOARDING_INTRO_COPY={
  adult:{
${serSide(I.adult, '    ')}
  },
  kid:{
${serSide(I.kid, '    ')}
  }
};`;
}

function serFieldTips(ft) {
  const kinds = ['goalName', 'goalReward', 'habitTitle'];
  const inner = kinds
    .map((k) => {
      const x = ft[k];
      return `  ${k}:{adult:{title:${jsq(x.adult.title)},body:${jsq(x.adult.body)}},kid:{title:${jsq(x.kid.title)},body:${jsq(x.kid.body)}}}`;
    })
    .join(',\n');
  return `const FIELD_TIP_COPY={\n${inner}\n};`;
}

function serGrace(arr) {
  const body = arr
    .map((st) => `{title:${jsq(st.title)},html:${jsq(st.html)}}`)
    .join(',');
  return `[${body}]`;
}

function serHabitTier(ht) {
  return `const HABIT_TIER_TUTORIAL_COPY={adult:{title:${jsq(ht.adult.title)},body:${jsq(ht.adult.body)}},kid:{title:${jsq(ht.kid.title)},body:${jsq(ht.kid.body)}}};`;
}

function serInsightCategoryKid(labels) {
  const lines = Object.keys(labels).map((k) => {
    const keyPart = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? k : `'${k.replace(/'/g, "\\'")}'`;
    return `  ${keyPart}:${jsq(labels[k])}`;
  });
  return `const INSIGHT_CATEGORY_LABELS_KID={\n${lines.join(',\n')}\n};`;
}

function serHabitPresetCat(h) {
  const keys = Object.keys(h);
  const inner = keys.map((k) => `${k}:${jsq(h[k])}`).join(',');
  return `const HABIT_PRESET_CATEGORY_LABELS={${inner}};`;
}

function replaceConstBlock(html, constName, newDecl) {
  const key = `const ${constName}=`;
  const start = html.indexOf(key);
  if (start < 0) throw new Error(`Missing ${constName}`);
  let i = start + key.length;
  while (i < html.length && /\s/.test(html[i])) i++;
  const open = html[i];
  if (open !== '{' && open !== '[') throw new Error(`Unexpected ${constName} shape`);
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  for (; i < html.length; i++) {
    const c = html[i];
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        let end = i + 1;
        while (html[end] === ';') end++;
        return html.slice(0, start) + newDecl + html.slice(end);
      }
    }
  }
  throw new Error(`Unclosed ${constName}`);
}

/** Parse ['id','title',…] tuple starting at first `[` — handles \\n, \\uXXXX, \\', \\\\ */
function parseInsightAdultTupleLine(line) {
  const openB = line.indexOf('[');
  if (openB < 0) return null;
  const indent = line.slice(0, openB);
  const t = line.slice(openB);
  if (!t.startsWith("['")) return null;
  let i = 1;
  const fields = [];
  while (i < t.length) {
    while (i < t.length && (t[i] === ',' || /\s/.test(t[i]))) i++;
    if (i >= t.length || t[i] === ']') break;
    if (t[i] !== "'") return null;
    i++;
    let buf = '';
    while (i < t.length) {
      const c = t[i];
      if (c === '\\' && i + 1 < t.length) {
        const n = t[i + 1];
        if (n === 'n') {
          buf += '\n';
          i += 2;
          continue;
        }
        if (n === 'r') {
          buf += '\r';
          i += 2;
          continue;
        }
        if (n === "'") {
          buf += "'";
          i += 2;
          continue;
        }
        if (n === '\\') {
          buf += '\\';
          i += 2;
          continue;
        }
        if (n === 'u' && /^[0-9a-fA-F]{4}/.test(t.slice(i + 2, i + 6))) {
          buf += String.fromCodePoint(parseInt(t.slice(i + 2, i + 6), 16));
          i += 6;
          continue;
        }
        buf += n;
        i += 2;
        continue;
      }
      if (c === "'") {
        i++;
        break;
      }
      buf += c;
      i++;
    }
    fields.push(buf);
  }
  if (fields.length < 7) return null;
  const suffix = t.slice(i);
  return { fields, suffix, indent };
}

function applyInsightsAdult(html, byId) {
  const lines = html.split('\n');
  const out = [];
  for (const line of lines) {
    const parsed = parseInsightAdultTupleLine(line);
    if (parsed) {
      const f = parsed.fields;
      const id = f[0];
      let changed = false;
      for (const suf of ['title', 'body', 'sourceText']) {
        const eid = `insight.adult.${id}.${suf}`;
        const row = byId.get(eid);
        if (row && row.adult !== undefined && row.adult !== '') {
          const idx = suf === 'title' ? 1 : suf === 'body' ? 2 : 3;
          f[idx] = row.adult;
          changed = true;
        }
      }
      if (changed) {
        const tupleInner = writeQuotedFields(f.slice(0, 7));
        out.push(`${parsed.indent}[${tupleInner}${parsed.suffix}`);
        continue;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}


function replaceKidField(html, insightId, field, newVal) {
  const esc = escapeForKidRegexReplace(newVal);
  if (field === 'title') {
    return html.replace(
      new RegExp(`(${escapeRe(insightId)}:\\{title:')((?:\\\\.|[^'\\\\])*)(')`),
      `$1${esc}$3`
    );
  }
  if (field === 'body') {
    return html.replace(
      new RegExp(
        `(${escapeRe(insightId)}:\\{title:'(?:\\\\.|[^'\\\\])*',body:')((?:\\\\.|[^'\\\\])*)(')`
      ),
      `$1${esc}$3`
    );
  }
  if (field === 'sourceText') {
    return html.replace(
      new RegExp(
        `(${escapeRe(insightId)}:\\{title:'(?:\\\\.|[^'\\\\])*',body:'(?:\\\\.|[^'\\\\])*',sourceText:')((?:\\\\.|[^'\\\\])*)(')`
      ),
      `$1${esc}$3`
    );
  }
  if (field === 'blogText') {
    const hasBlog = new RegExp(
      `${escapeRe(insightId)}:\\{title:'(?:\\\\.|[^'\\\\])*',body:'(?:\\\\.|[^'\\\\])*',sourceText:'(?:\\\\.|[^'\\\\])*',blogText:'`
    ).test(html);
    if (!hasBlog) return html;
    return html.replace(
      new RegExp(
        `(${escapeRe(insightId)}:\\{title:'(?:\\\\.|[^'\\\\])*',body:'(?:\\\\.|[^'\\\\])*',sourceText:'(?:\\\\.|[^'\\\\])*',blogText:')((?:\\\\.|[^'\\\\])*)(')`
      ),
      `$1${esc}$3`
    );
  }
  return html;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeForKidRegexReplace(s) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n');
}

const PART_NAMES = ['_INSIGHT_KID_PART1', '_INSIGHT_KID_PART2', '_INSIGHT_KID_PART3', '_INSIGHT_KID_PART4', '_INSIGHT_KID_PART5'];

function applyInsightsKid(html, byId) {
  const fieldOrder = ['title', 'body', 'sourceText', 'blogText'];
  for (const part of PART_NAMES) {
    const key = `const ${part}=`;
    const start = html.indexOf(key);
    if (start < 0) continue;
    let i = start + key.length;
    const brace0 = html.indexOf('{', i);
    let depth = 0;
    let j = brace0;
    for (; j < html.length; j++) {
      if (html[j] === '{') depth++;
      else if (html[j] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    const before = html.slice(0, brace0);
    const block = html.slice(brace0, j + 1);
    const after = html.slice(j + 1);
    let newBlock = block;
    const idPattern = /\b([A-Z]{1,3}\d+|F\d+|ME\d+|RG\d+|MY\d+|CB\d+|CA\d+|NH\d+)\b/g;
    const ids = new Set();
    let m;
    while ((m = idPattern.exec(block)) !== null) ids.add(m[1]);
    const sortedIds = [...ids].sort((a, b) => b.length - a.length);
    for (const insightId of sortedIds) {
      for (const field of fieldOrder) {
        const eid = `insight.kid.${insightId}.${field}`;
        const row = byId.get(eid);
        if (!row || row.kid === undefined || row.kid === '') continue;
        newBlock = replaceKidField(newBlock, insightId, field, row.kid);
      }
    }
    html = before + newBlock + after;
  }
  return html;
}

function applySettingsDynamic(html, byId) {
  const lines = html.split('\n');
  const out = lines.map((line) => {
    const m = line.match(/^(\s*)set(Txt|Html)\('([^']+)',kid\?.+\);/);
    if (!m) return line;
    const [, leading, fn, elementId] = m;
    const htmlCall = fn === 'Html';
    const catId = `settings.dynamic.${elementId}${htmlCall ? '.html' : ''}`;
    const row = byId.get(catId);
    if (!row) return line;
    const pair = quoteKidAdult(row.kid ?? '', row.adult ?? '');
    return `${leading}set${fn}('${elementId}',${pair});`;
  });
  return out.join('\n');
}

function buildById(rows) {
  const header = rows[0].map((h) => h.replace(/^"|"$/g, '').trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const byId = new Map();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length < 6) continue;
    const id = fixBrokenUnicodeNames(row[idx.id]?.replace(/^"|"$/g, '') ?? '');
    if (!id || id === 'id') continue;
    const category = row[idx.category] ?? '';
    const variant = row[idx.variant] ?? '';
    let adult = fixBrokenUnicodeNames(row[idx.adult] ?? '');
    let kid = fixBrokenUnicodeNames(row[idx.kid] ?? '');
    const html = (row[idx.html] ?? '').trim().toLowerCase();
    byId.set(id, { id, category, variant, adult, kid, html: html === 'yes' ? 'yes' : 'no' });
  }
  return byId;
}

function main() {
  const tsvPath = path.resolve(process.argv[2] || '');
  if (!tsvPath || !fs.existsSync(tsvPath)) {
    console.error('Usage: node tools/apply-ui-copy.mjs <catalog.tsv>');
    process.exit(1);
  }
  const rows = parseExcelTsv(fs.readFileSync(tsvPath, 'utf8'));
  const byId = buildById(rows);
  let html = fs.readFileSync(indexPath, 'utf8');

  html = applyInsightsAdult(html, byId);
  html = applyInsightsKid(html, byId);
  html = applySettingsDynamic(html, byId);

  const wizSlice = sliceConstObject(html, 'ONBOARDING_WIZARD_COPY');
  const introSlice = sliceConstObject(html, 'ONBOARDING_INTRO_COPY');
  if (wizSlice) {
    const W = safeEvalObject(wizSlice);
    for (const [id, row] of byId) {
      if (!id.startsWith('onboarding.wizard.wizard.')) continue;
      const pathStr = id.slice('onboarding.wizard.'.length);
      const inner = pathStr.slice('wizard.'.length);
      const text = row.variant === 'kid' ? row.kid : row.adult;
      if (!text) continue;
      setDeep(W, parseDotPath(inner), text);
    }
    html = replaceConstBlock(html, 'ONBOARDING_WIZARD_COPY', serWizardBlock(W));
  }

  if (introSlice) {
    const I = safeEvalObject(introSlice);
    for (const [id, row] of byId) {
      if (!id.startsWith('onboarding.intro.')) continue;
      const inner = id.slice('onboarding.intro.'.length);
      const text = row.variant === 'kid' ? row.kid : row.adult;
      if (!text) continue;
      setDeep(I, parseDotPath(inner), text);
    }
    html = replaceConstBlock(html, 'ONBOARDING_INTRO_COPY', serIntroBlock(I));
  }

  const ftSlice = sliceConstObject(html, 'FIELD_TIP_COPY');
  if (ftSlice) {
    const ft = safeEvalObject(ftSlice);
    for (const [id, row] of byId) {
      if (!id.startsWith('fieldTip.')) continue;
      const parts = id.split('.');
      const kind = parts[1];
      const audience = parts[2];
      const fld = parts[3];
      if (!ft[kind] || !ft[kind][audience]) continue;
      const text = audience === 'kid' ? row.kid : row.adult;
      if (!text) continue;
      ft[kind][audience][fld] = text;
    }
    html = replaceConstBlock(html, 'FIELD_TIP_COPY', serFieldTips(ft));
  }

  const graceAdultStr = extractBracketArray(html, 'GRACE_OFFER_STEPS_ADULT');
  const graceKidStr = extractBracketArray(html, 'GRACE_OFFER_STEPS_KID');
  if (graceAdultStr && graceKidStr) {
    const ga = safeEvalObject(graceAdultStr);
    const gk = safeEvalObject(graceKidStr);
    for (const [id, row] of byId) {
      const m = id.match(/^graceOffer\.(adult|kid)\.step(\d+)\.(title|html)$/);
      if (!m) continue;
      const [, a, si, fld] = m;
      const arr = a === 'adult' ? ga : gk;
      const text = a === 'adult' ? row.adult : row.kid;
      if (!text) continue;
      arr[Number(si)][fld] = text;
    }
    html = replaceConstBlock(html, 'GRACE_OFFER_STEPS_ADULT', `const GRACE_OFFER_STEPS_ADULT=${serGrace(ga)};`);
    html = replaceConstBlock(html, 'GRACE_OFFER_STEPS_KID', `const GRACE_OFFER_STEPS_KID=${serGrace(gk)};`);
  }

  const htSlice = sliceConstObject(html, 'HABIT_TIER_TUTORIAL_COPY');
  if (htSlice) {
    const ht = safeEvalObject(htSlice);
    for (const [id, row] of byId) {
      if (!id.startsWith('habitTierTutorial.')) continue;
      const rest = id.slice('habitTierTutorial.'.length);
      const [audience, fld] = rest.split('.');
      const text = audience === 'kid' ? row.kid : row.adult;
      if (!text || !ht[audience]) continue;
      ht[audience][fld] = text;
    }
    html = replaceConstBlock(html, 'HABIT_TIER_TUTORIAL_COPY', serHabitTier(ht));
  }

  const icSlice = sliceConstObject(html, 'INSIGHT_CATEGORY_LABELS_KID');
  if (icSlice) {
    const labels = safeEvalObject(icSlice);
    const sanitize = (k) => k.replace(/[^a-zA-Z0-9_]/g, '_');
    const bySan = new Map(Object.keys(labels).map((k) => [sanitize(k), k]));
    for (const [id, row] of byId) {
      if (!id.startsWith('insightCategoryLabel.kid.')) continue;
      const san = id.slice('insightCategoryLabel.kid.'.length);
      const origKey = bySan.get(san);
      if (!origKey) {
        console.warn(`Unknown insight category key for ${id}`);
        continue;
      }
      if (row.kid) labels[origKey] = row.kid;
    }
    html = replaceConstBlock(html, 'INSIGHT_CATEGORY_LABELS_KID', serInsightCategoryKid(labels));
  }

  const hpcSlice = sliceConstObject(html, 'HABIT_PRESET_CATEGORY_LABELS');
  if (hpcSlice) {
    const hcl = safeEvalObject(hpcSlice);
    for (const [id, row] of byId) {
      if (!id.startsWith('habitPresetCategoryLabel.')) continue;
      const k = id.slice('habitPresetCategoryLabel.'.length);
      if (row.adult) hcl[k] = row.adult;
    }
    html = replaceConstBlock(html, 'HABIT_PRESET_CATEGORY_LABELS', serHabitPresetCat(hcl));
  }

  const presetsAdult = safeEvalObject(extractBracketArray(html, 'HABITPRESETS'));
  const presetsKid = safeEvalObject(extractBracketArray(html, 'HABITPRESETS_KID'));
  if (Array.isArray(presetsAdult) && Array.isArray(presetsKid)) {
    const kidByKey = Object.fromEntries(presetsKid.map((p) => [p.key, p]));
    for (const [id, row] of byId) {
      const m = id.match(/^habitPreset\.([^.]+)\.(label|title)$/);
      if (!m) continue;
      const [, key, fld] = m;
      const pa = presetsAdult.find((p) => p.key === key);
      if (pa && row.adult) pa[fld] = row.adult;
      const pk = kidByKey[key];
      if (pk && row.kid) pk[fld] = row.kid;
    }
    const emitPreset = (arr, name) =>
      `const ${name}=[\n${arr
        .map((p) => {
          const rawT = String(p.title);
          const titleLit = rawT.includes("'")
            ? `"${rawT.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
            : jsq(rawT);
          return `  {key:${jsq(p.key)},label:${jsq(p.label)},emoji:${jsq(p.emoji)},title:${titleLit},tier:${jsq(
            p.tier
          )},metric:${jsq(p.metric)},threshold:${p.threshold},pot:${p.pot},category:${jsq(p.category)}}`;
        })
        .join(',\n')}\n];`;

    html = replaceConstBlock(html, 'HABITPRESETS', emitPreset(presetsAdult, 'HABITPRESETS'));
    html = replaceConstBlock(html, 'HABITPRESETS_KID', emitPreset(presetsKid, 'HABITPRESETS_KID'));
  }

  const rewardSlice = html.match(/const REWARD_PRESETS=\[([\s\S]*?)\];/);
  if (rewardSlice) {
    let labels = [];
    try {
      labels = Function(`"use strict"; return [${rewardSlice[1]}];`)();
    } catch {
      labels = [];
    }
    if (labels.length) {
      for (const [id, row] of byId) {
        const m = id.match(/^rewardPreset\[(\d+)\]$/);
        if (!m) continue;
        const i = Number(m[1]);
        if (row.adult) labels[i] = row.adult;
      }
      const fixedLine = `const REWARD_PRESETS=[${labels.map((x) => jsq(x)).join(',')}];`;
      html = html.replace(/const REWARD_PRESETS=\[[\s\S]*?\];/, fixedLine);
    }
  }

  const palStr = extractBracketArray(html, 'UI_PALETTE_OPTIONS');
  if (palStr) {
    try {
      const palettes = safeEvalObject(palStr);
      for (const [id, row] of byId) {
        const m = id.match(/^uiPalette\.([^.]+)\.(label|sub)$/);
        if (!m) continue;
        const [, pid, fld] = m;
        const o = palettes.find((x) => x.id === pid);
        if (o && row.adult) o[fld] = row.adult;
      }
      const fixedLine =
        'const UI_PALETTE_OPTIONS=[' +
        palettes
          .map(
            (o) =>
              `{id:${jsq(o.id)},label:${jsq(o.label)},sub:${jsq(o.sub)},darkBg:${jsq(o.darkBg)},lightBg:${jsq(
                o.lightBg
              )}}`
          )
          .join(',') +
        '];';
      const key = 'const UI_PALETTE_OPTIONS=';
      const start = html.indexOf(key);
      if (start >= 0) {
        let i = start + key.length;
        while (i < html.length && /\s/.test(html[i])) i++;
        if (html[i] === '[') {
          let depth = 0;
          const begin = i;
          for (; i < html.length; i++) {
            if (html[i] === '[') depth++;
            else if (html[i] === ']') {
              depth--;
              if (depth === 0) {
                let end = i + 1;
                if (html[end] === ';') end++;
                html = html.slice(0, start) + fixedLine + html.slice(end);
                break;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('UI_PALETTE_OPTIONS patch skipped', e.message);
    }
  }

  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('Updated', path.relative(root, indexPath));
}

main();
