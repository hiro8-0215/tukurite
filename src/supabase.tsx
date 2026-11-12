import {createClient} from '@supabase/supabase-js';
import {useEffect,useState} from 'react';
export const url='https://lcgpgyncmdsidgbtpjoy.supabase.co';
export const key='sb_publishable_2urB_xb-tG0RFQ_DAVP4oA_qkVBdR8j';
export const supabase=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'tsukurite-auth'}});
export async function apiFetch(path:string,options:RequestInit={}){
 const {data}=await supabase.auth.getSession();const token=data.session?.access_token;const h=new Headers(options.headers);h.set('apikey',key);if(token)h.set('Authorization','Bearer '+token);
 const target=new URL(path,'https://local.invalid');const route=target.pathname.startsWith('/api/community')?'community':target.pathname==='/api/account-security'?'account-security':target.pathname.startsWith('/api/extract')?'import-recipe':target.pathname.startsWith('/api/photo')?'api/photo':'api';
 try{return await fetch(url+'/functions/v1/'+route+target.search,{...options,headers:h,signal:options.signal||AbortSignal.timeout(route==='import-recipe'?120000:25000)});}catch{throw new Error('サービスに接続できません。通信環境を確認し、時間を置いて再試行してください。入力内容はそのままです。');}
}
export function Photo({id,className}:{id:string;className:string}){
 const [src,setSrc]=useState(''),[failed,setFailed]=useState(false);
 useEffect(()=>{let current=true,object='';setSrc('');setFailed(false);apiFetch('/api/photo?id='+encodeURIComponent(id)).then(async r=>{if(!r.ok)throw Error('photo unavailable');object=URL.createObjectURL(await r.blob());if(current)setSrc(object);else URL.revokeObjectURL(object);}).catch(()=>{if(current)setFailed(true);});return()=>{current=false;if(object)URL.revokeObjectURL(object);};},[id]);
 return src&&!failed?<img className={className} src={src} alt="投稿者の料理写真" onError={()=>setFailed(true)}/>:<div className={className+' food-none'} role="img" aria-label={failed?'料理写真を表示できません':'料理写真を読み込み中'}><span>{failed?'料理写真を表示できません':'写真を読み込み中…'}</span></div>;
}
