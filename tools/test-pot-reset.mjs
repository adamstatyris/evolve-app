/** Smoke test for pot-reset cutoff merge logic (mirrors index.html helpers). */
function compareIsoWeekKeys(a, b) {
  if (!a || !b) return !a && !b ? 0 : a ? 1 : -1;
  const pa = String(a).split('-W');
  const pb = String(b).split('-W');
  if (pa.length < 2 || pb.length < 2) return String(a).localeCompare(String(b));
  const ya = parseInt(pa[0], 10), wa = parseInt(pa[1], 10);
  const yb = parseInt(pb[0], 10), wb = parseInt(pb[1], 10);
  if (ya !== yb) return ya < yb ? -1 : 1;
  if (wa !== wb) return wa < wb ? -1 : 1;
  return 0;
}
function mergePotExcludedWeekKey(stored, computed) {
  const s = stored || '';
  const c = computed || '';
  if (!s) return c;
  if (!c) return s;
  return compareIsoWeekKeys(s, c) >= 0 ? s : c;
}
function computeRecoveryTimeline(keys, consistentByWeek) {
  const floorFrac = 0.8;
  const recoveryByWeek = {};
  let chapterStart = 0, recovery = false, prevPct = null, cutoff = '';
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const winStart = chapterStart;
    const winLen = i - winStart + 1;
    if (winLen < 2) { recoveryByWeek[k] = false; continue; }
    let ok = 0;
    for (let j = winStart; j <= i; j++) if (consistentByWeek[keys[j]]) ok++;
    const pct = ok / winLen;
    if (pct >= floorFrac) { recovery = false; prevPct = null; recoveryByWeek[k] = false; continue; }
    if (!recovery) { recovery = true; prevPct = pct; recoveryByWeek[k] = true; continue; }
    if (prevPct !== null && (pct < prevPct || (pct === 0 && prevPct === 0))) {
      cutoff = mergePotExcludedWeekKey(cutoff, k);
      chapterStart = i + 1;
      recovery = false;
      prevPct = null;
      recoveryByWeek[k] = true;
    } else {
      prevPct = pct;
      recoveryByWeek[k] = true;
    }
  }
  return { recoveryActive: recovery, potExcludedUpToWeekKey: cutoff, weeks: keys };
}
function bankedPot(keys, cutoff, potByWeek) {
  const banked = cutoff ? keys.filter(k => compareIsoWeekKeys(k, cutoff) > 0) : keys.slice();
  return banked.reduce((s, k) => s + (potByWeek[k] || 0), 0);
}

const keys = ['2026-W01', '2026-W02', '2026-W03', '2026-W04', '2026-W05'];
const consistent = { '2026-W01': true, '2026-W02': false, '2026-W03': false, '2026-W04': false, '2026-W05': false };
const potByWeek = { '2026-W01': 10, '2026-W02': 10, '2026-W03': 10, '2026-W04': 10, '2026-W05': 10 };
const tl = computeRecoveryTimeline(keys, consistent);
const effective = mergePotExcludedWeekKey('', tl.potExcludedUpToWeekKey);
const pot = bankedPot(keys, effective, potByWeek);
if (!effective) throw new Error('expected strict-drop cutoff');
if (pot !== 20) throw new Error('expected banked pot 20 after reset at W03, got ' + pot);
const latestClosed = keys[keys.length - 1];
if (bankedPot(keys, latestClosed, potByWeek) !== 0) throw new Error('expected 0 when cutoff is latest closed week');
console.log('ok: cutoff=' + effective + ' bankedPot=' + pot);
