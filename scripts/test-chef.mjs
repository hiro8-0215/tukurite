import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {randomBytes} from 'node:crypto';
const url='https://lcgpgyncmdsidgbtpjoy.supabase.co',key='sb_publishable_2urB_xb-tG0RFQ_DAVP4oA_qkVBdR8j';let checks=0;function check(value,msg){assert.ok(value,msg);checks++;}
const loginId='chefqa'+Date.now().toString(36),password=randomBytes(18).toString('base64url');
const registration=await fetch(url+'/functions/v1/register-with-id',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({loginId,password})});check(registration.status===201,'register QA');
const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await c.auth.signInWithPassword({email:loginId+'@users.tsukurite.app',password});assert.ifError(error);
const headers={apikey:key,Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'};
async function invoke(body){const r=await fetch(url+'/functions/v1/import-recipe',{method:'POST',headers,body:JSON.stringify(body)});return {status:r.status,...await r.json()};}
const empty={title:'',description:'',ingredients:'',steps:'',servings:2,minutes:20,category:'主菜'};
check((await invoke({action:'compose',recipe:empty})).status===400,'empty recipe rejected before AI');
check((await invoke({action:'compose',recipe:{...empty,description:'鶏肉',servings:0}})).status===400,'invalid servings rejected');
check((await invoke({action:'refine',recipe:{...empty,title:'鶏肉'}})).status===400,'empty refinement rejected');
const generated=await invoke({action:'compose',recipe:{...empty,title:'鶏むねのレモン蒸し',description:'鶏むね肉でさっぱり。レモンを効かせる。辛さ控えめで、唐辛子は使わない。電子レンジで簡単に。'}});
check(generated.status===200,'compose succeeds '+JSON.stringify(generated));check(generated.draft.title==='鶏むねのレモン蒸し','given title retained');check(generated.draft.servings===2,'servings retained');check(/鶏.*むね|鶏胸/.test(generated.draft.ingredients),'chicken preference');check(/レモン/.test(generated.draft.ingredients),'lemon preference');check(!/唐辛子|ラー油|豆板醤/.test(generated.draft.ingredients),'no spicy ingredient');check(generated.draft.steps.split('\n').length>=2,'structured steps');check(generated.warnings.length>0,'proposals disclosed');
console.log('COMPOSE:',JSON.stringify(generated));
const source={...empty,title:'レモン冷ややっこ',description:'レモンでさっぱり。加熱しない。',ingredients:'豆腐 150g\nレモン汁 小さじ1\nしょうゆ 小さじ1',steps:'1. とうふ皿に\n2. レモン汁としょうゆ混ぜる、かける'};
const refined=await invoke({action:'refine',recipe:source});check(refined.status===200,'refine succeeds '+JSON.stringify(refined));check(/150\s*g/.test(refined.draft.ingredients),'quantity preserved');check(/レモン汁\s+小さじ1/.test(refined.draft.ingredients),'teaspoon formatted');check(/しょうゆ\s+小さじ1/.test(refined.draft.ingredients),'sauce quantity preserved');check(!/^\d+[.．]/m.test(refined.draft.steps),'step numbering normalized');check(refined.draft.description===source.description,'original preference memo retained');
console.log('REFINE:',JSON.stringify(refined));
if(process.env.CHEF_ONLY!=='1'){const imported=await invoke({sharedText:'料理名：冷ややっこ。豆腐150gを皿に盛る。しょうゆ小さじ1をかける。1人分。'});check(imported.status===200,'existing external extraction retained');check(imported.ingredients.some(x=>x.name.includes('豆腐')),'external tofu extraction');check(imported.draft===undefined,'external extraction does not become creative mode');}
console.log(checks+' live recipe composition/refinement checks passed. Nothing was published.');
