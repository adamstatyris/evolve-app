import fs from 'fs';
const file = new URL('../index.html', import.meta.url);
let s = fs.readFileSync(file, 'utf8');
const old = "{sel:'#guidedTourAddGoal',title:'Goals',body:'Start by adding a goal. Then attach habits that work toward it.',prep:()=>{const d=document.querySelector('[data-guided-tour=\"tab-home\"]');if(d)switchTab('dashboard',d);}";
const neu = "{sel:'[data-guided-tour=\"manage-goals\"]',title:'Goals',body:'Start by adding a goal in Manage. Then attach habits that work toward it.',prep:()=>{const d=document.querySelector('[data-guided-tour=\"tab-manage\"]');if(d)switchTab('manage',d);}";
if (!s.includes(old)) {
  const i = s.indexOf('guidedTourAddGoal');
  console.error('not found', s.slice(i, i + 400));
  process.exit(1);
}
s = s.split(old).join(neu);
fs.writeFileSync(file, s);
console.log('guided tour fixed');
