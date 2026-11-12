// 歴史資料。修正前の fb2db36 時点の挙動を再現するスクリプトです。
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('..',import.meta.url));
const require=createRequire(root+'/package.json');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const {translate}=await import(pathToFileURL(root+'/supabase/functions/_shared/sql-compat.ts'));
const db=await PGlite.create();
const temporary=new URL('./.review-core-handler.mjs',import.meta.url);
let user='author';
function database(){const prepare=(query,args=[])=>({query,args,bind(...args){return prepare(query,args)},async all(){return {results:(await db.query(translate(query),args)).rows}},async first(){return (await db.query(translate(query),args)).rows[0]||null},async run(){const r=await db.query(translate(query),args);return {meta:{changes:r.affectedRows||0}}}});return {prepare,batch:statements=>db.transaction(async tx=>{const results=[];for(const s of statements){const r=await tx.query(translate(s.query),s.args);results.push({meta:{changes:r.affectedRows||0}})}return results})}}
try {
 await db.exec('create role anon;create role authenticated;create role service_role;');
 await db.exec((await fs.readFile(root+'/supabase/schema.sql','utf8')).split('INSERT INTO storage.buckets')[0]);
 await db.exec(await fs.readFile(root+'/supabase/migrations/20261102155029_social_planning_and_synced_drafts.sql','utf8'));
 globalThis.reviewHarness={database,bucket:{},cors:{},userFor:async()=>({id:user})};
 let source=await fs.readFile(root+'/supabase/functions/api/index.ts','utf8');
 source=source.replace("import {database,bucket,cors,userFor} from '../_shared/runtime.ts';",'const {database,bucket,cors,userFor}=globalThis.reviewHarness;')
  .replaceAll("from '../_shared/","from '"+pathToFileURL(root+'/supabase/functions/_shared/').href)
  .replace('Deno.serve(','globalThis.reviewHandler=(');
 await fs.writeFile(temporary,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
 await import(temporary.href);
 const core=body=>globalThis.reviewHandler(new Request('https://review.local/api',{method:'POST',headers:{Origin:'https://review.local'},body:JSON.stringify(body)})).then(async r=>({status:r.status,...await r.json()}));
 const state=()=>globalThis.reviewHandler(new Request('https://review.local/api')).then(r=>r.json());
 await core({op:'init'});user='reader';await core({op:'init'});user='author';
 const recipe={title:'旧版の豆腐焼き',description:'',ingredients:'豆腐 150g\n油 小さじ1',steps:'水気を切る\n焼く',minutes:10,servings:1,category:'主菜',image:'none',consent:true};
 const first=await core({op:'publish',...recipe});assert.ok(first.ok);
 user='reader';await core({op:'save',recipe:first.id});user='author';
 const newer=await core({op:'publish',...recipe,id:first.id,version:1,title:'端末Aで更新したタイトル'});assert.ok(newer.ok);
 const stale=await core({op:'publish',...recipe,id:first.id,version:1,title:'端末Bに残った旧版'});
 const afterStale=(await state()).recipes.find(r=>r.id===first.id);
 console.log(JSON.stringify({case:'stale_publication',accepted:stale.ok,storedTitle:afterStale.title,storedVersion:afterStale.version,submittedVersion:1}));
 await db.query(`insert into recipes(id,owner,title,description,ingredients,steps,minutes,servings,category,image,status,version,hash,sample,created,updated)
 select 'review-fill-'||g,'author','fixture '||g,'','ingredient '||g,'step '||g,10,1,'主菜','none','published',1,'reviewhash-'||g,0,'2099-01-01','2099-01-01' from generate_series(1,501) as g`);
 user='reader';const reader=await state();
 console.log(JSON.stringify({case:'saved_recipe_after_feed_cap',totalRecipes:(await db.query('select count(*)::int n from recipes')).rows[0].n,returnedRecipes:reader.recipes.length,shelfRetainsOriginal:reader.shelf.some(s=>s.recipe===first.id),originalAvailable:reader.recipes.some(r=>r.id===first.id)}));
 user='author';
 const distinct={...recipe,title:'独立した検証用レシピ',ingredients:'検証食材XYZ 43g',steps:'検証工程XYZ',acknowledgeSimilarity:true};
 const original=await core({op:'publish',...distinct});assert.ok(original.ok);
 const checked=(await db.query("select id from recipes where status='published' limit 500")).rows;
 const duplicate=await core({op:'publish',...distinct});
 console.log(JSON.stringify({case:'duplicate_beyond_scan_cap',originalInComparedSet:checked.some(r=>r.id===original.id),duplicateAccepted:duplicate.ok,distinctRecipeIds:original.id!==duplicate.id}));
} finally {
 delete globalThis.reviewHandler;delete globalThis.reviewHarness;
 await fs.unlink(temporary).catch(()=>{});await db.close();
}
