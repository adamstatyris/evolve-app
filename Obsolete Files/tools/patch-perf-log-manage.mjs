import fs from 'fs';

const path = 'index.html';
let h = fs.readFileSync(path, 'utf8');

function mustReplace(label, from, to) {
  if (!h.includes(from)) throw new Error('missing: ' + label);
  h = h.replace(from, to);
  console.log('ok', label);
}

// --- CSS: past goals details chevron ---
mustReplace(
  'past-goals-css',
  `.manage-past-goals{margin-top:var(--s3)}
.manage-past-goals summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:var(--s2)}
.manage-past-goals-inner{padding-top:var(--s2)}`,
  `.manage-past-goals{margin-top:var(--s3)}
.manage-past-goals summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:var(--s2)}
.manage-past-goals summary::-webkit-details-marker{display:none}
.manage-past-goals-chevron{color:var(--text-muted);font-size:1.1rem;line-height:1;flex-shrink:0;transition:transform .18s ease}
.manage-past-goals[open] .manage-past-goals-chevron{transform:rotate(-90deg)}
.manage-past-goals-inner{padding-top:var(--s2)}`
);

// --- habitShownOnTrackerWeek: optional weekSun ---
mustReplace(
  'habitShownOnTrackerWeek',
  `function habitShownOnTrackerWeek(h,off){
  const ad=habitAddedDateStr(h);
  if(!ad)return true;
  try{
    const dates=weekDates(off);
    const weekSun=isoDate(new Date(dates[6]));
    return ad<=weekSun;
  }catch(e){return true;}
}`,
  `function habitShownOnTrackerWeek(h,off,weekSunOpt){
  const ad=habitAddedDateStr(h);
  if(!ad)return true;
  try{
    let weekSun=weekSunOpt;
    if(!weekSun){
      const dates=weekDates(off);
      weekSun=isoDate(new Date(dates[6]));
    }
    return ad<=weekSun;
  }catch(e){return true;}
}`
);

// --- manage tab: defer pot + past goals state + tracker fp ---
mustReplace(
  'manage-vars',
  `let _goalsTabEditMode=false;
let _goalsTabExpandedGoals=new Set();
let _savedHabitsSectionExpanded=false;`,
  `let _goalsTabEditMode=false;
let _goalsTabExpandedGoals=new Set();
let _savedHabitsSectionExpanded=false;
let _pastGoalsDetailsOpen=false;
let _trackerRenderFp='';
let _goalsTabPotFillScheduled=false;`
);

mustReplace(
  'goalsTabRenderFingerprint',
  `function goalsTabRenderFingerprint(){const goals=activeGoals();const oldGoals=(S.goals||[]).filter(function(g){return g&&g.status==='completed';});const goalsPart=goals.map(function(g){return [g.id,g.name,g.emoji,Number(g.target)||0,computeGoalPotTotalForGoal(g)].join(':');}).join('|');const oldPart=oldGoals.map(function(g){return g.id+':'+(typeof g.goalCompletedTrackedWeeks==='number'?g.goalCompletedTrackedWeeks:snapshotGoalCompletedWeeksCount(g));}).join('|');const habitsPart=(S.habits||[]).filter(function(h){return h.active&&!h.archived;}).map(function(h){return h.id+':'+h.goalId+':'+h.title+':'+(habitGoalRetetherCooldownRemainingMs(h)>0?1:0);}).join('|');return [_goalsTabEditMode?1:0,[..._goalsTabExpandedGoals].sort().join(','),goalsPart,oldPart,habitsPart,(typeof useKidsLanguage==='function'&&useKidsLanguage()?1:0)].join('::');}`,
  `function goalsTabPotLinePlaceholder(g){const tgt=Number(g.target)||0;if(tgt>0)return '<div class="goals-tab-card__pot" data-goal-pot-line="'+escAttr(g.id)+'">Pot: <strong class="goals-tab-pot-val">…</strong> / '+fmtGoalPotAmount(g,tgt)+' target</div>';return '<div class="goals-tab-card__pot" data-goal-pot-line="'+escAttr(g.id)+'">Pot: <strong class="goals-tab-pot-val">…</strong> · add a savings target in the goal editor for a progress line</div>';}
function scheduleGoalsTabPotLineFill(host){if(!host)host=document.getElementById('goalsTabBody');if(!host||!host.querySelector('[data-goal-pot-line]'))return;if(_goalsTabPotFillScheduled)return;_goalsTabPotFillScheduled=true;requestAnimationFrame(function(){_goalsTabPotFillScheduled=false;const root=document.getElementById('goalsTabBody');if(!root)return;root.querySelectorAll('[data-goal-pot-line]').forEach(function(el){const gid=el.getAttribute('data-goal-pot-line');const g=goalById(gid);if(!g)return;const pot=computeGoalPotTotalForGoal(g);const valEl=el.querySelector('.goals-tab-pot-val');if(valEl)valEl.textContent=fmtGoalPotAmount(g,pot);});});}
function onPastGoalsDetailsToggle(el){if(el&&el.matches&&el.matches('.manage-past-goals'))_pastGoalsDetailsOpen=!!el.open;}
function goalsTabRenderFingerprint(){const goals=activeGoals();const oldGoals=(S.goals||[]).filter(function(g){return g&&g.status==='completed';});const goalsPart=goals.map(function(g){return [g.id,g.name,g.emoji,Number(g.target)||0].join(':');}).join('|');const oldPart=oldGoals.map(function(g){return g.id+':'+(typeof g.goalCompletedTrackedWeeks==='number'?g.goalCompletedTrackedWeeks:snapshotGoalCompletedWeeksCount(g));}).join('|');const habitsPart=(S.habits||[]).filter(function(h){return h.active&&!h.archived;}).map(function(h){return h.id+':'+h.goalId+':'+h.title+':'+(habitGoalRetetherCooldownRemainingMs(h)>0?1:0);}).join('|');return [_goalsTabEditMode?1:0,[..._goalsTabExpandedGoals].sort().join(','),goalsPart,oldPart,habitsPart,goalPotTotalCacheFingerprint(),(typeof useKidsLanguage==='function'&&useKidsLanguage()?1:0)].join('::');}`
);

mustReplace(
  'goals-pot-line',
  `goals.forEach(function(g){const pot=computeGoalPotTotalForGoal(g);const tgt=Number(g.target)||0;const potLine=tgt>0?'<div class="goals-tab-card__pot">Pot: <strong>'+fmtGoalPotAmount(g,pot)+'</strong> / '+fmtGoalPotAmount(g,tgt)+' target</div>':'<div class="goals-tab-card__pot">Pot: <strong>'+fmtGoalPotAmount(g,pot)+'</strong> · add a savings target in the goal editor for a progress line</div>';`,
  `goals.forEach(function(g){const potLine=goalsTabPotLinePlaceholder(g);`
);

mustReplace(
  'past-goals-details',
  `html+='<details class="old-goals-section manage-past-goals"><summary class="manage-past-goals-summary old-goals-section__title">'+(kid?'Past goals':'Past goals')+' ('+oldGoals.length+')</summary><div class="manage-past-goals-inner">';`,
  `html+='<details class="old-goals-section manage-past-goals"' + (_pastGoalsDetailsOpen ? ' open' : '') + ' ontoggle="onPastGoalsDetailsToggle(this)"><summary class="manage-past-goals-summary old-goals-section__title"><span>'+(kid?'Past goals':'Past goals')+' ('+oldGoals.length+')</span><span class="manage-past-goals-chevron" aria-hidden="true">›</span></summary><div class="manage-past-goals-inner">';`
);

mustReplace(
  'renderGoalsTab-paint-end',
  `host.innerHTML=html;};paint();bindOldGoalsSwipeHandlers(host);`,
  `host.innerHTML=html;};const prevPast=host.querySelector('details.manage-past-goals');if(prevPast)_pastGoalsDetailsOpen=prevPast.open;paint();bindOldGoalsSwipeHandlers(host);scheduleGoalsTabPotLineFill(host);`
);

// --- tracker helpers + renderTracker ---
mustReplace(
  'before-renderTracker',
  `function renderTracker(){if(guidedTourActive())S.offset=0;if(syncAllGoalRecovery())save();const wk=weekKey(S.offset);const dates=weekDates(S.offset);const weekLocked=isIsoWeekEndedForOffset(S.offset);const wkLabelEl=document.getElementById('wkLabel');const wkSubEl=document.getElementById('wkSub');const navNextEl=document.getElementById('navNext');if(!wkLabelEl||!wkSubEl||!navNextEl)return;wkLabelEl.textContent=fmtRange(S.offset);let sub=(S.offset===0?'Current week':S.offset<0?\`\${Math.abs(S.offset)} week\${Math.abs(S.offset)>1?'s':''} ago\`:'Future week')+(weekLocked?' · Locked':'')+(S.offset===0&&!weekLocked&&!trackingLogLocked()?' · Edits close Sunday midnight':'');if(trackingLogLocked())sub+=(S.user.trackingStopped?' · Logging locked (stopped)':' · Logging paused');wkSubEl.innerHTML=sub;navNextEl.disabled=S.offset>=0;const allHabits=trackerHabitsForWeekOffset(S.offset);const habits=allHabits.filter(h=>habitShownOnTrackerWeek(h,S.offset));`,
  `function invalidateTrackerRenderFp(){_trackerRenderFp='';}
function syncTrackerWeekHeader(){const weekLocked=isIsoWeekEndedForOffset(S.offset);const wkLabelEl=document.getElementById('wkLabel');const wkSubEl=document.getElementById('wkSub');const navNextEl=document.getElementById('navNext');if(!wkLabelEl||!wkSubEl||!navNextEl)return;wkLabelEl.textContent=fmtRange(S.offset);let sub=(S.offset===0?'Current week':S.offset<0?\`\${Math.abs(S.offset)} week\${Math.abs(S.offset)>1?'s':''} ago\`:'Future week')+(weekLocked?' · Locked':'')+(S.offset===0&&!weekLocked&&!trackingLogLocked()?' · Edits close Sunday midnight':'');if(trackingLogLocked())sub+=(S.user.trackingStopped?' · Logging locked (stopped)':' · Logging paused');wkSubEl.innerHTML=sub;navNextEl.disabled=S.offset>=0;}
function trackerRenderFingerprint(wk){if(!S)return '';const off=S.offset;const dates=weekDates(off);const weekSun=isoDate(new Date(dates[6]));const habits=trackerHabitsForWeekOffset(off).filter(function(h){return habitShownOnTrackerWeek(h,off,weekSun);});const wd=S.weeks&&S.weeks[wk];const hd=wd&&wd.habitData||{};const habitPart=habits.map(function(h){const d=hd[h.id]||{};const days=(d.days||[]).map(function(x){return x?1:0;}).join('');const dv=(d.dayValues||[]).map(function(x){return String(Number(x)||0);}).join(',');const val=String(Number(d.value)||0);const exp=isLogCardExpanded(wk,h.id)?1:0;return [h.id,h.title,h.tier,h.metric,h.pot,h.goalId,h.listOrder||0,days,dv,val,exp].join(':');}).join('|');return [off,wk,habitPart,trackingLogLocked()?1:0,S.user.trackingStopped?1:0,typeof useKidsLanguage==='function'&&useKidsLanguage()?1:0,guidedTourActive()?1:0,goalPotTotalCacheFingerprint()].join('::');}
function renderTracker(){if(guidedTourActive())S.offset=0;syncTrackerWeekHeader();const wk=weekKey(S.offset);const habitRowsEl=document.getElementById('habitRows');const fp=trackerRenderFingerprint(wk);if(fp===_trackerRenderFp&&habitRowsEl&&habitRowsEl.querySelector('.habit-card, .card.empty, .guided-tour-mock-habit')){flushPotResetSupportQueue();return;}_trackerRenderFp=fp;if(syncAllGoalRecovery())save();beginRenderPass();try{const dates=weekDates(S.offset);const weekSun=isoDate(new Date(dates[6]));const weekLocked=isIsoWeekEndedForOffset(S.offset);const allHabits=trackerHabitsForWeekOffset(S.offset);const habits=allHabits.filter(h=>habitShownOnTrackerWeek(h,S.offset,weekSun));`
);

mustReplace(
  'renderTracker-autoLocks',
  `if(applyHabitAutoLocksForProfile(S))save();document.getElementById('habitRows').innerHTML=habits.map(h=>{`,
  `document.getElementById('habitRows').innerHTML=habits.map(h=>{`
);

mustReplace(
  'renderTracker-end',
  `ensureLogRevealHost();syncGrowthMechanicsUnlockFromData();renderWeekSummary(wk);if(document.getElementById('tab-dashboard')?.classList.contains('active'))refreshDashboardGoalsSubline();flushPotResetSupportQueue();}
function renderWeekSummary`,
  `ensureLogRevealHost();syncGrowthMechanicsUnlockFromData();renderWeekSummary(wk);if(document.getElementById('tab-dashboard')?.classList.contains('active'))refreshDashboardGoalsSubline();flushPotResetSupportQueue();}finally{endRenderPass();}}
function renderWeekSummary`
);

mustReplace(
  'toggleLogCardExpand',
  `function logExpandKey(wk,id){return wk+'|'+id;}function toggleLogCardExpand(wk,id){const k=logExpandKey(wk,id);if(!window._logCardExpanded)_logCardExpanded={};window._logCardExpanded[k]=!window._logCardExpanded[k];renderTracker();}`,
  `function logExpandKey(wk,id){return wk+'|'+id;}function toggleLogCardExpand(wk,id){const k=logExpandKey(wk,id);if(!window._logCardExpanded)_logCardExpanded={};const expanding=!window._logCardExpanded[k];window._logCardExpanded[k]=expanding;const card=document.querySelector('#habitRows .habit-card[data-habit-id="'+CSS.escape(String(id))+'"]');if(card){card.classList.toggle('habit-card--log-collapsed',!expanding);const toggle=card.querySelector('.habit-expand-toggle');if(toggle)toggle.setAttribute('aria-expanded',expanding?'true':'false');_trackerRenderFp=trackerRenderFingerprint(wk);return;}invalidateTrackerRenderFp();renderTracker();}`
);

// invalidate tracker fp when pot cache invalidates
mustReplace(
  'invalidateGoalPotTotalCache',
  `function invalidateGoalPotTotalCache(){_goalPotTotalCacheFp='';_goalPotTotalCache.clear();}`,
  `function invalidateGoalPotTotalCache(){_goalPotTotalCacheFp='';_goalPotTotalCache.clear();invalidateTrackerRenderFp();invalidateGoalsTabRenderFp();}`
);

fs.writeFileSync(path, h);
console.log('done');
