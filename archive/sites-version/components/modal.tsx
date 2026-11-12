'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';
export function Modal({title,children,wide=false,onClose,busy=false}:{title:string;children:ReactNode;wide?:boolean;onClose:()=>void;busy?:boolean}){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;root.current?.focus();return()=>previous?.focus();},[]);
 return <div ref={root} tabIndex={-1} className="modal-backdrop" onKeyDown={e=>{if(e.key==='Escape'&&!busy){e.preventDefault();onClose();}if(e.key==='Tab'){const controls=Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],summary')||[]).filter(x=>x.offsetParent!==null);const first=controls[0],last=controls[controls.length-1];if(!first){e.preventDefault();return;}if(e.shiftKey&&(document.activeElement===first||document.activeElement===root.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===root.current)){e.preventDefault();first.focus();}}}} onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}><section role="dialog" aria-modal="true" aria-label={title} className={'modal '+(wide?'wide':'')}><div className="modal-header"><span>{title}</span><button className="icon-button" disabled={busy} onClick={onClose} aria-label="閉じる"><X size={21}/></button></div>{children}</section></div>;
}
