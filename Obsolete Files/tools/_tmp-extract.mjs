import fs from 'fs';
const h = fs.readFileSync('index.html', 'utf8');
const i = h.indexOf('function renderHistory');
const j = h.indexOf('function bindHistoryTableScroll', i);
console.log(h.slice(i, j));
const k = h.indexOf('goalCards.innerHTML=active.map');
console.log('\n--- goal card map ---\n');
console.log(h.slice(k, k + 2500));
