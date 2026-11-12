import {database,bucket,cors} from '../_shared/runtime.ts';
import {publicRecipeService} from '../_shared/public-recipe.ts';
const handler=publicRecipeService(database(),bucket);
Deno.serve(async req=>{try{return await handler(req);}catch{return Response.json({error:'サービスに接続できません。時間を置いて再試行してください。'},{status:503,headers:cors});}});
