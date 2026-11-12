import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {database as testDatabase} from './test-database.mjs';
import {translate} from '../supabase/functions/_shared/sql-compat.ts';
import {communityService} from '../supabase/functions/_shared/community.ts';
const db=await PGlite.create(),temporary='scripts/.core-test-'+crypto.randomUUID()+'.mjs';let user='author',checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
function database(){return testDatabase(db)}
function sqlFor(connection){const tag=async(strings,...args)=>{const text=strings.reduce((s,p,i)=>s+(i?'$'+i:'')+p,'');if(text.includes('pg_advisory_xact_lock'))return [];return (await connection.query(text,args)).rows;};tag.begin=fn=>db.transaction(tx=>fn(sqlFor(tx)));return tag;}
try{
 await db.exec('create role anon;create role authenticated;create role service_role;');await db.exec((await fs.readFile('supabase/schema.sql','utf8')).split('INSERT INTO storage.buckets')[0]);await db.exec(await fs.readFile('supabase/migrations/20261102155029_social_planning_and_synced_drafts.sql','utf8'));
 const photos=new Map();globalThis.coreApiHarness={database,bucket:{put:async(k,v)=>photos.set(k,v),get:async k=>photos.has(k)?{body:photos.get(k)}:null},cors:{'Access-Control-Allow-Origin':'*'},userFor:async()=>user?{id:user}:null};
 let source=await fs.readFile('supabase/functions/api/index.ts','utf8');source=source.replace("import {database,bucket,cors,userFor} from '../_shared/runtime.ts';",'const {database,bucket,cors,userFor}=globalThis.coreApiHarness;').replaceAll("from '../_shared/","from '../supabase/functions/_shared/").replace('Deno.serve(','globalThis.coreApiHandler=(');
 await fs.writeFile(temporary,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);await import(pathToFileURL(process.cwd()+'/'+temporary).href);
 const core=body=>globalThis.coreApiHandler(new Request('https://test.local/api',{method:'POST',headers:{Origin:'https://test.local'},body:JSON.stringify(body)})).then(async r=>({status:r.status,...await r.json()}));
 const state=()=>globalThis.coreApiHandler(new Request('https://test.local/api')).then(r=>r.json());
 const social=(who,b)=>communityService(sqlFor(db))(new Request('https://test.local/community',{method:'POST',body:JSON.stringify(b)}),who);
 await core({op:'init'});user='reader';await core({op:'init'});user='author';
 const recipe={title:'隔離テスト用豆腐',description:'',ingredients:'豆腐 150g\n油 小さじ1',steps:'水気を切る\n焼く',minutes:10,servings:1,category:'主菜',image:'none',consent:true};
 const first=await core({op:'publish',...recipe});check(first.ok,'existing publication still works');
 await social('reader',{op:'follow',author:'author'});
 const second=await core({op:'publish',...recipe,title:'隔離テスト用トマト',ingredients:'トマト 1個',steps:'切って盛る'});check(second.ok,'publication with followers succeeds');
 check((await db.query("select count(*)::int as n from notifications where recipient='reader' and kind='recipe'")).rows[0].n===1,'new publication notifies a follower');
 user='reader';check((await core({op:'save',recipe:first.id})).ok,'save works with notification SQL');await core({op:'save',recipe:first.id});
 check((await db.query("select count(*)::int as n from notifications where recipient='author' and kind='save'")).rows[0].n===1,'duplicate save does not duplicate notifications');
 check((await core({op:'cook',recipe:first.id,confirmCooked:true})).ok,'legacy cooking action works with new notifications');
 await core({op:'cook',recipe:first.id,confirmCooked:true});check((await db.query("select count(*)::int as n from notifications where kind='cook'")).rows[0].n===1,'duplicate legacy cooking notice is excluded');
 user='author';check((await state()).rewards.myPoints===4,'save and daily cooking retain the existing point weights');
 const revised=await core({op:'publish',...recipe,id:first.id,version:1,title:'隔離テスト用豆腐・改訂'});check(revised.ok,'recipe revision still works');
 user='reader';check((await state()).recipes.some(r=>r.id===first.id&&r.version===2),'revised original is readable');
 user=null;check((await core({op:'save',recipe:first.id})).status===401,'existing API keeps authentication required');
 console.log(`PASS ${checks} core API and community integration checks in isolated Postgres`);
}finally{delete globalThis.coreApiHandler;delete globalThis.coreApiHarness;await fs.unlink(temporary).catch(()=>{});await db.close();}
