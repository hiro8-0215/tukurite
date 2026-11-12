import React,{useEffect,useState,lazy,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {ChefHat,Eye,EyeOff,LoaderCircle} from 'lucide-react';
import type {Session} from '@supabase/supabase-js';
import {supabase,url,key} from './supabase';
import {GuestRecipe} from './components/guest-recipe';
import {RecoverForm} from './components/account-recovery';
import './style.css';
import './reliability.css';
import './experience.css';
import './community.css';
const Studio=lazy(()=>import('./studio'));

function App(){
  const [recover,setRecover]=useState(false),[authRequested,setAuthRequested]=useState(new URLSearchParams(location.search).has('auth')),[unavailable,setUnavailable]=useState(false);
  const recipeId=new URLSearchParams(location.search).get('recipe');
  async function probe(){try{const r=await fetch(url+'/functions/v1/public-recipe?health=1',{signal:AbortSignal.timeout(12000)});setUnavailable(!r.ok);return r.ok;}catch{setUnavailable(true);return false;}}
  useEffect(()=>{void probe();},[]);
  const [session,setSession]=useState<Session|null|undefined>(undefined);
  const [login,setLogin]=useState(''),[password,setPassword]=useState('');
  const [mode,setMode]=useState<'login'|'register'>('login');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[visible,setVisible]=useState(false);
  useEffect(()=>{
    supabase.auth.getSession().then(({data,error})=>{setSession(data.session);if(error)setError('ログイン状態を確認できませんでした。もう一度ログインしてください。');});
    const {data}=supabase.auth.onAuthStateChange((_event,s)=>setSession(s));
    return()=>data.subscription.unsubscribe();
  },[]);
  async function submit(e:React.FormEvent){
    e.preventDefault();if(busy)return;setBusy(true);setError('');
    try{
      if(!await probe())throw Error('サービスに接続できません。復旧まで時間を置いて再試行してください。');
      const id=login.trim().toLowerCase();
      if(!/^[a-z0-9][a-z0-9._-]{2,22}[a-z0-9]$/.test(id))throw Error('IDは4〜24文字。半角英数字で始まり・終わり、途中に . _ - を使えます。');
      if(mode==='register'){
        const r=await fetch(url+'/functions/v1/register-with-id',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({loginId:id,password})});
        const j=await r.json();
        if(!r.ok)throw Error(j.error==='rate_limited'?'登録の試行回数が上限に達しました。時間を置いて再試行してください。':j.error==='login_id_taken'?'このIDは使われています。別のIDを入力するかログインしてください。':j.error==='weak_password'?'パスワードは8文字以上にしてください。':'登録できませんでした。時間を置いて再試行してください。');
      }
      const {error}=await supabase.auth.signInWithPassword({email:id+'@users.tsukurite.app',password});
      if(error)throw Error(error.status===429?'ログインの試行回数が上限に達しました。時間を置いて再試行してください。':!error.status||error.status>=500?'ログインサービスに接続できません。時間を置いて再試行してください。':'IDまたはパスワードを確認してください。');
      setPassword('');
    }catch(e){setError(e instanceof TypeError?'通信できませんでした。接続を確認して再試行してください。':(e as Error).message);}
    finally{setBusy(false);}
  }
  if(session===undefined)return <p className="loading" role="status"><LoaderCircle className="spin"/>キッチンを準備しています…</p>;
  if(session)return <Suspense fallback={<p className="loading" role="status"><LoaderCircle className="spin"/>キッチンを準備しています…</p>}><Studio key={session.user.id}/></Suspense>;
  if(recipeId&&!authRequested)return <GuestRecipe id={recipeId} onLogin={()=>setAuthRequested(true)}/>;
  if(recover)return <main className="auth-page"><section className="auth-card"><RecoverForm onBack={()=>setRecover(false)}/></section></main>;
  return <main className="auth-page"><section className="auth-card">
    <div className="auth-brand"><ChefHat size={26}/><span>つくりて</span></div>
    <p className="eyebrow">YOUR DAILY KITCHEN</p>
    <h1>おいしい工夫を、<br/>あなたの棚へ。</h1>
    <p className="auth-intro">レシピを見つけて、保存して、作る。<br/>あなたのひらめきも、次の誰かの一皿に。</p>
    <div>{unavailable&&<div className="form-error" role="alert">現在サービスに接続できません。しばらく待ってから再試行してください。<button className="text-link" onClick={probe}>接続を再確認</button></div>}</div>
    <div className="auth-tabs" role="group" aria-label="アカウントの操作">
      {(['login','register'] as const).map(value=><button key={value} type="button" aria-pressed={mode===value} disabled={busy} onClick={()=>{setMode(value);setError('');setVisible(false);}}>{value==='login'?'ログイン':'新規登録'}</button>)}
    </div>
    <form onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy} className="plain-fieldset">
        <label htmlFor="login-id">ログインID</label>
        <input id="login-id" autoComplete="username" autoCapitalize="none" spellCheck={false} aria-describedby="id-help" value={login} onChange={e=>setLogin(e.target.value)} minLength={4} maxLength={24} required placeholder="例：my_kitchen"/>
        <p id="id-help" className="field-help">半角英数字・. _ - で4〜24文字</p>
        <label htmlFor="login-password">パスワード</label>
        <div className="password-field"><input id="login-password" type={visible?'text':'password'} autoComplete={mode==='register'?'new-password':'current-password'} aria-describedby="password-help" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} maxLength={72} required/><button type="button" aria-label={visible?'パスワードを隠す':'パスワードを表示'} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={20}/>:<Eye size={20}/>}</button></div>
        <p id="password-help" className="field-help">8文字以上。ID・パスワードは控えておいてください。</p>
        {error&&<p className="form-error" role="alert">{error}</p>}
        <button className="primary full" type="submit" disabled={busy}>{busy?<><LoaderCircle size={18} className="spin"/>処理中…</>:mode==='login'?'ログイン':'新規登録してはじめる'}</button>
      </fieldset>
    </form>
    <button className="text-link recovery-link" onClick={()=>{setPassword('');setRecover(true);}}>パスワードを忘れた方（復旧コード）</button>
    <p className="auth-note">メールアドレス・ウォレットは不要です。レシピ棚とは別のアカウントを使います。ログイン後、設定から復旧コードを発行して保管してください。</p>
    <p className="auth-demo">デモ運用中 · 課金・本番報酬はありません</p>
  </section></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
