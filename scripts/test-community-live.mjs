import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {weekStart,japanDate,shoppingList} from '../src/lib/planning.ts';
const url='https://lcgpgyncmdsidgbtpjoy.supabase.co',key='sb_publishable_2urB_xb-tG0RFQ_DAVP4oA_qkVBdR8j';
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
async function login(credentials){const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await client.auth.signInWithPassword({email:credentials.loginId+'@users.tsukurite.app',password:credentials.password});assert.ifError(error);const headers={apikey:key,Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'};return {user:data.user.id,async request(name,body){const response=await fetch(url+'/functions/v1/'+name,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(name==='import-recipe'?100000:25000)});return {http:response.status,...await response.json()};}};}
let second;try{second=JSON.parse(await readFile('.env.community-qa.json','utf8'));}catch{second={loginId:'communityqa'+Date.now().toString(36),password:randomBytes(20).toString('base64url')};const r=await fetch(url+'/functions/v1/register-with-id',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(second),signal:AbortSignal.timeout(25000)});assert.equal(r.status,201);await writeFile('.env.community-qa.json',JSON.stringify(second));}
const a=await login(second),b=await login(JSON.parse(await readFile('.env.ui-qa.json','utf8'))),week=weekStart(),endpoint='community?week='+week;
let variantId='',mealId='',shelfId='',followed='',draftKey='',draftRevision=0,checkKey='';
try{
 let core=await a.request('api');if(core.needsInit){check((await a.request('api',{op:'init'})).ok,'initialize dedicated QA member');core=await a.request('api');}
 check(core.http===200&&core.profile.id===a.user,'existing core API remains available');
 const unauth=await fetch(url+'/functions/v1/community',{headers:{apikey:key},signal:AbortSignal.timeout(15000)});check(unauth.status===401,'community API requires authentication');
 const state=await a.request(endpoint);check(state.http===200&&Array.isArray(state.meals)&&Array.isArray(state.following),'new live state is available');
 const r=core.recipes.find(r=>r.sample&&r.status==='published'&&r.ingredients);check(!!r,'sample original available without notifying real authors');
 if(!state.following.includes(r.owner)){check((await a.request('community',{op:'follow',author:r.owner,expectedUser:a.user})).ok,'follow author');followed=r.owner;}
 check((await a.request(endpoint)).following.includes(r.owner),'follow survives reload');
 check((await a.request('community',{op:'draftGet',key:'new',expectedUser:b.user})).http===409,'stale account cannot write/read another login');
 const empty=await a.request('community',{op:'draftGet',key:'new'});check(!empty.draft,'QA new draft is empty before isolated check');draftKey='new';
 const payload={title:'同期機能の確認用・非公開',description:'端末間の下書き確認',ingredients:'豆腐 150g',steps:'焼く',minutes:10,servings:1,category:'主菜',image:'none'};
 const first=await a.request('community',{op:'draftPut',key:draftKey,revision:0,payload});check(first.ok&&first.draft.revision>0,'cloud draft saves: '+JSON.stringify(first));draftRevision=first.draft.revision;
 check((await b.request('community',{op:'draftGet',key:draftKey})).draft?.payload.title!==payload.title,'other account cannot see cloud draft');
 const race=await Promise.all([a.request('community',{op:'draftPut',key:draftKey,revision:draftRevision,payload:{...payload,description:'端末A'}}),a.request('community',{op:'draftPut',key:draftKey,revision:draftRevision,payload:{...payload,description:'端末B'}})]);
 check(race.filter(x=>x.http===200).length===1&&race.filter(x=>x.http===409).length===1,'live concurrent drafts return exactly one conflict');draftRevision=race.find(x=>x.http===200).draft.revision;
 check((await a.request('community',{op:'cook',recipe:r.id,confirmCooked:false})).http===400,'cooking confirmation remains mandatory; no false report created');
 const arranged=await a.request('import-recipe',{action:'arrange',sourceRecipe:r.id,servings:4,preferences:'4人分に調整してください。辛くしない。',availableIngredients:''});
 check(arranged.http===200&&arranged.draft.servings===4&&arranged.draft.ingredients&&arranged.draft.steps,'Gemini makes an actual arrangement');
 check(arranged.source.id===r.id&&arranged.source.version===r.version&&arranged.source.hash===r.hash,'AI response retains server-verified original version/hash');
 const variant=await a.request('community',{op:'variantSave',sourceRecipe:r.id,sourceVersion:arranged.source.version,sourceHash:arranged.source.hash,payload:arranged.draft,preferences:'4人分'});check(variant.ok,'private variant saves');variantId=variant.id;
 check(!(await b.request(endpoint)).variants.some(v=>v.id===variantId),'another account cannot see private variant');
 const saved=core.shelf.find(s=>s.recipe===r.id);if(!saved){check((await a.request('api',{op:'save',recipe:r.id})).ok,'sample can be saved through existing core API');core=await a.request('api');shelfId=core.shelf.find(s=>s.recipe===r.id).id;}
 const plan=await a.request('community',{op:'planAdd',day:japanDate(),slot:'夜',kind:'variant',sourceId:variantId,servings:2});check(plan.ok,'arrangement can be added to meal plan');mealId=plan.id;
 const planned=await a.request(endpoint),meal=planned.meals.find(m=>m.id===mealId);check(meal?.snapshot.authorName&&meal.snapshot.sourceRecipe===r.id,'meal preserves original author');
 check(!(await b.request(endpoint)).meals.some(m=>m.id===mealId),'meal plan is private');
 check((await b.request('community',{op:'planServings',id:mealId,servings:5})).http===404,'another account cannot change servings');
 const list=shoppingList([meal]);check(list.length>0,'real arrangement produces consolidated shopping items');
 checkKey='qa-check-'+mealId;check((await a.request('community',{op:'shoppingCheck',week,key:checkKey,checked:true})).ok,'shopping checkbox saves');check((await a.request(endpoint)).checks.includes(checkKey)&&!(await b.request(endpoint)).checks.includes(checkKey),'shopping checkbox reloads privately');
 const exported=await a.request('community',{op:'export'});check(exported.variants.some(v=>v.id===variantId)&&exported.meals.some(m=>m.id===mealId),'account export includes arrangements and all meal plans');
 console.log(JSON.stringify({result:'PASS',checks,aiModel:arranged.modelUsed,aiCalls:1,publicCookingReportsCreated:0,chainTransactions:0}));
}finally{
 const cleanup=[];async function clean(body){try{const r=await a.request('community',body);if(r.http!==200)cleanup.push(body.op+':'+r.http);}catch{cleanup.push(body.op);}}
 if(checkKey)await clean({op:'shoppingCheck',week,key:checkKey,checked:false});
 if(mealId)await clean({op:'planDelete',id:mealId});if(variantId)await clean({op:'variantDelete',id:variantId});
 if(draftKey&&draftRevision)await clean({op:'draftDelete',key:draftKey,revision:draftRevision});
 if(followed)await clean({op:'follow',author:followed,follow:false});
 if(shelfId){const result=await a.request('api',{op:'removeShelf',id:shelfId});if(!result.ok)cleanup.push('removeShelf');}
 console.log(cleanup.length?'CLEANUP needs attention: '+cleanup.join(','):'PASS only this run’s QA data cleaned up');
}
