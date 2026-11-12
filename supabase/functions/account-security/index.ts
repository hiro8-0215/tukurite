import {createClient} from 'npm:@supabase/supabase-js@2.111.0';
import {sql,admin,cors,userFor} from '../_shared/runtime.ts';
import {accountSecurityService,SecurityError} from '../_shared/account-security.ts';
const handler=accountSecurityService(sql,{
 async verify(email,password){
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.auth.signInWithPassword({email,password});
  if(error||!data.session)return null;
  const id=data.user.id;await admin.auth.admin.signOut(data.session.access_token,'local');return id;
 },
 async changePassword(id,password){const {error}=await admin.auth.admin.updateUserById(id,{password});if(error)throw new SecurityError('パスワードを更新できませんでした。別のパスワードを指定して再試行してください。');}
});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{return Response.json(await handler(req,await userFor(req)),{headers:cors});}
 catch(e){return Response.json({error:e instanceof SecurityError?e.message:'復旧サービスに接続できません。時間を置いて再試行してください。'},{status:e instanceof SecurityError?e.status:503,headers:cors});}
});
