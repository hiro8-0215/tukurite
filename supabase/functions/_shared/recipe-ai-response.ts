export class RecipeAiError extends Error{
 code:string;
 constructor(code:string){super(code);this.code=code;this.name='RecipeAiError';}
}
type Generated={text?:string;candidates?:Array<{finishReason?:string}>;promptFeedback?:{blockReason?:string}};
export function generatedRecipeObject(response:Generated){
 const reason=response.candidates?.[0]?.finishReason;
 if(reason==='MAX_TOKENS')throw new RecipeAiError('ai_output_truncated');
 if(response.promptFeedback?.blockReason||reason&&['SAFETY','RECITATION','BLOCKLIST','PROHIBITED_CONTENT'].includes(reason))throw new RecipeAiError('ai_blocked');
 const text=response.text||'';
 if(!text.trim())throw new RecipeAiError('ai_empty_output');
 const start=text.indexOf('{'),end=text.lastIndexOf('}');
 try{
  if(start<0||end<=start)throw Error();
  const value=JSON.parse(text.slice(start,end+1));
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error();
  return value as Record<string,unknown>;
 }catch{throw new RecipeAiError('ai_invalid_json');}
}
export function recipeAiFailure(error:unknown,action:'compose'|'refine'|'arrange'|null){
 const raw=error instanceof Error?error.message:'';
 const status=Number((error as {status?:number})?.status||0);
 let code=error instanceof RecipeAiError?error.code:
  status===429||/RESOURCE_EXHAUSTED|quota|429/i.test(raw)?'ai_provider_limit':
  status>=500||/UNAVAILABLE|overloaded/i.test(raw)?'ai_provider_busy':
  status===400||status===401||status===403||status===404?'ai_provider_configuration':
  error instanceof SyntaxError||raw==='ai_invalid_json'?'ai_invalid_json':
  /材料と手順を作れません/.test(raw)?'ai_incomplete_recipe':'ai_failed';
 const operation=action==='refine'?'レシピの仕上げ':action==='compose'?'レシピ案の作成':action==='arrange'?'アレンジ案の作成':'レシピの抽出';
 const messages:Record<string,string>={
  ai_output_truncated:`AIの回答が途中で止まり、${operation}を完了できませんでした。入力は残っています。もう一度お試しください。`,
  ai_invalid_json:`AIの回答形式を読み取れず、${operation}を完了できませんでした。入力は残っています。もう一度お試しください。`,
  ai_empty_output:`AIから回答が届かず、${operation}を完了できませんでした。入力は残っています。もう一度お試しください。`,
  ai_provider_limit:'Geminiの利用上限に達しました。入力は残っています。時間を置いて再試行してください。',
  ai_app_limit:'無料枠保護の利用上限に達しました。入力内容は残っています。',
  ai_provider_busy:'Geminiが一時的に混み合っています。入力は残っています。少し時間を置いて再試行してください。',
  ai_provider_configuration:'AIの接続設定を確認する必要があります。入力内容は変更していません。',
  ai_blocked:`AIが回答を返さなかったため、${operation}を完了できませんでした。入力内容は変更していません。`,
  ai_incomplete_recipe:'材料や手順をまとめられませんでした。料理名・材料・手順を確認してください。入力は残っています。',
  ai_failed:action?`${operation}に失敗しました。入力は残っています。もう一度お試しください。`:'抽出できませんでした。元の本文や画像を確認して再試行してください。',
 };
 if(!messages[code])code='ai_failed';
 return {code,error:messages[code],status:code==='ai_provider_limit'||code==='ai_app_limit'?429:code==='ai_provider_busy'||code==='ai_provider_configuration'?503:code==='ai_blocked'||code==='ai_incomplete_recipe'?422:502,providerStatus:status,retryable:!['ai_app_limit','ai_provider_limit','ai_provider_configuration','ai_blocked','ai_incomplete_recipe'].includes(code)};
}
