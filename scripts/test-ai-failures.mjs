import assert from 'node:assert/strict';
import {generatedRecipeObject,recipeAiFailure} from '../supabase/functions/_shared/recipe-ai-response.ts';
import {generateWithOneRetry} from '../supabase/functions/_shared/recipe-ai-retry.ts';
import {cleanupRecipeInput} from '../src/lib/recipe-cleanup.ts';
import {chefInstruction,draftResult} from '../supabase/functions/_shared/recipe-chef.ts';
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
check(generatedRecipeObject({text:'```json\n{"name":"パスタ"}\n```',candidates:[{finishReason:'STOP'}]}).name==='パスタ','valid structured recipe');
for(const [response,code] of [[{text:'{"name":',candidates:[{finishReason:'MAX_TOKENS'}]},'ai_output_truncated'],[{text:''},'ai_empty_output'],[{text:'not json'},'ai_invalid_json'],[{text:'',promptFeedback:{blockReason:'SAFETY'}},'ai_blocked']]){
 let caught;try{generatedRecipeObject(response);}catch(e){caught=e;}
 check(caught?.code===code,'recognize '+code);
 check(!recipeAiFailure(caught,'refine').error.includes('画像'),'refinement does not request source images');
}
const busy=Object.assign(Error('unavailable'),{status:503});
check(recipeAiFailure(busy,'refine').status===503,'503 stays a service error');
check(recipeAiFailure(busy,'refine').error.includes('混み合'),'busy explanation');
check(recipeAiFailure(Object.assign(Error('quota'),{status:429}),'refine').status===429,'quota stays 429');
let calls=0,reservations=0,pauses=0;
const generated=await generateWithOneRetry(async()=>{calls++;if(calls===1)throw busy;return 'recipe';},async()=>{reservations++;return true;},async()=>{pauses++;});
check(generated==='recipe'&&calls===2&&reservations===1&&pauses===1,'one counted retry recovers from 503');
calls=0;reservations=0;await assert.rejects(generateWithOneRetry(async()=>{calls++;throw busy;},async()=>{reservations++;return true;},async()=>{}));
check(calls===2&&reservations===1,'persistent outage is not retried indefinitely');
for(const status of [400,401,403,404,429]){
 calls=0;reservations=0;await assert.rejects(generateWithOneRetry(async()=>{calls++;throw Object.assign(Error('provider'),{status});},async()=>{reservations++;return true;},async()=>{}));
 check(calls===1&&reservations===0,'no retry for '+status);
}
calls=0;await assert.rejects(generateWithOneRetry(async()=>{calls++;throw busy;},async()=>false,async()=>{}));
check(calls===1,'retry denied when app quota is full');
const original={title:'タコのパスタ',description:'規定より30秒短く',ingredients:' タコ 100g\n\n オリーブオイル 小さじ1\n0.5g 塩',steps:'1. パスタを規定より30秒短く茹でる\n\n2. タコと絡める',servings:1,minutes:20,category:'麺類'};
const cleanup=cleanupRecipeInput(original);
check(cleanup.source==='input_cleanup','local cleanup is explicitly not AI');
check(cleanup.draft.ingredients==='タコ 100g\nオリーブオイル 小さじ1\n0.5g 塩','quantities including a leading decimal are preserved');
check(cleanup.draft.steps==='パスタを規定より30秒短く茹でる\nタコと絡める','only blank lines and list prefixes removed');
check(original.steps.startsWith('1.')&&cleanup.draft.title===original.title&&cleanup.draft.description===original.description,'original input and context not changed');
check(recipeAiFailure({status:429},'refine').code==='ai_provider_limit','quota recognized without an Error instance');
check(chefInstruction('arrange').includes('originalServings')&&chefInstruction('arrange').includes('availableIngredients'),'arrangement uses original servings and available ingredients');
const arranged=draftResult({name:'タコのきのこパスタ',ingredients:[{name:'タコ',quantity:'200',unit:'g'}],steps:['1. 焼く'],warnings:['きのこに変更']},{...original,servings:2},'arrange');
check(arranged.draft.title==='タコのきのこパスタ'&&arranged.draft.servings===2&&arranged.warnings[0].includes('自分用'),'arranged recipe keeps requested servings and states private provenance');
console.log(`PASS ${checks} AI response and retry checks`);
