import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const url='https://lcgpgyncmdsidgbtpjoy.supabase.co',key='sb_publishable_2urB_xb-tG0RFQ_DAVP4oA_qkVBdR8j',file='.env.recovery-qa.json';
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++};
async function call(route,body,token){const r=await fetch(url+'/functions/v1/'+route,{method:body?'POST':'GET',headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});return {status:r.status,data:await r.json()};}
let credentials;try{credentials=JSON.parse(await readFile(file,'utf8'));}catch{credentials={loginId:'qarecover'+Date.now().toString(36),password:'Qa!'+crypto.randomUUID()};const registration=await call('register-with-id',credentials);check(registration.status===201,'dedicated QA account registers');await writeFile(file,JSON.stringify(credentials));}
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
try{
 const {data,error}=await client.auth.signInWithPassword({email:credentials.loginId+'@users.tsukurite.app',password:credentials.password});assert.ifError(error);const token=data.session.access_token,user=data.user.id;
 check((await call('api',{op:'init'},token)).data.ok,'QA account initializes');
 check((await call('public-recipe?health=1')).status===200,'public health is ready');
 const pub=await call('public-recipe?id=sample-tomato');check(pub.status===200&&pub.data.recipe.title,'guest reads sample');check(!pub.data.recipe.wallet&&!pub.data.recipe.owner,'public response does not contain account wallet/owner');
 check((await call('public-recipe?id=missing-review-recipe')).status===404,'unknown original is 404');
 check((await call('api?action=recipe&id=sample-tomato',undefined,token)).status===200,'authenticated ID fetch works');
 const feed=await call('api?action=feed&q='+encodeURIComponent('トマト'),undefined,token);check(feed.status===200&&feed.data.recipes.some(r=>r.id==='sample-tomato'),'server-side search works live');
 check((await call('api?action=export',undefined,token)).data.profile.id===user,'full export belongs to current user');
 check((await call('account-security')).status===401,'recovery settings require login');
 const issue=await call('account-security',{op:'issue',password:credentials.password},token);check(issue.status===200&&!!issue.data.code,'current password permits recovery code issuance');
 check((await call('account-security',{op:'activate',code:issue.data.code},token)).data.ok,'stored code activation');
 check((await call('account-security',undefined,token)).data.configured,'configured status visible');
 const password='NewQa!'+crypto.randomUUID();
 const reset=await call('account-security',{op:'recover',loginId:credentials.loginId,code:issue.data.code,password});check(reset.data.ok,'recovery sets new password');
 credentials.password=password;await writeFile(file,JSON.stringify(credentials));
 check((await call('api',undefined,token)).status===401,'pre-recovery token cannot access core API');
 check((await call('community',undefined,token)).status===401,'pre-recovery token cannot access community');
 check((await call('import-recipe',{action:'quota'},token)).status===401,'pre-recovery token cannot call AI');
 check((await call('account-security',{op:'recover',loginId:credentials.loginId,code:issue.data.code,password})).status===400,'recovery code cannot be reused');
 const next=await client.auth.signInWithPassword({email:credentials.loginId+'@users.tsukurite.app',password});assert.ifError(next.error);
 check((await call('api',undefined,next.data.session.access_token)).data.profile.id===user,'new login retains same account and recipes');
 check(!(await call('account-security',undefined,next.data.session.access_token)).data.configured,'used code requires replacement');
 console.log(`PASS ${checks} live public reading, search, export and recovery checks. No recipe publication or blockchain transaction.`);
}finally{await client.auth.signOut({scope:'local'});}
