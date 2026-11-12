import type {Recipe} from './model';
import type {RecipeDraft} from '../components/recipe-suggestion';

export function matchesSearch(query:string,...values:unknown[]){
  const normalize=(value:unknown)=>String(value??'').normalize('NFKC').toLocaleLowerCase();
  const text=normalize(values.join(' '));
  return normalize(query).trim().split(/\s+/).filter(Boolean).every(term=>text.includes(term));
}
export function findRecipes(recipes:Recipe[],query:string,category:string,author:string,sort:string){
  return recipes.filter(r=>(category==='すべて'||r.category===category)&&(!author||r.owner===author)&&matchesSearch(query,r.title,r.description,r.ingredients,r.authorName))
    .sort((a,b)=>sort==='saved'?(b.saves||0)-(a.saves||0)||Date.parse(b.created)-Date.parse(a.created):Date.parse(b.created)-Date.parse(a.created));
}
export function recipeIssue(recipe:RecipeDraft){
  const missing=[!recipe.title.trim()&&'タイトル',!recipe.ingredients.trim()&&'材料・分量',!recipe.steps.trim()&&'作り方'].filter(Boolean);
  if(missing.length)return missing.join('、')+'を入力してください。';
  if(!Number.isInteger(recipe.minutes)||recipe.minutes<1||recipe.minutes>1440)return '調理時間は1〜1440分の整数にしてください。';
  if(!Number.isInteger(recipe.servings)||recipe.servings<1||recipe.servings>100)return '人数は1〜100人の整数にしてください。';
  return '';
}
export function isHttpsUrl(value:string){try{const u=new URL(value.trim());return u.protocol==='https:'&&!u.username&&!u.password&&!u.port;}catch{return false;}}
export type LocalDraft=RecipeDraft&{id?:string;version?:number;image:string};
const draftKey=(user:string,id?:string)=>`tsukurite-draft-v1:${user}:${id||'new'}`;
export function readDraft(storage:Pick<Storage,'getItem'>,user:string,id?:string):LocalDraft|null{
  try{
    const value=JSON.parse(storage.getItem(draftKey(user,id))||'null');
    if(!value||value.version!==1||!value.draft||value.draft.id!==id)return null;
    const d=value.draft;
    if(!['title','description','ingredients','steps','category','image'].every(k=>typeof d[k]==='string')||!Number.isFinite(d.minutes)||!Number.isFinite(d.servings))return null;
    return d;
  }catch{return null;}
}
export function writeDraft(storage:Pick<Storage,'setItem'>,user:string,draft:LocalDraft){
  try{storage.setItem(draftKey(user,draft.id),JSON.stringify({version:1,draft,updatedAt:new Date().toISOString()}));return true;}catch{return false;}
}
export function removeDraft(storage:Pick<Storage,'removeItem'>,user:string,id?:string){
  try{storage.removeItem(draftKey(user,id));return true;}catch{return false;}
}
