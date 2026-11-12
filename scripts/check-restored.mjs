import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';

const url='https://lcgpgyncmdsidgbtpjoy.supabase.co';
const key='sb_publishable_2urB_xb-tG0RFQ_DAVP4oA_qkVBdR8j';
const origin='https://tsukurite-kitchen.expo.app';
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
let session;
try {
  const health=await fetch(url+'/auth/v1/health',{headers:{apikey:key},signal:AbortSignal.timeout(15000)});
  assert.equal(health.status,200,'Auth health is ready');
  console.log('PASS Auth health HTTP 200');
  const unauth=await fetch(url+'/functions/v1/api',{headers:{apikey:key,Origin:origin},signal:AbortSignal.timeout(15000)});
  assert.equal(unauth.status,401,'Unauthenticated API access is rejected');
  console.log('PASS Unauthenticated API access remains HTTP 401');
  const credentials=JSON.parse(await readFile('.env.ui-qa.json','utf8'));
  const {data,error}=await client.auth.signInWithPassword({email:credentials.loginId+'@users.tsukurite.app',password:credentials.password});
  assert.ifError(error);
  assert.ok(data.session,'QA sign-in returned a session');
  session=data.session;
  console.log('PASS Existing QA account signs in');
  const response=await fetch(url+'/functions/v1/api',{headers:{apikey:key,Authorization:'Bearer '+session.access_token,Origin:origin},signal:AbortSignal.timeout(20000)});
  const state=await response.json();
  assert.equal(response.status,200,'Authenticated API is ready');
  assert.ok(state.profile?.id&&Array.isArray(state.recipes)&&Array.isArray(state.shelf),'Application state restored');
  assert.ok(['*',origin].includes(response.headers.get('access-control-allow-origin')),'Public app origin is allowed');
  console.log(JSON.stringify({result:'PASS authenticated app state',httpStatus:response.status,recipes:state.recipes.length,shelf:state.shelf.length,publicAppCors:true}));
  const anon=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const direct=await anon.from('shelves').select('id').limit(1);
  assert.ok(direct.error,'Anonymous direct table access must remain denied');
  console.log('PASS Anonymous direct shelf access remains denied');
} finally {
  if(session) await client.auth.signOut();
}
