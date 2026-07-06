import fs from 'fs';

const backup = JSON.parse(fs.readFileSync('c:/Users/drsta/Downloads/evolve-full-backup-2026-07-06.json', 'utf8'));

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

function weekKeyAtOrBeforePotCutoff(wk, cutoff) {
  if (!wk || !cutoff) return false;
  return compareIsoWeekKeys(wk, cutoff) <= 0;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function weekStartFromDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateToWeekKey(d) {
  const temp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  temp.setUTCDate(temp.getUTCDate() + 3 - (temp.getUTCDay() || 7));
  const year = temp.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((temp - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function weekDates(off) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + off * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function weekKey(off = 0) {
  const monday = weekDates(off)[0];
  const temp = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()));
  temp.setUTCDate(temp.getUTCDate() + 3 - (temp.getUTCDay() || 7));
  const year = temp.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((temp - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function offsetForWeekKey(wk) {
  const cur = weekKey(0);
  if (wk === cur) return 0;
  // brute: scan -60..0
  for (let o = 0; o >= -60; o--) {
    if (weekKey(o) === wk) return o;
  }
  return null;
}

function isIsoWeekEndedForOffset(off) {
  if (off < 0) return true;
  if (off > 0) return false;
  const now = new Date();
  const day = now.getDay();
  return day === 0; // Sunday midnight - simplified: only past weeks in backup are locked anyway
}

function weekEntirelyBeforeTrackingStart(off, startDate) {
  const dates = weekDates(off);
  const weekSun = isoDate(new Date(dates[6]));
  return weekSun < startDate.slice(0, 10);
}

function habitEffectiveTier(h, wk, wd) {
  const hd = wd?.habitData?.[h.id];
  if (hd?.locked && (hd.tierAtLock === 'growth' || hd.tierAtLock === 'core')) return hd.tierAtLock;
  return h.tier === 'growth' ? 'growth' : 'core';
}

function habitAppliesToConsistencyWeek(h, wk) {
  const ad = String(h.addedDate || '').slice(0, 10);
  if (!ad) return true;
  const fk = dateToWeekKey(weekStartFromDate(ad));
  return fk <= wk;
}

function effectiveWeeklyTargetForWeek(h, wk) {
  return Number(h.threshold) || 1;
}

function qualifiesFromData(h, wk, hd) {
  if (!hd) return false;
  const thr = effectiveWeeklyTargetForWeek(h, wk);
  if (h.metric === 'days') {
    const dc = (hd.days || []).filter(Boolean).length;
    return dc >= thr;
  }
  if (h.metric === 'sessions' || h.metric === 'km') {
    const dv = hd.dayValues || [];
    const total = dv.reduce((a, b) => a + Number(b || 0), 0);
    return total >= thr;
  }
  return (Number(hd.value) || 0) >= thr;
}

function weekGoalConsistent(goalId, wk, P) {
  const wd = P.weeks[wk];
  if (!wd?.habitData) return false;
  const habits = habitsForGoalInWeek(goalId, wk, P);
  const core = habits.filter(h => habitEffectiveTier(h, wk, wd) === 'core' && habitAppliesToConsistencyWeek(h, wk));
  if (!core.length) return false;
  return core.every(h => qualifiesFromData(h, wk, wd.habitData[h.id]));
}

function weekCountsTowardDisc(goal, wk, P) {
  const off = offsetForWeekKey(wk);
  if (off === null) return false;
  if (weekEntirelyBeforeTrackingStart(off, P.user.startDate || goal.startDate)) return false;
  const habits = habitsForGoalInWeek(goal.id, wk, P);
  const cores = habits.filter(h => habitEffectiveTier(h, wk, P.weeks[wk]) === 'core' && habitAppliesToConsistencyWeek(h, wk));
  if (!cores.length) return false;
  const wd = P.weeks[wk];
  return wd && Object.keys(wd.habitData || {}).length > 0 && off <= 0;
}

function trackedWeeksForGoal(goal, P) {
  const start = weekStartFromDate(goal.startDate || P.user.startDate);
  const currentMonday = weekDates(0)[0];
  const keys = [];
  let ptr = new Date(start);
  while (ptr <= currentMonday) {
    const k = dateToWeekKey(ptr);
    if (weekCountsTowardDisc(goal, k, P)) keys.push(k);
    ptr.setDate(ptr.getDate() + 7);
  }
  return keys;
}

function habitGoalIdForWeek(h, wk, P) {
  const wd = P.weeks[wk];
  const hd = wd?.habitData?.[h.id];
  if (hd?.locked && hd.goalIdAtLock) return hd.goalIdAtLock;
  return h.goalId;
}

function habitsForGoalInWeek(goalId, wk, P) {
  const wd = P.weeks[wk];
  if (!wd?.habitData) return [];
  const out = [];
  for (const h of P.habits) {
    if (!wd.habitData[h.id]) continue;
    if (habitGoalIdForWeek(h, wk, P) !== goalId) continue;
    out.push(h);
  }
  return out;
}

function computeRecoveryTimeline(g, P) {
  const keys = trackedWeeksForGoal(g, P);
  const floorFrac = (Number(g.floor) || 80) / 100;
  const recoveryByWeek = {};
  let chapterStart = 0, recovery = false, prevPct = null, cutoff = '';
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const winStart = chapterStart;
    const winLen = i - winStart + 1;
    if (winLen < 2) { recoveryByWeek[k] = false; continue; }
    let ok = 0;
    for (let j = winStart; j <= i; j++) if (weekGoalConsistent(g.id, keys[j], P)) ok++;
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
  return { recoveryActive: recovery, potExcludedUpToWeekKey: cutoff, recoveryByWeek, weeks: keys };
}

function goalPotExcludedWeekKey(g, P) {
  const tl = computeRecoveryTimeline(g, P);
  let merged = mergePotExcludedWeekKey(g.potExcludedUpToWeekKey || '', g.lastPotResetWeekKey || '');
  merged = mergePotExcludedWeekKey(merged, g.potResetNoticeShownForWeekKey || '');
  merged = mergePotExcludedWeekKey(merged, tl.potExcludedUpToWeekKey || '');
  return merged;
}

function goalRecoveryActiveForWeek(g, wk, tl) {
  const off = offsetForWeekKey(wk);
  if (off !== null && off < 0) return !!tl.recoveryByWeek[wk];
  return !!g.recoveryActive;
}

function habitPotContribution(h, wk, g, P, tl, forHistory) {
  const hd = P.weeks[wk]?.habitData?.[h.id];
  if (!qualifiesFromData(h, wk, hd)) return 0;
  const cutoff = goalPotExcludedWeekKey(g, P);
  if (!forHistory && cutoff && weekKeyAtOrBeforePotCutoff(wk, cutoff)) return 0;
  const rec = goalRecoveryActiveForWeek(g, wk, tl);
  const tier = habitEffectiveTier(h, wk, P.weeks[wk]);
  if (rec && tier === 'growth') return 0;
  const base = Number(h.pot) || 0;
  if (rec && tier === 'core' && g.recoveryBoostEnabled) return Math.ceil(base * 1.3);
  return base;
}

function bankedPotWeekKeysForGoal(g, P) {
  const cutoff = goalPotExcludedWeekKey(g, P);
  const keys = trackedWeeksForGoal(g, P);
  let banked = cutoff ? keys.filter(k => compareIsoWeekKeys(k, cutoff) > 0) : keys.slice();
  if (cutoff) banked = banked.filter(k => weekGoalConsistent(g.id, k, P));
  return banked;
}

function computeGoalPotTotalForGoal(g, P) {
  const tl = computeRecoveryTimeline(g, P);
  let pot = 0;
  const banked = bankedPotWeekKeysForGoal(g, P);
  const cutoff = goalPotExcludedWeekKey(g, P);
  const byWeek = {};
  banked.forEach(wk => {
    habitsForGoalInWeek(g.id, wk, P).forEach(h => {
      const c = habitPotContribution(h, wk, g, P, tl);
      pot += c;
      byWeek[wk] = (byWeek[wk] || 0) + c;
    });
  });
  return { pot, cutoff, banked, byWeek, tl: tl.potExcludedUpToWeekKey, tracked: trackedWeeksForGoal(g, P) };
}

function analyzeProfile(pid, goalName) {
  const P = backup.profiles[pid];
  const g = P.goals.find(x => x.name.toLowerCase().includes(goalName.toLowerCase()));
  if (!g) return console.log('goal not found', pid, goalName);
  const r = computeGoalPotTotalForGoal(g, P);
  const weeksForPct = r.cutoff
    ? r.tracked.filter(k => compareIsoWeekKeys(k, r.cutoff) > 0)
    : r.tracked.slice();
  const consistent = weeksForPct.filter(k => weekGoalConsistent(g.id, k, P)).length;
  const pct = weeksForPct.length ? Math.round((consistent / weeksForPct.length) * 100) : null;

  // pot without cutoff for comparison
  let potNoCutoff = 0;
  r.tracked.forEach(wk => {
    habitsForGoalInWeek(g.id, wk, P).forEach(h => {
      potNoCutoff += habitPotContribution(h, wk, g, P, computeRecoveryTimeline(g, P), true);
    });
  });

  console.log('\n===', P.user.name, '-', g.name, '===');
  console.log('stored cutoff:', g.potExcludedUpToWeekKey);
  console.log('effective cutoff:', r.cutoff);
  console.log('computed timeline cutoff:', r.tl);
  console.log('recoveryActive:', g.recoveryActive);
  console.log('tracked weeks:', r.tracked.join(', '));
  console.log('banked weeks:', r.banked.join(', '));
  console.log('pot (with cutoff):', r.pot);
  console.log('pot (no cutoff):', potNoCutoff);
  console.log('consistency pct:', pct, `(${consistent}/${weeksForPct.length})`);
  console.log('pot by banked week:', r.byWeek);
}

analyzeProfile('profile_yo2s8i0', '3D printer');
analyzeProfile('profile_tbrvhwc', 'Robot vacuum');
