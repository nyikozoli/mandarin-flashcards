const raw=[1,2,3,4,5,6].flatMap(i=>require(require('path').join(__dirname,'../data/hsk12/v'+i+'.js'))); const sp=require(require('path').join(__dirname,'../data/hsk12/sentence-pinyin.js'));
const V='aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
const syl=new RegExp('(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?['+V+']+(ng|n(?!['+V+'])|r(?!['+V+']))?','g');
const tone=/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g;
const used=new Set(); let errs=[], warns=[];
const fold=s=>s.toLowerCase().normalize('NFC').replace(/[^a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g,'');
raw.forEach(e=>{ for(let k=4;k<e.length;k+=3){ const zh=e[k]; used.add(zh); const py=sp[zh];
  if(!py){errs.push('missing pinyin: '+zh);continue;}
  const han=(zh.match(/[\u4e00-\u9fff]/g)||[]); const er=(zh.match(/儿/g)||[]).length-(zh.match(/儿子|女儿/g)||[]).length;
  const s=py.toLowerCase().replace(/[^a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü' -]/g,' ').replace(/['-]/g,' ').match(syl)||[];
  if(s.length!==han.length-er) errs.push(`syllables ${han.length-er} hanzi vs ${s.length} pinyin: ${zh} | ${py}`);
  s.forEach(x=>{if((x.match(tone)||[]).length>1) errs.push('2 tones '+x+' in '+py);});
  // headword pinyin should appear in sentence pinyin (allow 一/不 sandhi + neutral 个)
  const norm=x=>fold(x).replace(/[yī|yí|yì]/g,'').replace(/bú|bù/g,'bu');
  if(!norm(py).includes(norm(e[1]))) warns.push(`${e[0]} ${e[1]}  ⟂  ${py}`);
}});
Object.keys(sp).forEach(k=>{if(!used.has(k)) errs.push('unused pinyin key: '+k);});
console.log('sentences',used.size,'errors',errs.length); errs.forEach(x=>console.log(' E',x));
console.log('headword-in-sentence mismatches (review)',warns.length); warns.forEach(x=>console.log(' W',x));
