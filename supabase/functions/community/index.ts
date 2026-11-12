import {cors,sql,userFor} from '../_shared/runtime.ts';
import {CommunityError,communityService} from '../_shared/community.ts';
const handle=communityService(sql);
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(!['GET','POST'].includes(req.method))return Response.json({error:'method_not_allowed'},{status:405,headers:cors});
  try {
    const user=await userFor(req);if(!user)return Response.json({error:'ログインしてください。'},{status:401,headers:cors});
    const result=await handle(req,user.id);return Response.json(result,{headers:cors});
  } catch(error) {
    if(error instanceof CommunityError)return Response.json({error:error.message,...error.details},{status:error.status,headers:cors});
    console.error(JSON.stringify({event:'community_failed',code:(error as any)?.code||'unknown'}));
    return Response.json({error:'保存先に接続できませんでした。入力を残したまま再試行してください。'},{status:503,headers:cors});
  }
});
