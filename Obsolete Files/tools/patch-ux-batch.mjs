import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, '..', 'index.html');
let s = fs.readFileSync(file, 'utf8');

function replace(oldStr, newStr, label) {
  if (!s.includes(oldStr)) throw new Error(`Missing patch target: ${label}`);
  s = s.replace(oldStr, newStr);
}

// --- CSS ---
replace(
  `.config-card.manage-habit-card{position:relative;padding-bottom:calc(var(--s5) + 44px)}`,
  `.config-card.manage-habit-card{position:relative;padding:var(--s4);padding-bottom:calc(var(--s4) + 36px)}
.manage-habit-card__foot{position:absolute;right:var(--s4);bottom:var(--s4);display:flex;align-items:center;gap:var(--s2);z-index:2}
.hw-toggle.hw-toggle--solo{padding:4px;border-radius:var(--r-full)}
.hw-toggle.hw-toggle--solo .hw-toggle-track{margin:0}
.btn-pencil-icon{display:inline-flex;align-items:center;justify-content:center;width:1.15rem;height:1.15rem;color:var(--text-muted)}
.btn-pencil-icon svg{width:1.15rem;height:1.15rem;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.btn-lock-tick-icon{display:inline-flex;align-items:center;justify-content:center;font-size:1rem;font-weight:800;color:var(--text-muted);line-height:1}
.btn.btn-ghost.btn-sm.btn-icon-action{min-width:2.25rem;padding:var(--s1) var(--s2)}
.overview-subline-row{display:flex;align-items:flex-start;gap:var(--s4);margin-top:var(--s2)}
.overview-subline-col{flex:1;min-width:0}
.overview-circles--inline{flex:0 0 auto;display:flex;align-items:center;justify-content:center;max-width:28%}
.overview-circles--row{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--s3);margin-top:var(--s3)}
.overview-goal-circle{width:4.25rem;height:4.25rem;border-radius:50%;display:grid;place-items:center;border:2px solid var(--border);background:var(--surface-3);box-shadow:inset 0 1px 0 rgba(255,255,255,.06);flex-shrink:0}
.overview-goal-circle--green{border-color:var(--green);box-shadow:0 0 12px rgba(63,185,80,.18)}
.overview-goal-circle--amber{border-color:var(--amber)}
.overview-goal-circle--red{border-color:var(--red);box-shadow:0 0 12px rgba(248,81,73,.15)}
.overview-goal-circle--blue{border-color:var(--blue)}
.overview-goal-circle-val{font-size:1.05rem;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;color:var(--text)}
.overview-goal-circle-pct{font-size:.62rem;font-weight:700;opacity:.85}
.home-week-history-summary{display:flex;align-items:center;justify-content:space-between;gap:var(--s3)}
.home-week-history-chevron{color:var(--text-muted);font-size:1.1rem;line-height:1;flex-shrink:0}`,
  'manage habit css'
);

replace(
  `.goal-pills-row{display:flex;flex-wrap:wrap;gap:var(--s2);margin-top:var(--s3)}`,
  `.goal-pills-row{display:flex;flex-wrap:wrap;gap:var(--s2);margin-top:var(--s3)}
.home-insights-region{margin-top:var(--s4)}`,
  'insights margin'
);

// --- meta portrait ---
replace(
  `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">`,
  `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="screen-orientation" content="portrait">`,
  'portrait meta'
);

// --- dashboard section order ---
replace(
  `    <div class="card dashboard-overview glow-blue" id="dashboardOverview"></div>
    <div class="card dashboard-this-week" id="dashboardThisWeek" data-guided-tour="dashboard-this-week" style="margin-top:var(--s4)"></div>
    <div id="homeInsightsMount" class="home-insights-region"></div>`,
  `    <div class="card dashboard-overview glow-blue" id="dashboardOverview"></div>
    <div id="homeInsightsMount" class="home-insights-region"></div>
    <div class="card dashboard-this-week" id="dashboardThisWeek" data-guided-tour="dashboard-this-week" style="margin-top:var(--s4)"></div>`,
  'dashboard order'
);

// --- week history chevron ---
replace(
  `<summary class="home-week-history-summary" style="cursor:pointer;padding:var(--s3);font-weight:700;list-style:none">Week history <span class="small-note" style="font-weight:400;color:var(--text-muted);margin-left:var(--s2)">Past closed weeks</span></summary>`,
  `<summary class="home-week-history-summary" style="cursor:pointer;padding:var(--s3);font-weight:700;list-style:none"><span>Week history <span class="small-note" style="font-weight:400;color:var(--text-muted);margin-left:var(--s2)">Past closed weeks</span></span><span class="home-week-history-chevron" aria-hidden="true">›</span></summary>`,
  'week history chevron'
);

// --- manage tab header ---
replace(
  `<button type="button" class="btn btn-ghost btn-sm" id="goalsTabEditBtn" onclick="goalsTabToggleEdit()">Edit</button>`,
  `<button type="button" class="btn btn-ghost btn-sm btn-icon-action" id="goalsTabEditBtn" onclick="goalsTabToggleEdit()" aria-label="Edit goals" title="Edit goals"></button>`,
  'goals edit btn'
);

replace(
  `            <button type="button" class="btn btn-ghost btn-sm" id="manageHabitsLockBtn" onclick="toggleManageHabitsEditLock()">Edit</button>
            <button class="btn btn-ghost btn-sm" onclick="openGoalModal()">+ Goal</button>
            <button class="btn btn-primary btn-sm" onclick="openHabitModal()">+ Habit</button>`,
  `            <button type="button" class="btn btn-ghost btn-sm btn-icon-action" id="manageHabitsLockBtn" onclick="toggleManageHabitsEditLock()" aria-label="Edit habits" title="Edit habits"></button>
            <button class="btn btn-primary btn-sm" onclick="openHabitModal()">+ Habit</button>`,
  'habits header'
);

replace(
  `            <div class="muted small-note">Completed or retired habits — reuse anytime.</div>`,
  `            <div class="muted small-note">Completed or retired habits — reuse anytime.</div>
            <div class="muted small-note" style="margin-top:var(--s1)">Press <strong>×</strong> to completely delete a past habit.</div>`,
  'saved habits hint'
);

// --- confirm modals ---
replace(
  `<div class="overlay app-dialog" id="mConfirmRemoveBanked" role="dialog" aria-modal="true" aria-labelledby="confirmRemoveBankedTitle" style="z-index:10022">`,
  `<div class="overlay app-dialog" id="mConfirmArchiveHabit" role="dialog" aria-modal="true" aria-labelledby="confirmArchiveHabitTitle" style="z-index:10021">
  <div class="modal" onclick="event.stopPropagation()" style="max-width:440px">
    <h2 id="confirmArchiveHabitTitle">Send to Saved habits?</h2>
    <p id="confirmArchiveHabitText" class="small-note" style="margin-top:var(--s3);line-height:1.65;color:var(--text-muted)">Are you sure you want to send this habit to Saved list?</p>
    <div class="modal-footer" style="margin-top:var(--s5)">
      <button type="button" class="btn btn-ghost" id="confirmArchiveHabitNo">No</button>
      <button type="button" class="btn btn-primary" id="confirmArchiveHabitYes">Yes</button>
    </div>
  </div>
</div>
<div class="overlay app-dialog" id="mConfirmAddThirdGoal" role="dialog" aria-modal="true" aria-labelledby="confirmAddThirdGoalTitle" style="z-index:10021">
  <div class="modal" onclick="event.stopPropagation()" style="max-width:440px">
    <h2 id="confirmAddThirdGoalTitle">Keep it simple?</h2>
    <p id="confirmAddThirdGoalText" class="small-note" style="margin-top:var(--s3);line-height:1.65;color:var(--text-muted)">This app works better when you keep things simple. More than 2 goals at a time might stretch things too much.<br><br>Are you sure?</p>
    <div class="modal-footer" style="margin-top:var(--s5)">
      <button type="button" class="btn btn-ghost" id="confirmAddThirdGoalNo">No</button>
      <button type="button" class="btn btn-primary" id="confirmAddThirdGoalYes">Yes</button>
    </div>
  </div>
</div>
<div class="overlay app-dialog" id="mConfirmRemoveBanked" role="dialog" aria-modal="true" aria-labelledby="confirmRemoveBankedTitle" style="z-index:10022">`,
  'confirm modals'
);

// --- JS helpers after REWARD_BANDS ---
replace(
  `function rewardPresetIcon(label){return REWARD_ICONS[String(label||'')]||'🎁';}`,
  `function rewardPresetIcon(label){return REWARD_ICONS[String(label||'')]||'🎁';}
const PENCIL_ICON_SVG='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>';
const LOCK_TICK_ICON_HTML='<span class="btn-lock-tick-icon" aria-hidden="true">✓</span>';
const MAX_ACTIVE_GOALS=3;
function pencilIconHTML(){return '<span class="btn-pencil-icon">'+PENCIL_ICON_SVG+'</span>';}
function setIconActionBtn(btn,mode,labels){if(!btn)return;const kid=typeof useKidsLanguage==='function'&&useKidsLanguage();if(mode==='pencil'){btn.innerHTML=pencilIconHTML();btn.setAttribute('aria-label',labels.pencil||(kid?'Edit':'Edit'));btn.title=labels.pencilTitle||'';}else if(mode==='lockTick'){btn.innerHTML=LOCK_TICK_ICON_HTML;btn.setAttribute('aria-label',labels.lock||(kid?'Lock':'Lock'));btn.title=labels.lockTitle||'';}else{btn.textContent=labels.text||'';btn.setAttribute('aria-label',labels.text||'');btn.title=labels.title||'';}}
function rewardTreatNeedsMoney(label){const t=String(label||'').trim();if(!t)return false;return !(REWARD_BANDS.free||[]).includes(t);}
function selectedGoalRewardLabel(){const draft=getGoalRewardDraft();if(draft)return draft;const v=document.getElementById('gRewardPreset')?.value||'';if(v&&v!=='__custom__')return v;return'';}
function syncGoalTreatBudgetVisibility(){const wtbWrap=document.getElementById('gWeeklyTreatBudgetWrap');const wtbInp=document.getElementById('gWeeklyTreatBudget');if(!wtbWrap)return;const isEdit=!!document.getElementById('goalId')?.value;const typeEl=document.getElementById('gGoalType');const isPoints=((typeEl&&typeEl.value)||'money')==='points';if(!isPoints)return;const needs=rewardTreatNeedsMoney(selectedGoalRewardLabel());if(needs){wtbWrap.removeAttribute('hidden');if(wtbInp&&!isEdit)wtbInp.setAttribute('required','');}else{wtbWrap.setAttribute('hidden','');if(wtbInp){wtbInp.removeAttribute('required');wtbInp.value='0';}}}
function manageHabitSort(a,b){const ta=(a.tier==='growth'?1:0);const tb=(b.tier==='growth'?1:0);if(ta!==tb)return ta-tb;return habitListSort(a,b);}
function habitHasTrackerDataInWeek(h,wk){const wd=S.weeks&&S.weeks[wk];const hd=wd&&wd.habitData&&wd.habitData[h.id];if(!hd)return false;if(hd.locked)return true;if(hd.days&&hd.days.some(Boolean))return true;if(hd.dayValues&&hd.dayValues.some(v=>(Number(v)||0)>0))return true;return(Number(hd.value)||0)>0;}
function trackerHabitsForWeekOffset(off){const active=trackerHabitsOrdered();const weekEnded=off!==null&&isIsoWeekEndedForOffset(off);if(!weekEnded)return active.sort(manageHabitSort);const wk=weekKey(off);const seen=new Set(active.map(h=>h.id));const out=active.slice();S.habits.forEach(h=>{if(seen.has(h.id))return;if(!habitHasTrackerDataInWeek(h,wk))return;out.push(h);});return out.sort(manageHabitSort);}
function overviewGoalCirclesHTML(active){return active.map(g=>{const st=goalStats(g);const pct=st.pct;const tone=gaugeTone(pct);const val=pct===null?'—':String(pct);const pctSuffix=pct!==null?'<span class="overview-goal-circle-pct">%</span>':'';const tip=g.name+' · '+(pct===null?'No score yet':pct+'%');return '<div class="overview-goal-circle overview-goal-circle--'+tone.disc+'" title="'+escAttr(tip)+'" aria-label="'+escAttr(tip)+'"><span class="overview-goal-circle-val">'+escDash(val)+pctSuffix+'</span></div>';}).join('');}
function overviewMotivationBlockHTML(active){const n=active.length;const circ=overviewGoalCirclesHTML(active);if(n===1)return '<div class="overview-subline-row"><div class="overview-subline-col"><div class="muted" id="dashboardGoalsSubline"></div></div><div class="overview-circles overview-circles--inline">'+circ+'</div></div>';if(n>=2)return '<div class="muted" id="dashboardGoalsSubline"></div><div class="overview-circles overview-circles--row">'+circ+'</div>';return '<div class="muted" id="dashboardGoalsSubline"></div>';}
function manageHabitCardHTML(h,opts){opts=opts||{};const g=goalById(h.goalId);const uc=opts.unlocked?' manage-habit-card--unlocked':'';const delTop=opts.deleteTop?'<button type="button" class="btn btn-danger btn-sm manage-habit-card__del" onclick="event.stopPropagation();'+opts.deleteTop+'">Delete</button>':'';const sub=opts.subline||(g?.name||'—')+' · '+metricLabel(h);const toggleOn=opts.toggleOn!==false;const toggleTitle=opts.toggleTitle||'';const toggleClick=opts.toggleClick||'';const footExtra=opts.footExtra||'';return '<div class="card config-card manage-habit-card glow-blue'+uc+'" data-habit-id="'+escHTML(h.id)+'">'+delTop+'<div class="manage-habit-card__grid"><div class="manage-habit-card__emoji-col"><div class="habit-emoji">'+(h.emoji||'🎯')+'</div><span class="pill habit-log-tier-pill '+(h.tier==='core'?'pill-core':'pill-growth')+'">'+String(h.tier||'').toUpperCase()+'</span></div><div class="manage-habit-card__main"><div class="manage-habit-card__top"><span class="goal-title">'+escDash(h.title)+'</span>'+habitMasteryBadgeHTML(h)+legendaryBankPillHTML(h)+'</div><div class="goal-sub">'+sub+'</div></div></div><div class="manage-habit-card__foot"><button type="button" class="hw-toggle hw-toggle--solo'+(toggleOn?' on':'')+' manage-habit-card__tog" onclick="event.stopPropagation();'+toggleClick+'" title="'+escAttr(toggleTitle)+'" aria-label="'+escAttr(toggleTitle)+'"><span class="hw-toggle-track"><span class="hw-toggle-thumb"></span></span></button>'+footExtra+'</div></div>';}`,
  'js helpers'
);

replace(
  `function handleRewardPreset(){const v=document.getElementById('gRewardPreset')?.value||'';if(v==='__custom__')return;setGoalRewardDraft(v);}`,
  `function handleRewardPreset(){const v=document.getElementById('gRewardPreset')?.value||'';if(v==='__custom__')return;setGoalRewardDraft(v);syncGoalTreatBudgetVisibility();}`,
  'handleRewardPreset'
);

replace(
  `el.value=pick;syncGoalRewardPresetSelectFromDraft();}`,
  `el.value=pick;syncGoalRewardPresetSelectFromDraft();syncGoalTreatBudgetVisibility();}`,
  'populateGoalRewardPresets sync'
);

replace(
  `setGoalRewardDraft(t);syncGoalRewardPresetSelectFromDraft();}`,
  `setGoalRewardDraft(t);syncGoalRewardPresetSelectFromDraft();syncGoalTreatBudgetVisibility();}`,
  'editGoalRewardLabel sync'
);

// syncGoalFormForType - replace wtb hide for points block
replace(
  `if(wtbWrap){if(isEdit||isPoints)wtbWrap.setAttribute('hidden','');else wtbWrap.removeAttribute('hidden');}if(treatGroup)treatGroup.removeAttribute('hidden');syncCurrencyFormLabels();const wtb=isEdit?(existingGoal&&existingGoal.weeklyTreatBudget)||0:(parseFloat(document.getElementById('gWeeklyTreatBudget')?.value)||0);populateGoalRewardPresets(isPoints?0:wtb);}`,
  `if(wtbWrap){if(isEdit&&!isPoints)wtbWrap.setAttribute('hidden','');else if(!isPoints)wtbWrap.removeAttribute('hidden');}if(treatGroup)treatGroup.removeAttribute('hidden');syncCurrencyFormLabels();const wtb=isEdit?(existingGoal&&existingGoal.weeklyTreatBudget)||0:(parseFloat(document.getElementById('gWeeklyTreatBudget')?.value)||0);populateGoalRewardPresets(isPoints?0:wtb);syncGoalTreatBudgetVisibility();}`,
  'syncGoalFormForType'
);

replace(
  `function refreshManageHabitsLockUi(){const b=document.getElementById('manageHabitsLockBtn');const h=document.getElementById('manageHabitsHint');if(!b)return;const kidRm=typeof useKidsLanguage==='function'&&useKidsLanguage();b.textContent=_manageHabitsEditUnlocked?(kidRm?'Lock':'Lock'):(kidRm?'Edit':'Edit');if(h)h.textContent=_manageHabitsEditUnlocked?(kidRm?'Unlocked — tap a habit card to change it. Tap Lock when finished.':'Unlocked — tap any habit card to edit. Tap Lock when you are finished.'):(kidRm?'Locked — browse safely. Tap Edit when you want to change a habit.':'Locked — habit cards stay read-only until you tap Edit.');}`,
  `function refreshManageHabitsLockUi(){const b=document.getElementById('manageHabitsLockBtn');const h=document.getElementById('manageHabitsHint');if(!b)return;const kidRm=typeof useKidsLanguage==='function'&&useKidsLanguage();if(_manageHabitsEditUnlocked)setIconActionBtn(b,'lockTick',{lock:kidRm?'Lock':'Lock',lockTitle:kidRm?'Tap when you are finished editing':'Tap when you are finished editing'});else setIconActionBtn(b,'pencil',{pencil:kidRm?'Edit habits':'Edit habits',pencilTitle:kidRm?'Tap to edit habit cards':'Tap to edit habit cards'});if(h)h.textContent=_manageHabitsEditUnlocked?(kidRm?'Unlocked — tap a habit card to change it. Tap ✓ when finished.':'Unlocked — tap any habit card to edit. Tap ✓ when you are finished.'):(kidRm?'Press the toggle to Deactivate and Save your custom habits.':'Press the toggle to Deactivate and Save your custom habits.');}`,
  'refreshManageHabitsLockUi'
);

replace(
  `function syncGoalsTabToolbar(goals){const btn=document.getElementById('goalsTabEditBtn');if(!btn)return;const n=(goals&&goals.length)||0;const can=n>=2;btn.disabled=!can;const kid=typeof useKidsLanguage==='function'&&useKidsLanguage();btn.textContent=_goalsTabEditMode?(kid?'Done':'Done'):(kid?'Edit':'Edit');btn.title=can?'':(kid?'Add another goal first — then you can move habits.':'Add another active goal before moving habits between goals.');}`,
  `function syncGoalsTabToolbar(goals){const btn=document.getElementById('goalsTabEditBtn');if(!btn)return;const n=(goals&&goals.length)||0;const can=n>=2;btn.disabled=!can;const kid=typeof useKidsLanguage==='function'&&useKidsLanguage();if(_goalsTabEditMode)setIconActionBtn(btn,'text',{text:kid?'Done':'Done',title:''});else setIconActionBtn(btn,'pencil',{pencil:kid?'Edit goals':'Edit goals',pencilTitle:can?'':(kid?'Add another goal first — then you can move habits.':'Add another active goal before moving habits between goals.')});}`,
  'syncGoalsTabToolbar'
);

// archive confirm flow
replace(
  `function archiveHabit(id,cardEl){const h=habitById(id);if(!h)return;`,
  `function cancelArchiveHabit(){window._pendingArchiveHabitId=null;window._pendingArchiveHabitCard=null;closeM('mConfirmArchiveHabit');}
function openArchiveHabitConfirm(id,cardEl){const h=habitById(id);if(!h)return;window._pendingArchiveHabitId=id;window._pendingArchiveHabitCard=cardEl||null;openM('mConfirmArchiveHabit');}
function confirmArchiveHabitExecute(){const id=window._pendingArchiveHabitId;const card=window._pendingArchiveHabitCard;window._pendingArchiveHabitId=null;window._pendingArchiveHabitCard=null;closeM('mConfirmArchiveHabit');if(id)archiveHabit(id,card);}
function archiveHabit(id,cardEl){const h=habitById(id);if(!h)return;`,
  'archive confirm'
);

// renderHabitsConfig full replace
const oldRenderHabits = s.match(/function renderHabitsConfig\(\)\{bindManageActiveHabitCardsOnce\(\);refreshManageHabitsLockUi\(\);const list=document\.getElementById\('habitsList'\);if\(!list\)return;const habits=S\.habits\.filter\(h=>h\.active&&!h\.archived&&\(goalIsActive\(goalById\(h\.goalId\)\)\|\|h\.masteryLegendaryCoreLocked\)\)\.sort\(habitListSort\);if\(!habits\.length\)\{list\.innerHTML=`[^`]+`;return;\}list\.innerHTML=habits\.map\(h=>[\s\S]*?\}\)\.join\(''\);\}/);
if (!oldRenderHabits) throw new Error('renderHabitsConfig not found');
s = s.replace(oldRenderHabits[0], `function renderHabitsConfig(){bindGoalAndArchiveConfirmDialogsOnce();bindManageActiveHabitCardsOnce();refreshManageHabitsLockUi();const list=document.getElementById('habitsList');if(!list)return;const habits=S.habits.filter(h=>h.active&&!h.archived&&(goalIsActive(goalById(h.goalId))||h.masteryLegendaryCoreLocked)).sort(manageHabitSort);if(!habits.length){list.innerHTML=\`<div class="card empty glow-blue"><div class="empty-icon">🎯</div><h3>No active habits</h3><p>Add a habit to start tracking.</p></div>\`;return;}list.innerHTML=habits.map(h=>manageHabitCardHTML(h,{unlocked:_manageHabitsEditUnlocked,deleteTop:h.createdViaClone?"deleteHabit('"+h.id+"')":'',toggleOn:true,toggleTitle:'Active — click to send to Saved habits',toggleClick:"openArchiveHabitConfirm('"+h.id+"',this.closest('.config-card'))"})).join('');}`);

// renderArchive full replace
const oldRenderArchive = s.match(/function renderArchive\(\)\{const habits=S\.habits\.filter\(h=>h\.archived\|\|!h\.active\);if\(!habits\.length\)\{document\.getElementById\('archiveList'\)\.innerHTML=`[^`]+`;return;\}document\.getElementById\('archiveList'\)\.innerHTML=habits\.map\(h=>[\s\S]*?\}\)\.join\(''\);\}/);
if (!oldRenderArchive) throw new Error('renderArchive not found');
s = s.replace(oldRenderArchive[0], `function renderArchive(){bindArchiveBankRemove();const habits=S.habits.filter(h=>h.archived||!h.active).sort(manageHabitSort);const list=document.getElementById('archiveList');if(!list)return;if(!habits.length){list.innerHTML=\`<div class="card empty glow-blue"><div class="empty-icon">🗂</div><h3>No saved habits yet</h3><p>Finished or archived habits gather here ready to reuse.</p></div>\`;return;}list.innerHTML=habits.map(h=>{const origin=goalById(h.originGoalId);const sub='Originally from '+escDash(h.bankedFromGoalName||origin?.name||'a previous goal')+' · '+metricLabel(h);const delBtn='<button type="button" class="btn btn-danger btn-sm bank-delete-btn bank-delete-btn--round" data-habit-id="'+h.id+'" aria-label="Remove from saved habits" title="Remove from saved habits">×</button>';return manageHabitCardHTML(h,{subline:sub,toggleOn:false,toggleTitle:'Saved — click to reactivate',toggleClick:"openReactivate('"+h.id+"')",footExtra:delBtn});}).join('');}`);

// renderDashboard overview block
replace(
  'const pills=active.map(g=>{const st=goalStats(g);const t=gaugeTone(st.pct);return`<span class="meta-chip ${t.cls===\'glow-green\'?\'chip-green\':t.cls===\'glow-amber\'?\'chip-amber\':t.cls===\'glow-red\'?\'chip-red\':\'chip-blue\'}">${escDash(g.name)} · ${pctPillPart(st.pct)}</span>`;}).join(\'\')||\'<span class="meta-chip chip-blue">No active goals yet</span>\';const ov=document.getElementById(\'dashboardOverview\');if(ov)ov.innerHTML=`<div class="section-head"><div><div class="section-title">Overview</div><div class="muted" id="dashboardGoalsSubline"></div></div><button type="button" class="btn btn-primary btn-sm" id="guidedTourAddGoal" onclick="openGoalModal()">+ Add Goal</button></div><div class="goal-pills-row">${pills}</div><p class="tracking-started">Tracking since <strong style="color:var(--text)">${startLabel}</strong>.</p>${_trackBanner}`;',
  'const ov=document.getElementById(\'dashboardOverview\');if(ov)ov.innerHTML=`<div class="section-head"><div class="section-title">Overview</div></div>${overviewMotivationBlockHTML(active)}${_trackBanner}`;',
  'renderDashboard overview'
);

// renderTracker habits source
replace(
  `const allHabits=trackerHabitsOrdered();const habits=allHabits.filter(h=>habitShownOnTrackerWeek(h,S.offset));`,
  `const allHabits=trackerHabitsForWeekOffset(S.offset);const habits=allHabits.filter(h=>habitShownOnTrackerWeek(h,S.offset));`,
  'renderTracker habits'
);

// openGoalModal - inject limit at start of function body after signature
replace(
  `function openGoalModal(id=''){closeGoalEmojiPicker();closeEmojiPicker();if(id)_pendingBankedHabitIdsForNewGoal=null;`,
  `function openGoalModal(id='',opts){opts=opts||{};if(!id&&!opts.skipGoalLimitGate){const n=activeGoals().length;if(n>=MAX_ACTIVE_GOALS){alert(typeof useKidsLanguage==='function'&&useKidsLanguage()?'You already have 3 active goals — finish or archive one before adding another.':'You already have 3 active goals. Archive or complete one before adding another.');return;}if(n===2){window._pendingOpenGoalAfterLimit=true;openM('mConfirmAddThirdGoal');return;}}closeGoalEmojiPicker();closeEmojiPicker();if(id)_pendingBankedHabitIdsForNewGoal=null;`,
  'openGoalModal limit'
);

// saveGoal points payload - add treat budget when needed
replace(
  `if(goalType==='points'&&!existing){const pv=computeDefaultPotValues(60);_tgtRaw=100;pointsPayload={goalType:'points',target:100,weeklyTreatBudget:0,pointValueCore:pv.core,pointValueGrowth:pv.growth};}`,
  `if(goalType==='points'&&!existing){const pv=computeDefaultPotValues(60);_tgtRaw=100;const treatLbl=selectedGoalRewardLabel();let wtbVal=0;if(rewardTreatNeedsMoney(treatLbl)){wtbVal=parseFloat(document.getElementById('gWeeklyTreatBudget')?.value);if(!Number.isFinite(wtbVal)||wtbVal<=0)return alert(kidSG?'Pick a weekly treat budget (more than '+fmtMoney(0)+') for this treat.':'Enter a weekly treat budget greater than '+fmtMoney(0)+' for treats that cost money.');}pointsPayload={goalType:'points',target:100,weeklyTreatBudget:wtbVal,pointValueCore:pv.core,pointValueGrowth:pv.growth};}`,
  'saveGoal points budget'
);

// overlay handler for new modals
replace(
  `else if(el.id==='mConfirmRemoveBanked')cancelRemoveBanked();`,
  `else if(el.id==='mConfirmArchiveHabit')cancelArchiveHabit();else if(el.id==='mConfirmAddThirdGoal'){window._pendingOpenGoalAfterLimit=false;closeM('mConfirmAddThirdGoal');}else if(el.id==='mConfirmRemoveBanked')cancelRemoveBanked();`,
  'overlay handlers'
);

// bind archive/goal confirm buttons once - append after bindArchiveBankRemove definition
replace(
  `function bindArchiveBankRemove(){const root=document.getElementById('archiveList');`,
  `function bindGoalAndArchiveConfirmDialogsOnce(){if(window.__evolveConfirmDlgBound)return;window.__evolveConfirmDlgBound=true;const ay=document.getElementById('confirmArchiveHabitYes');const an=document.getElementById('confirmArchiveHabitNo');if(ay&&!ay.dataset.bound){ay.dataset.bound='1';ay.addEventListener('click',confirmArchiveHabitExecute);}if(an&&!an.dataset.bound){an.dataset.bound='1';an.addEventListener('click',cancelArchiveHabit);}const gy=document.getElementById('confirmAddThirdGoalYes');const gn=document.getElementById('confirmAddThirdGoalNo');if(gy&&!gy.dataset.bound){gy.dataset.bound='1';gy.addEventListener('click',function(){closeM('mConfirmAddThirdGoal');window._pendingOpenGoalAfterLimit=false;openGoalModal('',{skipGoalLimitGate:true});});}if(gn&&!gn.dataset.bound){gn.dataset.bound='1';gn.addEventListener('click',function(){window._pendingOpenGoalAfterLimit=false;closeM('mConfirmAddThirdGoal');});}}
function bindArchiveBankRemove(){bindGoalAndArchiveConfirmDialogsOnce();const root=document.getElementById('archiveList');`,
  'bind confirm dialogs'
);

// manifest orientation
const manifestPath = path.join(__dirname, '..', 'manifest.webmanifest');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.orientation = 'portrait';
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

fs.writeFileSync(file, s);
console.log('patch-ux-batch: OK');
