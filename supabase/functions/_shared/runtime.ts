import postgres from 'npm:postgres@3.4.7';
import {createClient} from 'npm:@supabase/supabase-js@2.111.0';
import {translate} from './sql-compat.ts';
export {translate} from './sql-compat.ts';
export const sql=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:1,idle_timeout:20,connect_timeout:10});
const named=(n:string,f:string)=>{try{return JSON.parse(Deno.env.get(n)||'{}').default||Deno.env.get(f)||'';}catch{return Deno.env.get(f)||'';}};
export const admin=createClient(Deno.env.get('SUPABASE_URL')!,named('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
export async function userFor(req:Request){
 const token=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');if(!token)return null;
 const {data,error}=await admin.auth.getUser(token);if(error){if(!error.status||error.status>=500)throw Error('Authentication service unavailable');return null;}if(!data.user)return null;
 let session:string;try{const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));session=payload.session_id;if(!/^[0-9a-f-]{36}$/i.test(session))return null;}catch{return null;}
 // getUser verifies the signature first. A refreshed, revoked session must not bypass recovery.
 const rows=await sql`select 1 from auth.sessions s left join public.account_security a on a.owner=s.user_id where s.id=${session}::uuid and s.user_id=${data.user.id}::uuid and (a.revoked_before is null or s.created_at>a.revoked_before)`;
 return rows.length?data.user:null;
}
export const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Cache-Control':'private, no-store'};
export function database(connection:any=sql,inTransaction=false):any{
 const statement=(query:string,args:unknown[]=[])=>({query,args,bind(...values:unknown[]){return statement(query,values);},async all(){return {results:await connection.unsafe(translate(query),args)};},async first(){return (await connection.unsafe(translate(query),args))[0]||null;},async run(){if(inTransaction){const r=await connection.unsafe(translate(query),args);return {meta:{changes:r.count}};}return connection.begin(async(tx:any)=>{await tx`select pg_advisory_xact_lock(715224)`;return database(tx,true).prepare(query).bind(...args).run();});}});
 return {prepare:statement,async transaction(fn:(tx:any)=>Promise<any>){if(inTransaction)return fn(database(connection,true));return connection.begin(async(tx:any)=>{await tx`select pg_advisory_xact_lock(715224)`;return fn(database(tx,true));});},async batch(statements:any[]){return this.transaction(async(tx:any)=>{const results=[];for(const s of statements)results.push(await tx.prepare(s.query).bind(...s.args).run());return results;});}};
}
export const bucket={async put(path:string,body:Uint8Array,options:any){const {error}=await admin.storage.from('photos').upload(path,body,{contentType:options.httpMetadata.contentType,upsert:false});if(error)throw Error('写真を保存できませんでした。');},async get(path:string){const {data,error}=await admin.storage.from('photos').download(path);return error?null:{body:data};}};
