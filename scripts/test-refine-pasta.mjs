import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {randomBytes} from 'node:crypto';
const url='https://lcgpgyncmdsidgbtpjoy.supabase.co',key='sb_publishable_2urB_xb-tG0RFQ_DAVP4oA_qkVBdR8j';
let credentials;
try{credentials=JSON.parse(await readFile('.env.ui-qa.json','utf8'));}catch{
 credentials={loginId:'pastaqa'+Date.now().toString(36),password:randomBytes(20).toString('base64url')};
 const registration=await fetch(url+'/functions/v1/register-with-id',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(credentials)});assert.equal(registration.status,201,'QA registration');
}
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await client.auth.signInWithPassword({email:credentials.loginId+'@users.tsukurite.app',password:credentials.password});assert.ifError(error);
export const pasta={title:'タコとグリル野菜のパスタ',description:'にんにくと唐辛子の香りをつける。パスタは規定の30秒短く茹でる。',ingredients:'パスタ 100g\nタコ 100g\nグリル野菜ミックス 適量\nニンニク 1片\n唐辛子 1本\nオリーブオイル 小さじ1',steps:'規定の30秒短く茹でる\n\nタコはぶつ切り、ニンニクはみじん切り\nフライパンではタコにんにく、唐辛子を焼く\n\nタコが焼けてきたらグリル野菜ミックスを加え焼く\nパスタが茹で上がったらフライパンに移し絡める\n塩で味を整え、皿に盛る',servings:1,minutes:20,category:'麺類'};
const response=await fetch(url+'/functions/v1/import-recipe',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'refine',recipe:pasta})});
const result=await response.json();console.log(JSON.stringify({status:response.status,...result},null,2));
assert.equal(response.status,200,'pasta refinement succeeds');
assert.equal(result.draft.title,pasta.title);assert.equal(result.draft.servings,1);
for(const term of ['タコ','100g','小さじ1'])assert.ok(result.draft.ingredients.includes(term),term+' retained');
assert.ok(result.draft.steps.includes('30秒'),'relative cooking time retained');
assert.ok(result.draft.steps.split('\n').length>=3,'steps organized');
console.log('PASS pasta refinement regression. Nothing was published.');
