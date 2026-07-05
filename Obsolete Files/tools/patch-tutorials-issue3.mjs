import fs from 'fs';

const path = 'index.html';
let h = fs.readFileSync(path, 'utf8');

function mustReplace(label, from, to) {
  if (!h.includes(from)) throw new Error('missing: ' + label);
  h = h.replace(from, to);
  console.log('ok', label);
}

function replaceAll(label, from, to) {
  if (!h.includes(from)) throw new Error('missing: ' + label);
  const n = h.split(from).length - 1;
  h = h.split(from).join(to);
  console.log('ok', label, '(' + n + 'x)');
}

// --- Profile limits: test account may have 3 adult profiles ---
mustReplace(
  'profile-constants',
  "const PREMIUM_MAX_CHILD_PROFILES=5;",
  "const PREMIUM_MAX_CHILD_PROFILES=5;const TEST_MAX_ADULT_PROFILES=3;function testAccountProfileLimits(){const u=typeof authCurrentUser==='function'?authCurrentUser():null;if(!u||!u.email)return null;if(String(u.email).toLowerCase().trim()!==REMINDER_DEBUG_ACCOUNT_EMAIL)return null;return{maxAdults:TEST_MAX_ADULT_PROFILES};}function premiumMaxAdultProfiles(){const t=testAccountProfileLimits();return t?t.maxAdults:1;}"
);

mustReplace(
  'canAddProfileIntent-adults',
  "if(isPremiumAccount()){\n    if(!wantChild){if(adults>=1)return false;}",
  "if(isPremiumAccount()){\n    if(!wantChild){if(adults>=premiumMaxAdultProfiles())return false;}"
);

mustReplace(
  'addProfileBlockedMessage-adult',
  "if(!wantChild)return kid?'Premium allows one grown-up profile. Add a kid profile instead.':'Premium includes one adult profile. Add a child profile instead.';",
  "if(!wantChild){const mx=premiumMaxAdultProfiles();return kid?('Premium allows '+mx+' grown-up profile'+(mx===1?'':'s')+'. Add a kid profile instead.'):('Premium includes up to '+mx+' adult profile'+(mx===1?'':'s')+'. Add a child profile instead.');}"
);

// --- New tutorial flags ---
replaceAll(
  'tab-tour-flags-default',
  'firstBankStepperSeen:false,pointsGoalIntroSeen:false',
  'firstBankStepperSeen:false,tabTourSeen:false,tabTourOfferDeclined:false,pointsGoalIntroSeen:false'
);

mustReplace(
  'migrate-tab-tour-flags',
  'if(P.user.firstBankStepperSeen===undefined)P.user.firstBankStepperSeen=!!(Array.isArray(P.habits)&&P.habits.some(h=>h.archived));',
  'if(P.user.firstBankStepperSeen===undefined)P.user.firstBankStepperSeen=!!(Array.isArray(P.habits)&&P.habits.some(h=>h.archived));if(P.user.tabTourSeen===undefined)P.user.tabTourSeen=false;if(P.user.tabTourOfferDeclined===undefined)P.user.tabTourOfferDeclined=false;'
);

// --- Intro no longer marks tab tour done ---
mustReplace(
  'completeIntroStepper-guideSeen',
  'S.user.introSeen=true;S.user.guideSeen=true;if(S.user){',
  'S.user.introSeen=true;if(S.user){'
);

mustReplace(
  'finishGuidedTour-tabTourSeen',
  'initDashInsightCarousel();S.user.guideSeen=true;save();',
  'initDashInsightCarousel();S.user.tabTourSeen=true;S.user.guideSeen=true;save();'
);

// --- Deferred tab tour offer + saved-habits bank gating ---
mustReplace(
  'maybeStartFirstBankStepper-guard',
  'function maybeStartFirstBankStepper(){if(!S||!S.user||!S.user.setupDone)return;if(S.user.firstBankStepperSeen)return;if(milestoneAnyOverlayActive())return;',
  'function hasSavedHabitsInBank(){return Array.isArray(S.habits)&&S.habits.some(h=>habitIsBankSlot(h));}function maybeStartFirstBankStepper(){if(!S||!S.user||!S.user.setupDone)return;if(S.user.firstBankStepperSeen)return;if(!hasSavedHabitsInBank())return;if(milestoneAnyOverlayActive())return;'
);

mustReplace(
  'maybeOfferDeferredTabTour-insert',
  'function maybeStartFirstHistoryStepper(){',
  `function maybeOfferDeferredTabTour(){if(!S||!S.user||!S.user.setupDone)return;if(S.user.tabTourSeen||S.user.tabTourOfferDeclined)return;if(!S.user.firstLogStepperSeen)return;if(milestoneAnyOverlayActive())return;if(!document.getElementById('tab-dashboard')?.classList.contains('active'))return;const kid=useKidsLanguage();startMilestoneCoach({title:kid?'Quick tour?':'Map of the app',html:kid?'<p>You logged your first check-in — nice! Want a short walkthrough of <strong>Home</strong>, <strong>Log</strong>, and <strong>Manage</strong>? Replay anytime from <strong>Settings → Help</strong>.</p>':'<p>You have started logging — nice. When you are ready, we can walk through <strong>Home</strong>, <strong>Log</strong>, and <strong>Manage</strong> in one short tour (about a minute). Replay anytime from <strong>Settings → Help</strong>.</p>',primaryLabel:kid?'Show me':'Start tour',dismissLabel:'Later',onPrimary:function(){startGuidedTour();},onFinish:function(reason){if(reason!=='primary'){S.user.tabTourOfferDeclined=true;save();}}});}
function maybeStartFirstHistoryStepper(){`
);

mustReplace(
  'switchTab-seeding',
  "if(name==='dashboard')setTimeout(()=>maybeStartConsistencyRuleDeferred(),520);if(name==='manage'&&S&&S.user&&S.user.setupDone&&!S.user.firstBankStepperSeen)setTimeout(()=>maybeStartFirstBankStepper(),420);",
  "if(name==='dashboard'){setTimeout(()=>maybeStartConsistencyRuleDeferred(),520);setTimeout(()=>maybeOfferDeferredTabTour(),680);}"
);

mustReplace(
  'toggleSavedHabitsSection-bank',
  'function toggleSavedHabitsSection(){_savedHabitsSectionExpanded=!_savedHabitsSectionExpanded;syncSavedHabitsSectionUi(true);}',
  'function toggleSavedHabitsSection(){_savedHabitsSectionExpanded=!_savedHabitsSectionExpanded;syncSavedHabitsSectionUi(true);if(_savedHabitsSectionExpanded&&S&&S.user&&S.user.setupDone&&!S.user.firstBankStepperSeen&&hasSavedHabitsInBank())setTimeout(()=>maybeStartFirstBankStepper(),360);}'
);

// --- Help replays ---
mustReplace(
  'help-replay-home-label',
  'id="btnReplayDashboardBlocks" onclick="replayDashboardBlockTourFromSettings()">📊 Dashboard blocks</button>',
  'id="btnReplayDashboardBlocks" onclick="replayDashboardBlockTourFromSettings()">📊 Home blocks</button>'
);

mustReplace(
  'help-replay-extra-buttons',
  '<button type="button" class="btn btn-ghost btn-sm" id="btnReplayConsistencyDisc" onclick="startConsistencyDiscTourFromSettings()">⭕ Consistency &amp; recovery (disc)</button>',
  `<button type="button" class="btn btn-ghost btn-sm" id="btnReplayFirstHistory" onclick="replayFirstHistoryFromSettings()">📜 Home: week history</button>
        <button type="button" class="btn btn-ghost btn-sm" id="btnReplayFirstBank" onclick="replayFirstBankFromSettings()">📦 Manage: Saved habits</button>
        <button type="button" class="btn btn-ghost btn-sm" id="btnReplayConsistencyDisc" onclick="startConsistencyDiscTourFromSettings()">⭕ Consistency &amp; recovery (disc)</button>`
);

mustReplace(
  'replay-history-bank-fns',
  'function replayDashboardBlockTourFromSettings(){',
  `function replayFirstHistoryFromSettings(){_settingsReopenTab='help';closeM('mSettings');setTimeout(()=>{S.user.firstHistoryStepperSeen=false;save();const t=document.querySelector('[data-guided-tour="tab-home"]');if(t)switchTab('dashboard',t);const det=document.getElementById('homeWeekHistoryDetails');if(det&&!det.open)det.open=true;setTimeout(()=>maybeStartFirstHistoryStepper(),320);},160);}
function replayFirstBankFromSettings(){_settingsReopenTab='help';closeM('mSettings');setTimeout(()=>{S.user.firstBankStepperSeen=false;save();const t=document.querySelector('[data-guided-tour="tab-manage"]');if(t)switchTab('manage',t);if(!_savedHabitsSectionExpanded){_savedHabitsSectionExpanded=true;syncSavedHabitsSectionUi(true);}setTimeout(()=>maybeStartFirstBankStepper(),320);},160);}
function replayDashboardBlockTourFromSettings(){`
);

// --- Retether stepper copy ---
mustReplace(
  'retether-goals-tab',
  "{title:'Goals tab moves',html:'<p>Use <strong>Edit</strong> on this tab to move pills.",
  "{title:'Manage → Goals moves',html:'<p>Use <strong>Edit goals</strong> under <strong>Manage</strong> to move pills."
);

// --- First log stepper: collapsed cards ---
mustReplace(
  'first-log-kid',
  "{title:'Each habit is a row',html:'<p>Each card here is one habit. Tap a day button to mark it done. Tap again to undo.</p>'}",
  "{title:'Each habit is a card',html:'<p>Cards start folded — tap the title bar to open one. Then tap a day button to mark it done. Tap again to undo.</p>'}"
);

mustReplace(
  'first-log-adult',
  "{title:'How the Log works',html:'<p>Each card here is one habit for the current week (Monday–Sunday). Tap a day button to log a check; tap again to undo.",
  "{title:'How the Log works',html:'<p>Each card is one habit for the current week (Monday–Sunday). Cards start collapsed — tap the title stripe to expand. Then tap a day button to log a check; tap again to undo."
);

// --- History stepper Home wording ---
mustReplace(
  'history-kid-dashboard',
  "Your <strong>circle %</strong> on the dashboard is built from these qualifying weeks.",
  "Your <strong>circle %</strong> on <strong>Home</strong> is built from these qualifying weeks."
);

mustReplace(
  'history-adult-dashboard',
  "Your <strong>consistency %</strong> on the dashboard disc is calculated from these closed, counted weeks",
  "Your <strong>consistency %</strong> on the <strong>Home</strong> disc is calculated from these closed, counted weeks"
);

// --- Dashboard block tour insights swipe ---
mustReplace(
  'dash-block-kid-insights',
  "<p>The fun-fact box rotates discoveries. Hold to pause, tap a new one to unscramble.</p>",
  "<p>The fun-fact box rotates discoveries about every 25 seconds. Hold to pause, swipe left or right to browse, tap a new one to unscramble.</p>"
);

mustReplace(
  'dash-block-adult-insights',
  "<p>Press and hold to pause, or open the <strong>library</strong> for everything you have discovered.</p>",
  "<p>Press and hold to pause, swipe left or right to browse, or open the <strong>library</strong> for everything you have discovered. New lines auto-rotate about every 25 seconds.</p>"
);

// --- Insight coach Home wording ---
mustReplace(
  'insight-coach-kid-dashboard',
  '<p>Tap the dimmed box on your dashboard to <strong>unscramble</strong> your new fun fact.</p><p>If you earned one during onboarding, it is already there — we skip the pop-up until you are on the home dashboard.</p>',
  '<p>Tap the dimmed box on <strong>Home</strong> to <strong>unscramble</strong> your new fun fact.</p><p>If you earned one during onboarding, it is already there — we skip the pop-up until you land on Home.</p>'
);

mustReplace(
  'insight-coach-adult-dashboard',
  '<p>Tap the dimmed insight on the dashboard to <strong>unscramble</strong> it.</p><p>First insight from onboarding waits as scrambled text on the dashboard (no pop-up during setup) — tap to reveal whenever you are ready.</p>',
  '<p>Tap the dimmed insight on <strong>Home</strong> to <strong>unscramble</strong> it.</p><p>First insight from onboarding waits as scrambled text on Home (no pop-up during setup) — tap to reveal whenever you are ready.</p>'
);

// --- Adult Tips modal (static HTML) ---
mustReplace(
  'guide-goals-snapshot',
  '<strong>This week</strong> shows in the weekly treat line, Log, and dashboard week snapshot.',
  '<strong>This week</strong> shows in the weekly treat line, Log, and the <strong>Your week</strong> snapshot on Home.'
);

mustReplace(
  'guide-habits-goals-tab',
  'See <strong>Tiers</strong> below and the <strong>Goals</strong> tab if you need to move a habit or change Core vs Growth',
  'See <strong>Tiers</strong> below and <strong>Manage → Goals</strong> (Edit goals) if you need to move a habit or change Core vs Growth'
);

mustReplace(
  'guide-saved-habits-expand',
  '<div class="guide-block"><strong>Saved habits</strong><div class="small-note" style="margin-top:8px">When a goal is completed, habits rest here until you reopen them toward the next goal.</div></div>',
  '<div class="guide-block"><strong>Saved habits</strong><div class="small-note" style="margin-top:8px">Under <strong>Manage → Saved habits</strong>, banked habits wait until you reactivate them toward a goal — for example when a goal is completed or you archive a habit you might reuse later.</div></div>'
);

mustReplace(
  'guide-insights-home',
  'and a rotating excerpt shows under <strong>Your Goals</strong> on the dashboard.',
  'and a rotating excerpt shows in the <strong>Did you know?</strong> card at the top of <strong>Home</strong> (inside your overview).'
);

// --- Kid Tips template ---
mustReplace(
  'kid-guide-goals-home',
  '<strong>This week</strong> shows in the Log and on the dashboard snapshot.',
  '<strong>This week</strong> shows in the Log and on the <strong>Your week</strong> card on Home.'
);

mustReplace(
  'kid-guide-habit-bank',
  '<div class="guide-block"><strong>Habit bank</strong>',
  '<div class="guide-block"><strong>Saved habits</strong>'
);

mustReplace(
  'kid-guide-habit-bank-body',
  'When a goal is done, its habits rest here until you attach them to a new goal.',
  'Under <strong>Manage → Saved habits</strong>, habits rest here until you attach them to a new goal.'
);

mustReplace(
  'kid-guide-cool-facts',
  'A short line can show under <strong>Your Goals</strong>.',
  'A short line can show in the <strong>Cool facts!</strong> box on <strong>Home</strong>. Hold to pause; swipe to browse.'
);

// --- Guided tour steps (adult) ---
mustReplace(
  'tour-adult-subline',
  "It rotates every few seconds.',prep:()=>{const d=document.querySelector('[data-guided-tour=\"tab-home\"]');if(d)switchTab('dashboard',d);},refreshDashboard:true},{sel:'[data-guided-tour=\"dashboard-insights\"]',title:'Insights',body:'Short science-backed notes about habits and the brain. You unlock them by doing things in the app — for example adding a habit, a weekly participation nudge, streak milestones, or tier shifts on the consistency score disk. Press and hold the insight box to pause the carousel.'",
  "It rotates about every ten seconds, with a typewriter effect when the line changes.',prep:()=>{const d=document.querySelector('[data-guided-tour=\"tab-home\"]');if(d)switchTab('dashboard',d);},refreshDashboard:true},{sel:'[data-guided-tour=\"dashboard-insights\"]',title:'Insights',body:'Short science-backed notes about habits and the brain. You unlock them by doing things in the app — for example adding a habit, a weekly participation nudge, streak milestones, or tier shifts on the consistency score disk. Press and hold to pause the carousel, or swipe left or right to browse. New insights auto-rotate about every 25 seconds.'"
);

mustReplace(
  'tour-adult-manage-saved-prep',
  "{sel:'[data-guided-tour=\"manage-saved\"]',title:'Manage · Saved habits',body:'Banked habits live here until you bring them back. Reactivate or adjust before attaching to a goal — preset habits can always be rebuilt fresh.',prep:()=>{const b=document.querySelector('[data-guided-tour=\"tab-manage\"]');if(b)switchTab('manage',b);}}",
  "{sel:'[data-guided-tour=\"manage-saved\"]',title:'Manage · Saved habits',body:'Banked habits live here until you bring them back. Reactivate or adjust before attaching to a goal — preset habits can always be rebuilt fresh.',prep:()=>{const b=document.querySelector('[data-guided-tour=\"tab-manage\"]');if(b)switchTab('manage',b);if(!_savedHabitsSectionExpanded){_savedHabitsSectionExpanded=true;syncSavedHabitsSectionUi(true);}}}"
);

// --- Guided tour steps (kid) ---
mustReplace(
  'tour-kid-subline',
  "It changes every few seconds — gentle reminders, not scores.',prep:()=>{const d=document.querySelector('[data-guided-tour=\"tab-home\"]');if(d)switchTab('dashboard',d);},refreshDashboard:true},{sel:'[data-guided-tour=\"dashboard-insights\"]',title:'Cool facts',body:'Short fun facts about habits and your brain show up when you earn them — like when you add a habit, finish the first-time Tier guide, hit milestones, or your circle colour changes on the consistency score disk. Press and hold the box to pause.'",
  "It changes about every ten seconds — gentle reminders, not scores.',prep:()=>{const d=document.querySelector('[data-guided-tour=\"tab-home\"]');if(d)switchTab('dashboard',d);},refreshDashboard:true},{sel:'[data-guided-tour=\"dashboard-insights\"]',title:'Cool facts',body:'Short fun facts about habits and your brain show up when you earn them — like when you add a habit, finish the first-time Tier guide, hit milestones, or your circle colour changes on the consistency score disk. Press and hold to pause, or swipe to browse. They rotate about every 25 seconds.'"
);

mustReplace(
  'tour-kid-manage-saved-prep',
  "{sel:'[data-guided-tour=\"manage-saved\"]',title:'Saved habits',body:'Habits you bank wait here until you reuse them — quick restart, edits first, preset habits can always be rebuilt.',prep:()=>{const b=document.querySelector('[data-guided-tour=\"tab-manage\"]');if(b)switchTab('manage',b);}}",
  "{sel:'[data-guided-tour=\"manage-saved\"]',title:'Saved habits',body:'Habits you bank wait here until you reuse them — quick restart, edits first, preset habits can always be rebuilt.',prep:()=>{const b=document.querySelector('[data-guided-tour=\"tab-manage\"]');if(b)switchTab('manage',b);if(!_savedHabitsSectionExpanded){_savedHabitsSectionExpanded=true;syncSavedHabitsSectionUi(true);}}}"
);

// --- Whats new v2.3 archive bullets (Manage not Goals tab) ---
mustReplace(
  'wn-v23-archive',
  'Use the green Archive toggle on the dashboard or Goals tab to open that flow when you are ready.',
  'Use the green Archive toggle on a goal card on Home or under Manage → Goals to open that flow when you are ready.'
);

mustReplace(
  'wn-v23-completed',
  '`📂 Completed Goals on the Goals tab',
  '`📂 Completed goals under Manage'
);

mustReplace(
  'wn-v23-completed-body',
  'Finished goals live in a Completed Goals section (rename from “Old Goals”). Archived goals use a grey “off” toggle labelled Archived — tap to restore to your active list and dashboard.',
  'Finished goals live in Past goals under Manage. Archived goals use a grey “off” toggle labelled Archived — tap to restore to your active list and Home.'
);

mustReplace(
  'wn-v23-tab-removed',
  'The extra Completed goals tab is removed so everything sits under Goals.',
  'The extra Completed goals tab is removed — everything sits under Manage.'
);

mustReplace(
  'wn-v22-goals-tab',
  '`🎯 Goals tab',
  '`🎯 Manage → Goals'
);

mustReplace(
  'wn-v22-check',
  'you can double-check on the Goals tab',
  'you can double-check under Manage → Goals'
);

fs.writeFileSync(path, h);
console.log('patch complete');
