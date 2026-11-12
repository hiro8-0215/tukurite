import {useEffect,useRef,useState} from 'react';
import {apiFetch} from '../supabase';
import type {Recipe} from './model';
export function useRecipeFeed(query:string,category:string,author:string,sort:string,revision:unknown){
 const [recipes,setRecipes]=useState<Recipe[]>([]),[cursor,setCursor]=useState<string|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const generation=useRef(0),active=useRef(false);
 const scope=JSON.stringify([query,category,author,sort]);const currentScope=useRef(scope);currentScope.current=scope;
 async function fetchPage(next:string|null,version:number){
  if(active.current)return;active.current=true;setLoading(true);
  try{const p=new URLSearchParams({action:'feed',q:query,category,author,sort});if(next)p.set('cursor',next);const r=await apiFetch('/api/app?'+p);const j=await r.json();if(!r.ok)throw Error(j.error||'一覧を取得できませんでした。');if(version!==generation.current||currentScope.current!==scope)return;setRecipes(prev=>next?[...new Map([...prev,...j.recipes].map((r:Recipe)=>[r.id,r])).values()]:j.recipes);setCursor(j.nextCursor);setError('');}
  catch(e){if(version===generation.current)setError((e as Error).message);}
  finally{if(version===generation.current){setLoading(false);active.current=false;}}
 }
 useEffect(()=>{const version=++generation.current;active.current=false;setRecipes([]);setCursor(null);setError('');if(!revision)return;setLoading(true);const timer=setTimeout(()=>void fetchPage(null,version),200);return()=>clearTimeout(timer);},[scope,revision,retry]);
 return {recipes,cursor,loading,error,more:()=>fetchPage(cursor,generation.current),reload:()=>setRetry(n=>n+1)};
}
