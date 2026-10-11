// Inspects the FINAL generated HTML file.
const fs=require('fs'); const vm=require('vm');
const html=fs.readFileSync(process.argv[2],'utf8'); let fail=0;
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
ok(html.startsWith('<!DOCTYPE html>'),'doctype');
ok(/<meta charset="UTF-8">/.test(html),'meta charset UTF-8');
ok(!/__VOCAB_JSON__|__EXPECTED_|__SITE_HEAD__|__SYNC_CONFIG__/.test(html),'all placeholders replaced');
// The anon key is public by design; the service_role key would be a full database compromise.
ok(!/service_role|sb_secret_/.test(html),'no service_role secret in output');
ok(!/(src|href)\s*=\s*["']https?:/i.test(html) && !/@import|url\(\s*["']?https?:/i.test(html),'no external resources');
// scripts
const scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
ok(scripts.length>=3 && scripts.filter(m=>/application\/json/.test(m[1])).length===1,'script blocks: '+scripts.length+' (one vocabulary JSON block)');
let data=null;
scripts.forEach((m,i)=>{
  if(/application\/json/.test(m[1])){ try{data=JSON.parse(m[2]); ok(true,'vocab JSON parses');}catch(e){ok(false,'vocab JSON: '+e.message);} }
  else { try{ new vm.Script(m[2],{filename:'script'+i}); ok(true,'JS syntax ok in script #'+i+' ('+m[2].length+' chars)'); }catch(e){ ok(false,'JS syntax script #'+i+': '+e.message);} }
});
const exp=Number((html.match(/var EXPECTED_COUNT = (\d+);/)||[])[1]); ok(Array.isArray(data)&&data.length===exp,'vocab count = '+(data&&data.length)+' (expected '+exp+')');
const lvc={}; data.forEach(c=>lvc[c.lv]=(lvc[c.lv]||0)+1); const lexp=JSON.parse((html.match(/var EXPECTED_LEVELS = (\{[^}]*\});/)||[])[1]); ok([1,2,3].every(l=>lvc[l]===lexp[l]),'per-level counts '+JSON.stringify(lvc)+' vs '+JSON.stringify(lexp));
const req=['zh','py','en','hu'];
const bad=data.filter(c=>req.some(k=>typeof c[k]!=='string'||!c[k].trim())||!Array.isArray(c.ex)||!c.ex.length||c.ex.some(e=>!e.zh||!e.py||!e.en||!e.hu));
ok(bad.length===0,'every entry has zh/py/en/hu + >=1 example with zh/py/en/hu (bad: '+bad.length+')');
ok(new Set(data.map(c=>c.zh)).size===data.length,'no duplicate headwords');
console.log('  examples total:',data.reduce((a,c)=>a+c.ex.length,0), ' entries with 2 examples:',data.filter(c=>c.ex.length===2).length);
// ids
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
const dupIds=ids.filter((x,i)=>ids.indexOf(x)!==i); ok(dupIds.length===0,'unique element ids '+dupIds.join(','));
const main=scripts.map(m=>m[2]).join('\n');
const refs=new Set([...main.matchAll(/(?:\$|on|getElementById)\(\s*'([^']+)'/g)].map(m=>m[1]));
const reqList=(main.match(/REQUIRED_IDS = \[([\s\S]*?)\];/)||[])[1]||''; [...reqList.matchAll(/'([^']+)'/g)].forEach(m=>refs.add(m[1]));
const coreList=(main.match(/CORE_BUTTONS = \[([\s\S]*?)\];/)||[])[1]||''; [...coreList.matchAll(/'([^']+)'/g)].forEach(m=>refs.add(m[1]));
const missing=[...refs].filter(r=>!ids.includes(r)); ok(missing.length===0,'all '+refs.size+' ids referenced by JS exist '+missing.join(','));
const notReq=[...refs].filter(r=>!reqList.includes("'"+r+"'")); ok(notReq.length===0,'every referenced id is in REQUIRED_IDS '+notReq.join(','));
// tag balance (outside scripts/styles)
const body=html.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<!--[\s\S]*?-->/g,'');
const voids=new Set(['meta','link','br','hr','img','input','source','area','base','col','embed','track','wbr']);
const stack=[]; let tagErr=null;
for(const m of body.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g)){
  const t=m[1].toLowerCase(); if(m[0].startsWith('<!')) continue;
  if(m[0][1]==='/'){ const top=stack.pop(); if(top!==t){tagErr='expected </'+top+'> got </'+t+'>';break;} }
  else if(!voids.has(t) && !m[0].endsWith('/>')) stack.push(t);
}
ok(!tagErr && stack.length===0,'HTML tags balanced '+(tagErr||stack.join(',')));
console.log(fail?'\n'+fail+' FAILURE(S)':'\nALL STATIC CHECKS PASSED');
process.exit(fail?1:0);
