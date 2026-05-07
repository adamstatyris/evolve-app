/**
 * Extracts user-visible strings from index.html into docs/ui-copy/catalog.json
 * for copy-editing and round-trip apply (see docs/ui-copy/README.md).
 *
 * Run: node tools/extract-ui-copy.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const outDir = path.join(root, 'docs', 'ui-copy');
const outPath = path.join(outDir, 'catalog.json');

function readQuotedFields(line) {
  const fields = [];
  let i = 0;
  const s = line.trim();
  while (i < s.length) {
    if (s[i] === ']' || s[i] === ')') break;
    if (s[i] === ',') {
      i++;
      continue;
    }
    if (s[i] !== "'") {
      i++;
      continue;
    }
    i++;
    let buf = '';
    while (i < s.length) {
      const c = s[i];
      if (c === '\\' && i + 1 < s.length) {
        buf += s[i + 1];
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
  return fields;
}

function extractInsightLibraryTuples(src) {
  const start = src.indexOf('const INSIGHT_LIBRARY=');
  const end = src.indexOf('return L;})();', start);
  if (start < 0 || end < 0) throw new Error('INSIGHT_LIBRARY block not found');
  const chunk = src.slice(start, end);
  const lines = chunk.split('\n');
  const rows = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith("['")) continue;
    const f = readQuotedFields(t);
    if (f.length >= 7) {
      rows.push({
        id: f[0],
        title: f[1],
        body: f[2],
        sourceText: f[3],
        sourceUrl: f[4],
        category: f[5],
        triggerType: f[6],
      });
    }
  }
  return rows;
}

function extractKidInsightParts(src, partName) {
  const key = `const ${partName}={`;
  const start = src.indexOf(key);
  if (start < 0) return [];
  let i = start + key.length - 1;
  let depth = 0;
  let begin = -1;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') {
      depth++;
      if (depth === 1) begin = i;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && begin >= 0) {
        const block = src.slice(begin, i + 1);
        const entries = [];
        const re =
          /([A-Z0-9]+):\{title:'((?:\\.|[^'\\])*)',body:'((?:\\.|[^'\\])*)',sourceText:'((?:\\.|[^'\\])*)'(?:,blogText:'((?:\\.|[^'\\])*)')?/g;
        let m;
        while ((m = re.exec(block)) !== null) {
          const unesc = (s) =>
            s
              .replace(/\\n/g, '\n')
              .replace(/\\'/g, "'")
              .replace(/\\"/g, '"');
          const row = {
            id: m[1],
            title: unesc(m[2]),
            body: unesc(m[3]),
            sourceText: unesc(m[4]),
          };
          if (m[5]) row.blogText = unesc(m[5]);
          entries.push(row);
        }
        return entries;
      }
    }
  }
  return [];
}

function safeEvalObject(expr) {
  return Function(`"use strict"; return (${expr});`)();
}

/** Array literal starting with `[` (e.g. UI_PALETTE_OPTIONS). */
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

function extractSetTxtSetHtml(src) {
  const fnStart = src.indexOf('function syncSettingsPanelsKidCopy()');
  const fnEnd = src.indexOf('function syncKidsSettingsCopy()', fnStart);
  if (fnStart < 0 || fnEnd < 0) return [];
  const body = src.slice(fnStart, fnEnd);
  const entries = [];
  const reTxt =
    /setTxt\('([^']+)',kid\?'((?:\\.|[^'\\])*)':'((?:\\.|[^'\\])*)'\)/g;
  let m;
  while ((m = reTxt.exec(body)) !== null) {
    const unesc = (s) => s.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');
    entries.push({
      locator: `syncSettingsPanelsKidCopy:setTxt:${m[1]}`,
      elementId: m[1],
      kid: unesc(m[2]),
      adult: unesc(m[3]),
      html: false,
    });
  }
  const reHtml =
    /setHtml\('([^']+)',kid\?'((?:\\.|[^'\\])*)':'((?:\\.|[^'\\])*)'\)/g;
  while ((m = reHtml.exec(body)) !== null) {
    const unesc = (s) => s.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');
    entries.push({
      locator: `syncSettingsPanelsKidCopy:setHtml:${m[1]}`,
      elementId: m[1],
      kid: unesc(m[2]),
      adult: unesc(m[3]),
      html: true,
    });
  }
  return entries;
}

function walkForStrings(obj, prefix, out) {
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'string') {
    out.push({ path: prefix, text: obj });
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => walkForStrings(item, `${prefix}[${idx}]`, out));
    return;
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      walkForStrings(obj[k], `${prefix}.${k}`, out);
    }
  }
}

function flattenOnboardingStrings(obj, variantRoot) {
  const rows = [];
  walkForStrings(obj, variantRoot, rows);
  return rows;
}

function extractHabitPresets(src, constName) {
  const key = `const ${constName}=`;
  const start = src.indexOf(key);
  if (start < 0) return [];
  let i = start + key.length;
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] !== '[') return [];
  let depth = 0;
  const begin = i;
  for (; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') {
      depth--;
      if (depth === 0) {
        const arrStr = src.slice(begin, i + 1);
        try {
          const arr = Function(`"use strict"; return ${arrStr};`)();
          return arr.filter((x) => x && x.key !== 'custom');
        } catch {
          return [];
        }
      }
    }
  }
  return [];
}

function main() {
  const src = fs.readFileSync(indexPath, 'utf8');
  const catalog = {
    format_version: 1,
    source_file: 'index.html',
    generated_note:
      'Do not edit format_version or id/locator fields when returning to the dev AI. Only edit adult/kid/title/body/etc. text fields as instructed.',
    entries: [],
  };

  const insightsAdult = extractInsightLibraryTuples(src);
  for (const row of insightsAdult) {
    catalog.entries.push({
      id: `insight.adult.${row.id}.title`,
      category: 'insights_adult',
      insight_id: row.id,
      field: 'title',
      adult: row.title,
      kid: null,
      html: false,
      meta: { category: row.category, triggerType: row.triggerType },
    });
    catalog.entries.push({
      id: `insight.adult.${row.id}.body`,
      category: 'insights_adult',
      insight_id: row.id,
      field: 'body',
      adult: row.body,
      kid: null,
      html: false,
      meta: { category: row.category, triggerType: row.triggerType },
    });
    catalog.entries.push({
      id: `insight.adult.${row.id}.sourceText`,
      category: 'insights_adult',
      insight_id: row.id,
      field: 'sourceText',
      adult: row.sourceText,
      kid: null,
      html: false,
      meta: { category: row.category, triggerType: row.triggerType },
    });
  }

  for (const part of ['_INSIGHT_KID_PART1', '_INSIGHT_KID_PART2', '_INSIGHT_KID_PART3', '_INSIGHT_KID_PART4', '_INSIGHT_KID_PART5']) {
    for (const row of extractKidInsightParts(src, part)) {
      catalog.entries.push({
        id: `insight.kid.${row.id}.title`,
        category: 'insights_kid',
        insight_id: row.id,
        field: 'title',
        adult: null,
        kid: row.title,
        html: false,
        source_part: part,
      });
      catalog.entries.push({
        id: `insight.kid.${row.id}.body`,
        category: 'insights_kid',
        insight_id: row.id,
        field: 'body',
        adult: null,
        kid: row.body,
        html: false,
        source_part: part,
      });
      catalog.entries.push({
        id: `insight.kid.${row.id}.sourceText`,
        category: 'insights_kid',
        insight_id: row.id,
        field: 'sourceText',
        adult: null,
        kid: row.sourceText,
        html: false,
        source_part: part,
      });
      if (row.blogText) {
        catalog.entries.push({
          id: `insight.kid.${row.id}.blogText`,
          category: 'insights_kid',
          insight_id: row.id,
          field: 'blogText',
          adult: null,
          kid: row.blogText,
          html: false,
          source_part: part,
        });
      }
    }
  }

  for (const row of extractSetTxtSetHtml(src)) {
    catalog.entries.push({
      id: `settings.dynamic.${row.elementId}${row.html ? '.html' : ''}`,
      category: 'settings_kid_toggle',
      locator: row.locator,
      elementId: row.elementId,
      adult: row.adult,
      kid: row.kid,
      html: row.html,
    });
  }

  const wizSlice = sliceConstObject(src, 'ONBOARDING_WIZARD_COPY');
  const introSlice = sliceConstObject(src, 'ONBOARDING_INTRO_COPY');
  if (wizSlice) {
    const wiz = safeEvalObject(wizSlice);
    for (const variant of ['adult', 'kid']) {
      const flat = flattenOnboardingStrings(wiz[variant], `wizard.${variant}`);
      for (const r of flat) {
        catalog.entries.push({
          id: `onboarding.wizard.${r.path}`,
          category: 'onboarding_wizard',
          variant,
          adult: variant === 'adult' ? r.text : null,
          kid: variant === 'kid' ? r.text : null,
          html: false,
        });
      }
    }
  }
  if (introSlice) {
    const intro = safeEvalObject(introSlice);
    for (const variant of ['adult', 'kid']) {
      const flat = flattenOnboardingStrings(intro[variant], `intro.${variant}`);
      for (const r of flat) {
        catalog.entries.push({
          id: `onboarding.${r.path}`,
          category: 'onboarding_intro',
          variant,
          adult: variant === 'adult' ? r.text : null,
          kid: variant === 'kid' ? r.text : null,
          html: r.path.endsWith('.html'),
        });
      }
    }
  }

  const fieldTips = sliceConstObject(src, 'FIELD_TIP_COPY');
  if (fieldTips) {
    const ft = safeEvalObject(fieldTips);
    for (const kind of Object.keys(ft)) {
      catalog.entries.push({
        id: `fieldTip.${kind}.adult.title`,
        category: 'field_tips',
        adult: ft[kind].adult.title,
        kid: null,
        html: false,
      });
      catalog.entries.push({
        id: `fieldTip.${kind}.adult.body`,
        category: 'field_tips',
        adult: ft[kind].adult.body,
        kid: null,
        html: false,
      });
      catalog.entries.push({
        id: `fieldTip.${kind}.kid.title`,
        category: 'field_tips',
        adult: null,
        kid: ft[kind].kid.title,
        html: false,
      });
      catalog.entries.push({
        id: `fieldTip.${kind}.kid.body`,
        category: 'field_tips',
        adult: null,
        kid: ft[kind].kid.body,
        html: false,
      });
    }
  }

  const graceAdult = sliceConstObject(src, 'GRACE_OFFER_STEPS_ADULT');
  const graceKid = sliceConstObject(src, 'GRACE_OFFER_STEPS_KID');
  if (graceAdult && graceKid) {
    const ga = safeEvalObject(graceAdult);
    const gk = safeEvalObject(graceKid);
    ga.forEach((st, i) => {
      catalog.entries.push({
        id: `graceOffer.adult.step${i}.title`,
        category: 'grace_offer',
        adult: st.title,
        kid: null,
        html: false,
      });
      catalog.entries.push({
        id: `graceOffer.adult.step${i}.html`,
        category: 'grace_offer',
        adult: st.html,
        kid: null,
        html: true,
      });
    });
    gk.forEach((st, i) => {
      catalog.entries.push({
        id: `graceOffer.kid.step${i}.title`,
        category: 'grace_offer',
        adult: null,
        kid: st.title,
        html: false,
      });
      catalog.entries.push({
        id: `graceOffer.kid.step${i}.html`,
        category: 'grace_offer',
        adult: null,
        kid: st.html,
        html: true,
      });
    });
  }

  const habitTier = sliceConstObject(src, 'HABIT_TIER_TUTORIAL_COPY');
  if (habitTier) {
    const ht = safeEvalObject(habitTier);
    catalog.entries.push({
      id: 'habitTierTutorial.adult.title',
      category: 'habit_editor_tour',
      adult: ht.adult.title,
      kid: null,
      html: false,
    });
    catalog.entries.push({
      id: 'habitTierTutorial.adult.body',
      category: 'habit_editor_tour',
      adult: ht.adult.body,
      kid: null,
      html: true,
    });
    catalog.entries.push({
      id: 'habitTierTutorial.kid.title',
      category: 'habit_editor_tour',
      adult: null,
      kid: ht.kid.title,
      html: false,
    });
    catalog.entries.push({
      id: 'habitTierTutorial.kid.body',
      category: 'habit_editor_tour',
      adult: null,
      kid: ht.kid.body,
      html: true,
    });
  }

  const catLabelsKid = sliceConstObject(src, 'INSIGHT_CATEGORY_LABELS_KID');
  if (catLabelsKid) {
    const cl = safeEvalObject(catLabelsKid);
    for (const k of Object.keys(cl)) {
      catalog.entries.push({
        id: `insightCategoryLabel.kid.${k.replace(/[^a-zA-Z0-9_]/g, '_')}`,
        category: 'insight_category_labels_kid',
        adult: null,
        kid: cl[k],
        html: false,
        key: k,
      });
    }
  }

  const habitCatLabels = sliceConstObject(src, 'HABIT_PRESET_CATEGORY_LABELS');
  if (habitCatLabels) {
    const hcl = safeEvalObject(habitCatLabels);
    for (const k of Object.keys(hcl)) {
      catalog.entries.push({
        id: `habitPresetCategoryLabel.${k}`,
        category: 'habit_preset_category',
        adult: hcl[k],
        kid: null,
        html: false,
        key: k,
      });
    }
  }

  const presetsAdult = extractHabitPresets(src, 'HABITPRESETS');
  const presetsKid = extractHabitPresets(src, 'HABITPRESETS_KID');
  const kidByKey = Object.fromEntries(presetsKid.map((p) => [p.key, p]));
  for (const p of presetsAdult) {
    const pk = kidByKey[p.key];
    catalog.entries.push({
      id: `habitPreset.${p.key}.label`,
      category: 'habit_preset',
      preset_key: p.key,
      adult: p.label,
      kid: pk ? pk.label : null,
      html: false,
    });
    catalog.entries.push({
      id: `habitPreset.${p.key}.title`,
      category: 'habit_preset',
      preset_key: p.key,
      adult: p.title,
      kid: pk ? pk.title : null,
      html: false,
    });
  }

  const rewardSlice = src.match(/const REWARD_PRESETS=\[([\s\S]*?)\];/);
  if (rewardSlice) {
    try {
      const arr = Function(`"use strict"; return [${rewardSlice[1]}];`)();
      arr.forEach((label, i) => {
        catalog.entries.push({
          id: `rewardPreset[${i}]`,
          category: 'reward_presets',
          adult: label,
          kid: null,
          html: false,
        });
      });
    } catch {
      /* ignore */
    }
  }

  const palStr = extractBracketArray(src, 'UI_PALETTE_OPTIONS');
  if (palStr) {
    try {
      const palettes = Function(`"use strict"; return ${palStr};`)();
      for (const o of palettes) {
        catalog.entries.push({
          id: `uiPalette.${o.id}.label`,
          category: 'ui_palette',
          palette_id: o.id,
          adult: o.label,
          kid: null,
          html: false,
        });
        catalog.entries.push({
          id: `uiPalette.${o.id}.sub`,
          category: 'ui_palette',
          palette_id: o.id,
          adult: o.sub,
          kid: null,
          html: false,
        });
      }
    } catch {
      /* ignore */
    }
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`Wrote ${catalog.entries.length} entries to ${path.relative(root, outPath)}`);

  const tsvPath = path.join(outDir, 'catalog.full.tsv');
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.replace(/\r?\n/g, '\\n').replace(/\t/g, ' ');
  };
  const tsvLines = ['id\tcategory\tvariant\tadult\tkid\thtml'];
  for (const e of catalog.entries) {
    tsvLines.push(
      [
        esc(e.id),
        esc(e.category),
        esc(e.variant ?? ''),
        esc(e.adult),
        esc(e.kid),
        e.html ? 'yes' : 'no',
      ].join('\t')
    );
  }
  fs.writeFileSync(tsvPath, tsvLines.join('\n'), 'utf8');
  console.log(`Wrote TSV ${path.relative(root, tsvPath)}`);
}

main();
