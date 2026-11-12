import {useCallback,useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {communityApi} from './community';
import {removeDraft,type LocalDraft} from './experience';
type Remote={payload:LocalDraft;revision:number;updated_at:string};
type RecordState={key:string;user:string;revision:number;ready:boolean;stopped:boolean;conflicted:boolean;remote:Remote|null;lastSaved:string;pending:Promise<boolean>|null;opening:Promise<void>|null};
function payload(d:LocalDraft):LocalDraft{return {title:d.title,description:d.description,ingredients:d.ingredients,steps:d.steps,minutes:d.minutes,servings:d.servings,category:d.category,image:d.image||'none',...(d.id?{id:d.id,version:d.version||0}:{})};}
const fingerprint=(d:LocalDraft)=>JSON.stringify(payload(d));
const hasContent=(d:LocalDraft)=>[d.title,d.description,d.ingredients,d.steps].some(x=>x.trim())||d.image!=='none';
export function useCloudDraft(user:string|undefined,editor:LocalDraft|null,setEditor:Dispatch<SetStateAction<any>>,onChanged:()=>Promise<unknown>){
  const current=useRef<RecordState|null>(null),latest=useRef(editor),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const [status,setStatus]=useState(''),[conflict,setConflict]=useState<{draft:Remote|null}|null>(null),[tick,setTick]=useState(0),[retryKey,setRetryKey]=useState(0);
  latest.current=editor;
  const flush=useCallback(async():Promise<boolean>=>{
    const record=current.current;if(!record||record.stopped)return false;
    if(record.opening)await record.opening;
    if(record.stopped||current.current!==record)return false;
    if(record.pending){await record.pending;if(record.stopped||current.current!==record)return false;}
    if(!record.ready||record.conflicted||!latest.current)return false;
    const next=payload(latest.current);if(!hasContent(next)&&record.revision===0)return true;
    const encoded=fingerprint(next);if(record.lastSaved===encoded)return true;
    setStatus('クラウドに同期中…');
    const work=(async()=>{try{
      const result=await communityApi({op:'draftPut',key:record.key,revision:record.revision,payload:next},record.user);
      record.revision=result.draft.revision;record.lastSaved=encoded;
      if(current.current===record&&!record.stopped){setStatus(latest.current&&fingerprint(latest.current)!==encoded?'未同期の変更があります':'クラウドに同期済み');setTick(n=>n+1);}
      return true;
    }catch(e){if(current.current===record&&!record.stopped){if((e as any).status===409){record.conflicted=true;record.ready=false;record.remote=(e as any).draft||null;setConflict({draft:record.remote});setStatus('別の端末で下書きが更新されています');}else setStatus('この端末に保存済み・クラウド同期は再試行が必要です');}return false;}})();
    record.pending=work;try{return await work;}finally{if(record.pending===work)record.pending=null;}
  },[]);
  useEffect(()=>{
    if(!editor||!user){current.current=null;setStatus('');setConflict(null);return;}
    const record:RecordState={key:editor.id||'new',user,revision:0,ready:false,stopped:false,conflicted:false,remote:null,lastSaved:'',pending:null,opening:null};
    current.current=record;setConflict(null);setStatus('クラウドの下書きを確認中…');
    record.opening=(async()=>{try{
      const result=await communityApi({op:'draftGet',key:record.key},record.user);
      if(current.current!==record||record.stopped)return;
      record.remote=result.draft;record.revision=result.draft?.revision||0;
      if(result.draft){const remote=result.draft as Remote;record.lastSaved=fingerprint(remote.payload);
        if(latest.current&&fingerprint(latest.current)!==record.lastSaved&&hasContent(latest.current)){record.conflicted=true;setConflict({draft:remote});setStatus('同期済みの別の下書きがあります');return;}
        if(latest.current&&fingerprint(latest.current)!==record.lastSaved){const restored=payload(remote.payload);latest.current=restored;setEditor(restored);}
        setStatus('クラウドの下書きを復元しました');
      }else setStatus('この端末に保存・クラウドへ同期します');
      record.ready=true;setTick(n=>n+1);
    }catch{if(current.current===record&&!record.stopped)setStatus('この端末に保存済み・クラウドを確認できません');}
    finally{record.opening=null;}})();
    return()=>{record.stopped=true;clearTimeout(timer.current);};
  },[user,editor?.id,!!editor,retryKey]);
  useEffect(()=>{clearTimeout(timer.current);const record=current.current;if(!editor||!record||!record.ready||record.stopped||record.conflicted)return;if(fingerprint(editor)===record.lastSaved)return;timer.current=setTimeout(()=>{void flush();},1000);return()=>clearTimeout(timer.current);},[editor,tick,flush]);
  const resolve=useCallback((useRemote:boolean)=>{const record=current.current;if(!record||!record.conflicted)return;record.revision=record.remote?.revision||0;record.lastSaved=record.remote?fingerprint(record.remote.payload):'';record.conflicted=false;record.ready=true;setConflict(null);
    if(useRemote){if(record.remote){const restored=payload(record.remote.payload);latest.current=restored;setEditor(restored);}else{latest.current=null;removeDraft(localStorage,record.user,record.key==='new'?undefined:record.key);setEditor(null);}}
    setStatus(useRemote?'クラウドの内容を選びました':'この端末の内容を同期します');setTick(n=>n+1);
  },[setEditor]);
  const clear=useCallback(async()=>{const record=current.current;if(!record)return true;clearTimeout(timer.current);if(record.opening)await record.opening;if(record.pending)await record.pending;if(record.stopped||current.current!==record||!record.ready||record.conflicted)return false;
    try{await communityApi({op:'draftDelete',key:record.key,revision:record.revision},record.user);record.stopped=true;await onChanged();return true;}catch(e){if((e as any).status===409){record.conflicted=true;record.ready=false;record.remote=(e as any).draft||null;setConflict({draft:record.remote});setStatus('別の端末で下書きが更新されています');}return false;}
  },[onChanged]);
  return {status,conflict,flush,clear,resolve,retry:()=>setRetryKey(n=>n+1)};
}
