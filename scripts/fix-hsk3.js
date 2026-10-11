// node fix.js fixes.json : [[headword, oldSubstring, newSubstring], ...] applied inside that headword's entry in h3-*.json
const fs=require('fs'); const fixes=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const files=require('fs').readdirSync(require('path').join(__dirname,'../data/hsk3')).filter(f=>/\.json$/.test(f)).map(f=>({p:require('path').join(__dirname,'../data/hsk3',f)})); files.forEach(f=>f.d=JSON.parse(fs.readFileSync(f.p,'utf8')));
let applied=0;
fixes.forEach(([hw,o,n])=>{ let hit=0;
  files.forEach(f=>f.d.forEach(e=>{ if(e[0]!==hw) return; e.forEach((v,i)=>{ if(i>0 && v.includes(o)){ e[i]=v.split(o).join(n); hit++; } }); }));
  if(!hit) { console.log('NOT FOUND:',hw,'|',o); process.exitCode=1; } else applied++; });
files.forEach(f=>fs.writeFileSync(f.p, '[\n'+f.d.map(e=>JSON.stringify(e)).join(',\n')+'\n]\n','utf8'));
console.log('applied',applied,'of',fixes.length);
