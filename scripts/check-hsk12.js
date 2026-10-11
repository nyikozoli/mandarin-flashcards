const raw=[1,2,3,4,5,6].flatMap(i=>require(require('path').join(__dirname,'../data/hsk12/v'+i+'.js')));
console.log('total',raw.length);
const seen=new Map(); const errs=[]; const warns=[];
const tone=/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g;
raw.forEach((e,i)=>{
  if(!(e.length===7||e.length===10)) errs.push(i+' bad length '+e.length+' '+e[0]);
  if(e.some(x=>typeof x!=='string'||!x.trim())) errs.push(i+' empty field '+e[0]);
  if(seen.has(e[0])) errs.push('dup '+e[0]); seen.set(e[0],i);
  if(!/^[a-zA-ZāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüÜ' \-]+$/.test(e[1])) errs.push('pinyin chars '+e[0]+' '+e[1]);
  // syllable count vs hanzi count (roughly)
  const syl=e[1].toLowerCase().replace(/[ \-']/g,' ').match(/(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?[aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+(ng|n(?![aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ])|r(?![aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]))?/g)||[];
  const hz=[...e[0]].length; const er=e[0].endsWith('儿')&&hz>1?1:0;
  if(syl.length!==hz-er) warns.push('syllables '+e[0]+' '+e[1]+' -> '+syl.join('|'));
  syl.forEach(s=>{const t=(s.match(tone)||[]).length; if(t>1) errs.push('2 tones in syllable '+e[0]+' '+s);});
  for(let k=4;k<e.length;k+=3){
    if(!e[k].includes(e[0])) warns.push('example lacks headword '+e[0]+': '+e[k]);
    if(!/[。！？”]$/.test(e[k])) warns.push('zh punct '+e[k]);
    if(/[a-zA-Z]/.test(e[k])) errs.push('latin in zh '+e[k]);
  }
});
console.log('ERRORS',errs.length); errs.forEach(x=>console.log(' ',x));
console.log('WARNINGS',warns.length); warns.forEach(x=>console.log(' ',x));
