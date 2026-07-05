import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, '..', 'index.html');
let s = fs.readFileSync(p, 'utf8');

// 1) Remove grace constants + functions (keep load())
const graceStart = s.indexOf('const USER_GRACE_CFG_WEEKS=4;');
const graceEnd = s.indexOf('function load(){', graceStart);
if (graceStart < 0 || graceEnd < 0) throw new Error('grace block markers');
s = s.slice(0, graceStart) + s.slice(graceEnd);

// 2) Insert retether/recovery helpers after goalHabits (needs habitListSort + goalHabits in scope)
const goalHabitsNeedle =
  "function goalHabits(goalId,{includeArchived=false}={}){return S.habits.filter(h=>h.goalId===goalId&&(includeArchived?true:(h.active&&!h.archived))).sort(habitListSort);}";
const idxGH = s.indexOf(goalHabitsNeedle);
if (idxGH < 0) throw new Error('goalHabits not found');
const afterGH = idxGH + goalHabitsNeedle.length;

const insertBlock = `
function habitGoalIdForWeek(h,wk){const wd=S.weeks&&S.weeks[wk];const hd=wd&&wd.habitData&&wd.habitData[h.id];if(hd&&hd.locked&&hd.goalIdAtLock)return hd.goalIdAtLock;return h.goalId;}
function habitsForGoalInWeek(goalId,wk){const off=offsetForWeekKey(wk);const ended=off!==null&&isIsoWeekEndedForOffset(off);if(!ended)return goalHabits(goalId);const wd=S.weeks&&S.weeks[wk];if(!wd||!wd.habitData)return[];const out=[];for(const h of S.habits){if(!wd.habitData[h.id])continue;if(habitGoalIdForWeek(h,wk)!==goalId)continue;out.push(h);}return out.sort(habitListSort);}
function goalFirstTrackingWeekKey(g){if(!g)return'';return dateToWeekKey(weekStartFromDate(g.startDate||(S&&S.user&&S.user.startDate)||isoDate(new Date())));}
function goalRecoveryDeferredFirstWeek(g){if(!g)return false;return weekKey(0)===goalFirstTrackingWeekKey(g);}
function weekEndedForWeekKey(wk){const off=offsetForWeekKey(wk);return off!==null&&isIsoWeekEndedForOffset(off);}
function trackedWeeksForGoalThrough(goal,lastWkKey){const all=trackedWeeksForGoal(goal);return all.filter(k=>k<=lastWkKey);}
function goalRollingPctFromWeekKeys(g,weekKeys){if(!weekKeys||!weekKeys.length)return null;const ok=weekKeys.filter(k=>weekGoalConsistentForDisc(g.id,k)).length;return Math.round((ok/weekKeys.length)*100);}
function simulateRecoverySnapshotAtWeekEnd(g,wk){const keys=trackedWeeksForGoalThrough(g,wk);const firstGk=keys.length?keys[0]:'';let recovery=false,lastPct=null,potExcl='';for(let i=0;i<keys.length;i++){const k=keys[i];if(k===firstGk){recovery=false;lastPct=null;continue;}const prefix=keys.slice(0,i+1);const pct=goalRollingPctFromWeekKeys(g,prefix);const floor=g.floor||80;if(pct===null)continue;if(pct>=floor){recovery=false;lastPct=null;continue;}if(!recovery){recovery=true;lastPct=pct;continue;}if(lastPct!==null&&lastPct!==undefined){if(pct<lastPct){potExcl=k;lastPct=pct;}else if(pct>lastPct){lastPct=pct;}}else{lastPct=pct;}}return{recoveryActive:recovery,potExcludedUpToWeekKey:potExcl};}
const HABIT_GOAL_RETETHER_COOLDOWN_MS=28*24*60*60*1000;
function stripGraceKeysFromUser(u){if(!u||typeof u!=='object')return;delete u.gracePeriodEnabled;delete u.graceOfferStepperSeen;}
function habitGoalRetetherCooldownRemainingMs(h){if(!h)return 0;const t=Number(h.lastHabitGoalChangeAt)||0;if(!t)return 0;const elapsed=Date.now()-t;if(elapsed>=HABIT_GOAL_RETETHER_COOLDOWN_MS)return 0;return HABIT_GOAL_RETETHER_COOLDOWN_MS-elapsed;}
function habitFrozenForRetether(h){return habitGoalRetetherCooldownRemainingMs(h)>0;}
function formatRetetherUnlockDate(msLeft){if(msLeft<=0)return '';const d=new Date(Date.now()+msLeft);return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}
`;

s = s.slice(0, afterGH) + insertBlock + s.slice(afterGH);

// 3) habitPotContribution
const oldHPC =
  "function habitPotContribution(h,wk,g){if(!qualifies(h,wk))return 0;if(!g)g=goalById(h.goalId);if(!g)return Number(h.pot)||0;const ex=g.potExcludedUpToWeekKey||'';if(ex&&wk<=ex)return 0;if(g.recoveryActive&&habitEffectiveTier(h,wk)==='growth')return 0;return Number(h.pot)||0;}";
const newHPC =
  "function habitPotContribution(h,wk,g){if(!qualifies(h,wk))return 0;if(!g)g=goalById(h.goalId);if(!g)return Number(h.pot)||0;let ex=g.potExcludedUpToWeekKey||'';let rec=g.recoveryActive;if(weekEndedForWeekKey(wk)){const sim=simulateRecoverySnapshotAtWeekEnd(g,wk);ex=sim.potExcludedUpToWeekKey||'';rec=sim.recoveryActive;}if(ex&&wk<=ex)return 0;if(rec&&habitEffectiveTier(h,wk)==='growth')return 0;return Number(h.pot)||0;}";
if (!s.includes(oldHPC)) throw new Error('habitPotContribution pattern not found');
s = s.replace(oldHPC, newHPC);

const replaces = [
  [
    'function weekCountsTowardDisc(goal,wk){if(!goal||!wk)return false;const off=offsetForWeekKey(wk);if(off===null)return false;if(weekEntirelyBeforeTrackingStart(off))return false;const habits=goalHabits(goal.id);const cores=habits.filter(h=>habitEffectiveTier(h,wk)===\'core\'&&habitAppliesToConsistencyWeek(h,wk));if(!cores.length)return false;return isIsoWeekEndedForOffset(off);}',
    "function weekCountsTowardDisc(goal,wk){if(!goal||!wk)return false;const off=offsetForWeekKey(wk);if(off===null)return false;if(weekEntirelyBeforeTrackingStart(off))return false;const habits=habitsForGoalInWeek(goal.id,wk);const cores=habits.filter(h=>habitEffectiveTier(h,wk)==='core'&&habitAppliesToConsistencyWeek(h,wk));if(!cores.length)return false;return isIsoWeekEndedForOffset(off);}",
  ],
  [
    "function weekGoalConsistent(goalId,wk){const habits=goalHabits(goalId);const core=habits.filter(h=>habitEffectiveTier(h,wk)==='core'&&habitAppliesToConsistencyWeek(h,wk));if(!core.length)return false;return core.every(h=>qualifies(h,wk));}",
    "function weekGoalConsistent(goalId,wk){const habits=habitsForGoalInWeek(goalId,wk);const core=habits.filter(h=>habitEffectiveTier(h,wk)==='core'&&habitAppliesToConsistencyWeek(h,wk));if(!core.length)return false;return core.every(h=>qualifies(h,wk));}",
  ],
  [
    "function goalWeeklyTreatEarned(goalId,wk){return goalHabits(goalId).some(h=>qualifies(h,wk));}",
    "function goalWeeklyTreatEarned(goalId,wk){return habitsForGoalInWeek(goalId,wk).some(h=>qualifies(h,wk));}",
  ],
  [
    'function goalWeekPotSumForHistory(wk,g){let s=0;goalHabits(g.id).forEach(h=>{s+=habitPotContribution(h,wk,g);});return s;}',
    'function goalWeekPotSumForHistory(wk,g){let s=0;habitsForGoalInWeek(g.id,wk).forEach(h=>{s+=habitPotContribution(h,wk,g);});return s;}',
  ],
  [
    'function computeGoalPotTotalForGoal(g){const keys=trackedWeeksForGoal(g);let pot=0;keys.forEach(wk=>{goalHabits(g.id).forEach(h=>{pot+=habitPotContribution(h,wk,g);});});return pot;}',
    'function computeGoalPotTotalForGoal(g){const keys=trackedWeeksForGoal(g);let pot=0;keys.forEach(wk=>{habitsForGoalInWeek(g.id,wk).forEach(h=>{pot+=habitPotContribution(h,wk,g);});});return pot;}',
  ],
];

for (const [a, b] of replaces) {
  if (!s.includes(a)) throw new Error('pattern missing: ' + a.slice(0, 80));
  s = s.replace(a, b);
}

const oldSync =
  "function syncAllGoalRecovery(){if(!S||!S.goals)return false;let touched=false;activeGoals().forEach(g=>{const st=goalStatsInner(g);const pct=st.pct;const floor=g.floor||80;if(pct===null)return;if(pct>=floor){if(g.recoveryActive){g.recoveryActive=false;g.recoveryLastPct=null;touched=true;}return;}const keys=trackedWeeksForGoal(g);const latest=keys.length?keys[keys.length-1]:'';if(!g.recoveryActive){g.recoveryActive=true;g.recoveryLastPct=pct;touched=true;return;}const last=g.recoveryLastPct;if(last!==null&&last!==undefined){if(pct<last){if(latest){const before=g.potExcludedUpToWeekKey||'';g.potExcludedUpToWeekKey=latest;if(before!==latest)_potResetSupportQueue.push({name:g.name,emoji:g.emoji});}g.recoveryLastPct=pct;touched=true;}else if(pct>last){g.recoveryLastPct=pct;touched=true;}}else{g.recoveryLastPct=pct;touched=true;}});return touched;}";
const newSync =
  "function syncAllGoalRecovery(){if(!S||!S.goals)return false;let touched=false;activeGoals().forEach(g=>{if(goalRecoveryDeferredFirstWeek(g)){if(g.recoveryActive){g.recoveryActive=false;g.recoveryLastPct=null;touched=true;}return;}const st=goalStatsInner(g);const pct=st.pct;const floor=g.floor||80;if(pct===null)return;if(pct>=floor){if(g.recoveryActive){g.recoveryActive=false;g.recoveryLastPct=null;touched=true;}return;}const keys=trackedWeeksForGoal(g);const latest=keys.length?keys[keys.length-1]:'';if(!g.recoveryActive){g.recoveryActive=true;g.recoveryLastPct=pct;touched=true;return;}const last=g.recoveryLastPct;if(last!==null&&last!==undefined){if(pct<last){if(latest){const before=g.potExcludedUpToWeekKey||'';g.potExcludedUpToWeekKey=latest;if(before!==latest)_potResetSupportQueue.push({name:g.name,emoji:g.emoji});}g.recoveryLastPct=pct;touched=true;}else if(pct>last){g.recoveryLastPct=pct;touched=true;}}else{g.recoveryLastPct=pct;touched=true;}});return touched;}";
if (!s.includes(oldSync)) throw new Error('syncAllGoalRecovery pattern not found');
s = s.replace(oldSync, newSync);

s = s.replace(
  "function recoveryStatusHTML(g,wk,off){if(!g||weekAppliesGraceMode(g,wk))return'';",
  "function recoveryStatusHTML(g,wk,off){if(!g||goalRecoveryDeferredFirstWeek(g))return'';",
);

const lockSnippet =
  'if(!wd.habitData[id].locked){wd.habitData[id].locked=true;wd.habitData[id].tierAtLock=snap;touched=true;}';
const lockSnippetNew =
  "if(!wd.habitData[id].locked){wd.habitData[id].locked=true;wd.habitData[id].tierAtLock=snap;if(h)wd.habitData[id].goalIdAtLock=h.goalId||'';touched=true;}";
if (!s.includes(lockSnippet)) throw new Error('lock snippet not found');
s = s.replace(lockSnippet, lockSnippetNew);

const insertBackfillGoal = `function backfillGoalIdAtLockOnLockedWeeks(P){if(!P||!P.weeks||!Array.isArray(P.habits))return;Object.keys(P.weeks).forEach(wk=>{const wd=P.weeks[wk];if(!wd||!wd.habitData)return;Object.keys(wd.habitData).forEach(hid=>{const hd=wd.habitData[hid];if(!hd||!hd.locked)return;if(hd.goalIdAtLock)return;const h=P.habits.find(x=>x.id===hid);if(!h)return;hd.goalIdAtLock=h.goalId||'';});});}
`;
s = s.replace(
  'function removeOneOffTestHabitSleepCopy(P){if(!P||!Array.isArray(P.habits))return;',
  insertBackfillGoal + 'function removeOneOffTestHabitSleepCopy(P){if(!P||!Array.isArray(P.habits))return;',
);

s = s.replace(
  'backfillTierAtLockOnLockedWeeks(P);applyHabitAutoLocksForProfile(P);applyGraceWindowRulesForProfile(P);}',
  'backfillTierAtLockOnLockedWeeks(P);backfillGoalIdAtLockOnLockedWeeks(P);applyHabitAutoLocksForProfile(P);stripGraceKeysFromUser(P.user);}',
);

s = s.replace(
  "if(!P.user)P.user={name:'',dob:'',startDate:isoDate(new Date()),setupDone:false,introSeen:false,guideSeen:false,units:'metric',uiPalette:'neutral',seeded:false,gracePeriodEnabled:false,trackingPaused:false,trackingStopped:false,kidAnimationsEnabled:true};",
  "if(!P.user)P.user={name:'',dob:'',startDate:isoDate(new Date()),setupDone:false,introSeen:false,guideSeen:false,units:'metric',uiPalette:'neutral',seeded:false,trackingPaused:false,trackingStopped:false,kidAnimationsEnabled:true};",
);

s = s.replace("if(P.user.gracePeriodEnabled===undefined)P.user.gracePeriodEnabled=false;", '');
s = s.replace(
  'if(P.user.graceOfferStepperSeen===undefined)P.user.graceOfferStepperSeen=false;',
  'if(P.user.habitRetetherRulesStepperSeen===undefined)P.user.habitRetetherRulesStepperSeen=false;',
);

s = s.replace(
  'if(h.addedDate===undefined||h.addedDate===\'\')h.addedDate=P.user.startDate||isoDate(new Date());',
  "if(h.addedDate===undefined||h.addedDate==='')h.addedDate=P.user.startDate||isoDate(new Date());if(h.lastHabitGoalChangeAt===undefined)h.lastHabitGoalChangeAt=0;",
);

s = s.replace(
  'guideSeen:false,graceOfferStepperSeen:false,units:',
  'guideSeen:false,habitRetetherRulesStepperSeen:false,units:',
);
s = s.replace('seeded:false,gracePeriodEnabled:false,trackingPaused:', 'seeded:false,trackingPaused:');

s = s.replace(
  'guideSeen:false,graceOfferStepperSeen:false,units,uiPalette:pal',
  'guideSeen:false,habitRetetherRulesStepperSeen:false,units,uiPalette:pal',
);
s = s.replace(
  'seeded:false,gracePeriodEnabled:false,trackingPaused:false,trackingStopped:',
  'seeded:false,trackingPaused:false,trackingStopped:',
);

// buildExactReminderScheduleRowsForSupabase — remove grace Sunday inner block
const gracePush =
  "if(S&&S.user&&notify&&!paused&&!stopped){try{if(userGraceWindowOpen()&&new Date(nowMs).getDay()===0&&profileGraceWeekKeys(S.user).includes(weekKey(0))){if(kid){add(todayYmd,'09:00','graceWinSun9','Good morning — ask a grown-up about Grace in Settings → Tracking if you want gentler weeks.');add(todayYmd,'16:00','graceWinSun16','Grace can make your first weeks gentler — ask a grown-up about Settings → Tracking.');add(todayYmd,'21:00','graceWinSun21','Tonight the week locks — finish logging with a grown-up.');}else{add(todayYmd,'09:00','graceWinSun9','Sunday 9am: Grace (optional) is in Settings → Tracking — softer scoring in your first four weeks.');add(todayYmd,'16:00','graceWinSun16','Grace period (optional): softer scoring in your first four weeks — turn it on in Settings → Tracking if you want it.');add(todayYmd,'21:00','graceWinSun21','Sunday evening: your week locks at midnight — log anything missing in the Log tab.');}}}catch(e){}}";
if (!s.includes(gracePush)) throw new Error('grace push block not found');
s = s.replace(gracePush, '');

const weekKeyGraceFn =
  "function weekKeyInProfileInitialGrace(wk){if(!wk||!S||!S.user)return false;const u=S.user;const startWk=dateToWeekKey(weekStartFromDate(u.startDate||isoDate(new Date())));if(wk===startWk)return true;return profileGraceWeekKeys(u).includes(wk);}";
const profileGracePreviewFn = "function profileGracePreviewActive(){return gracePeriodUserEnabled()&&userGraceWindowOpen();}";
const weekAppliesGraceFn =
  "function weekAppliesGraceMode(goal,wk){if(!goal||!wk)return false;return weekKeyInProfileInitialGrace(wk);}";
if (s.includes(weekKeyGraceFn)) s = s.replace(weekKeyGraceFn, '');
if (s.includes(profileGracePreviewFn)) s = s.replace(profileGracePreviewFn, '');
if (s.includes(weekAppliesGraceFn)) s = s.replace(weekAppliesGraceFn, '');

fs.writeFileSync(p, s);
console.log('phase1 ok');
