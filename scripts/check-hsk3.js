// Usage: node check3.js <file.json>   Validates an HSK 3 batch: [zh, py, en, hu, exZh, exPy, exEn, exHu, (exZh2, exPy2, exEn2, exHu2)]
const fs=require('fs'); const f=process.argv[2]; let data;
try{ data=JSON.parse(fs.readFileSync(f,'utf8')); }catch(e){ console.log('INVALID JSON: '+e.message); process.exit(1); }
const V='aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ'; const SYL=new RegExp('(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?['+V+']+(ng|n(?!['+V+'])|r(?!['+V+']))?','g');
const TONE=/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g; const errs=[]; const seen=new Set();
const sylls=p=>p.toLowerCase().replace(/[^a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü' -]/g,' ').replace(/['-]/g,' ').match(SYL)||[];
const hanCount=z=>{const h=(z.match(/[\u4e00-\u9fff]/g)||[]).length; const er=(z.match(/儿/g)||[]).length-(z.match(/儿子|女儿|儿童/g)||[]).length; return h-er;};
if(!Array.isArray(data)) { console.log('not an array'); process.exit(1); }
data.forEach((e,i)=>{ const id='#'+(i+1)+' '+(e&&e[0]);
  if(!Array.isArray(e)||!(e.length===8||e.length===12)) return errs.push(id+': must have 8 or 12 fields, has '+(e&&e.length));
  if(e.some(x=>typeof x!=='string'||!x.trim())) errs.push(id+': empty field');
  if(seen.has(e[0])) errs.push(id+': duplicate'); seen.add(e[0]);
  if(!/^[a-zA-ZāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüÜ' \-]+$/.test(e[1])) errs.push(id+': bad chars in pinyin '+e[1]);
  const hs=sylls(e[1]); if(hs.length!==hanCount(e[0])) errs.push(id+': headword syllables '+hs.length+' vs chars '+hanCount(e[0])+' ('+e[1]+')');
  hs.forEach(s=>{ if((s.match(TONE)||[]).length>1) errs.push(id+': two tone marks in '+s); });
  for(let k=4;k<e.length;k+=4){ const zh=e[k], py=e[k+1];
    if(!zh.includes(e[0])) errs.push(id+': example does not contain headword: '+zh);
    if(!/[。！？”]$/.test(zh)) errs.push(id+': example must end with 。！？: '+zh);
    if(/[A-Za-z0-9]/.test(zh)) errs.push(id+': Latin letters or digits in Chinese example: '+zh);
    const s=sylls(py); if(s.length!==hanCount(zh)) errs.push(id+': sentence pinyin has '+s.length+' syllables but sentence has '+hanCount(zh)+' characters: '+zh+' | '+py);
    s.forEach(x=>{ if((x.match(TONE)||[]).length>1) errs.push(id+': two tone marks in '+x+' ('+py+')'); });
    if(!/^[A-ZĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙ]/.test(py.replace(/^“/,''))) errs.push(id+': sentence pinyin should start with a capital letter: '+py);
  }
});
console.log(data.length+' entries, '+errs.length+' problems'); errs.forEach(x=>console.log('  '+x)); process.exit(errs.length?1:0);
