export class SecurityError extends Error {status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export const securityMessage='復旧できませんでした。ログインIDと保存した復旧コードを確認してください。';
export const loginId=(v:unknown)=>{const s=typeof v==='string'?v.trim().toLowerCase():'';if(!/^[a-z0-9][a-z0-9._-]{2,22}[a-z0-9]$/.test(s))throw new SecurityError('ログインIDを確認してください。');return s;};
export const validPassword=(v:unknown)=>{if(typeof v!=='string'||v.length<8||v.length>72)throw new SecurityError('パスワードは8〜72文字で入力してください。');return v;};
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function rateLimit(sql:any,key:string,limit:number,seconds=3600){
 const [r]=await sql`insert into request_limits(key,attempts) values(${key},1) on conflict(key) do update set attempts=case when request_limits.window_start<now()-${seconds}*interval '1 second' then 1 else request_limits.attempts+1 end,window_start=case when request_limits.window_start<now()-${seconds}*interval '1 second' then now() else request_limits.window_start end returning attempts`;
 if(r.attempts>limit)throw new SecurityError('試行回数の上限です。時間を置いて再試行してください。',429);
}
export async function requestLimit(sql:any,req:Request,kind:string,globalLimit=60,ipLimit=10){
 // The global cap also applies when a caller spoofs or rotates forwarded addresses.
 await rateLimit(sql,kind+':global',globalLimit);
 const address=(req.headers.get('x-forwarded-for')||req.headers.get('x-real-ip')||'unknown').slice(0,200);
 await rateLimit(sql,kind+':ip:'+await digest(address),ipLimit);
 await sql`delete from request_limits where window_start<now()-interval '2 days'`;
}
export function accountSecurityService(sql:any,auth:{verify:(email:string,password:string)=>Promise<string|null>;changePassword:(id:string,password:string)=>Promise<void>}){
 return async(req:Request,user:{id:string;email?:string}|null)=>{
  if(req.method==='GET'){
   if(!user)throw new SecurityError('ログインしてください。',401);
   const [row]=await sql`select code_hash is not null as configured from account_security where owner=${user.id}::uuid`;
   return {configured:!!row?.configured};
  }
  if(req.method!=='POST')throw new SecurityError('対応していない操作です。',405);
  const raw=await req.text();if(raw.length>3000)throw new SecurityError('入力が大きすぎます。',413);
  let b:any;try{b=JSON.parse(raw);}catch{throw new SecurityError('入力形式を確認してください。');}
  if(!b||typeof b!=='object')throw new SecurityError('入力形式を確認してください。');
  if(b.op==='recover'){
   await requestLimit(sql,req,'recover',60,10);
   const id=loginId(b.loginId),password=validPassword(b.password);
   await rateLimit(sql,'recover:account:'+await digest(id),10);
   const code=typeof b.code==='string'?b.code.replace(/[\s-]/g,'').toLowerCase():'';
   if(!/^[0-9a-f]{48}$/.test(code))throw new SecurityError(securityMessage);
   const hash=await digest(id+':'+code);
   return sql.begin(async(tx:any)=>{
    const [row]=await tx`select owner,code_hash from account_security where login_id=${id} for update`;
    if(!row?.code_hash||row.code_hash!==hash)throw new SecurityError(securityMessage);
    await auth.changePassword(row.owner,password);
    await tx`update account_security set code_hash=null,pending_hash=null,pending_expires=null,revoked_before=now(),updated_at=now() where owner=${row.owner}::uuid`;
    return {ok:true};
   });
  }
  if(!user?.email||!user.email.endsWith('@users.tsukurite.app'))throw new SecurityError('ログインし直してください。',401);
  const id=loginId(user.email.split('@')[0]);
  if(b.op==='issue'){
   await rateLimit(sql,'issue:'+user.id,5);
   if(await auth.verify(user.email,validPassword(b.password))!==user.id)throw new SecurityError('現在のパスワードを確認してください。',403);
   const bytes=crypto.getRandomValues(new Uint8Array(24)),plain=Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join(''),hash=await digest(id+':'+plain);
   await sql`insert into account_security(owner,login_id,pending_hash,pending_expires) values(${user.id}::uuid,${id},${hash},now()+interval '10 minutes') on conflict(owner) do update set pending_hash=excluded.pending_hash,pending_expires=excluded.pending_expires,updated_at=now()`;
   return {code:plain.match(/.{1,6}/g)!.join('-')};
  }
  if(b.op==='activate'){
   await rateLimit(sql,'activate:'+user.id,10);
   const code=typeof b.code==='string'?b.code.replace(/[\s-]/g,'').toLowerCase():'';
   if(!/^[0-9a-f]{48}$/.test(code))throw new SecurityError('発行したコードを確認してください。');
   const hash=await digest(id+':'+code);
   const rows=await sql`update account_security set code_hash=pending_hash,pending_hash=null,pending_expires=null,updated_at=now() where owner=${user.id}::uuid and pending_hash=${hash} and pending_expires>now() returning owner`;
   if(!rows.length)throw new SecurityError('コードの確認期限が切れました。再発行してください。');
   return {ok:true};
  }
  throw new SecurityError('対応していない操作です。');
 };
}
