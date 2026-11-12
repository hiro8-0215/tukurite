import {useCallback,useEffect,useRef,useState} from 'react';
import {apiFetch} from '../supabase';
import type {RecipeDraft} from '../components/recipe-suggestion';
import type {MealItem} from './planning';
export type Author={id:string;name:string;bio:string;sample:boolean;recipe_count:number;followers:number};
export type CookPost={id:string;owner:string;recipe:string;photo:string;caption:string;day:string;created_at:string;sample:boolean;owner_name:string;recipe_title:string;author_id:string;author_name:string;comment_count:number};
export type Notice={id:string;actor:string;kind:string;recipe:string|null;post:string|null;read_at:string|null;created_at:string;actor_name:string;recipe_title:string|null};
export type Variant={id:string;source_recipe:string;source_version:number;payload:RecipeDraft;preferences:string;created_at:string;source_title:string;source_status:string;author_name:string};
export type CommunityState={following:string[];authors:Author[];posts:CookPost[];notifications:Notice[];unread:number;drafts:Array<{draft_key:string;revision:number;title:string;updated_at:string}>;variants:Variant[];meals:MealItem[];checks:string[];week:string};
export async function communityApi(body:Record<string,unknown>,expectedUser?:string){
  const response=await apiFetch('/api/community',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,...(expectedUser?{expectedUser}:{})})});
  const result=await response.json();
  if(!response.ok)throw Object.assign(new Error(result.error||'操作を完了できませんでした。'),{status:response.status,...result});
  return result;
}
export function useCommunity(user:string|undefined,week:string){
  const [data,setData]=useState<CommunityState|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const generation=useRef(0),lastLoad=useRef(0),scope=useRef('');scope.current=(user||'')+'|'+week;
  const load=useCallback(async()=>{const key=(user||'')+'|'+week;if(!user||scope.current!==key)return;const current=++generation.current;setLoading(true);try{const response=await apiFetch('/api/community?week='+encodeURIComponent(week)+'&expectedUser='+encodeURIComponent(user),{cache:'no-store'});const result=await response.json();if(!response.ok)throw Error(result.error||'つながりを読み込めませんでした。');if(current===generation.current&&scope.current===key){setData(result);setError('');lastLoad.current=Date.now();}}catch(e){if(current===generation.current&&scope.current===key)setError((e as Error).message);}finally{if(current===generation.current&&scope.current===key)setLoading(false);}},[user,week]);
  useEffect(()=>{setData(null);load();return()=>{generation.current++;};},[load]);
  useEffect(()=>{const focus=()=>{if(Date.now()-lastLoad.current>15000)load();};window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus);},[load]);
  return {data,error,loading,load};
}
