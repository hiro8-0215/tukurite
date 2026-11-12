export type MealItem={id:string;plan_day:string;slot:string;servings:number;snapshot:{title:string;ingredients:string;servings:number;steps?:string;sourceRecipe?:string;authorName?:string;sourceUrl?:string}};
export type ShoppingItem={key:string;name:string;unit:string;quantity:number|null;notes:string[];recipes:string[]};
const normalize=(s:string)=>s.replace(/([0-9０-９])([½¼¾⅓⅔⅛⅜⅝⅞])/g,(_,whole,fraction)=>whole+'と'+fraction).normalize('NFKC').replace(/⁄/g,'/').replace(/(\d)\s+(\d+\/\d+)/g,'$1と$2').trim();
export const japanDate=(date=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(date);
export function shiftDate(day:string,offset:number){const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);}
export function weekStart(day=japanDate()){const d=new Date(day+'T00:00:00Z');return shiftDate(day,-((d.getUTCDay()+6)%7));}
export function formatQuantity(n:number){return String(Number(n.toFixed(2)));}
export function ingredientAmount(line:string):{name:string;quantity:number|null;unit:string;note:string}{
  const value=normalize(line).replace(/^[-・●]\s*/,''),number='(?:\\d+と\\d+\\/\\d+|\\d+(?:\\.\\d+)?(?:\\/\\d+(?:\\.\\d+)?)?)';
  const uncertain=()=>{const match=value.match(/^(.+?)\s+(適量|少々|お好み|[\d./〜～~-]+.*)$/);return {name:(match?.[1]||value).trim(),quantity:null,unit:'',note:match?.[2]||'分量を確認'};};
  if(/\d\s*[〜～~−-]\s*\d/.test(value)||/\s[-−]\s*\d/.test(value))return uncertain();
  const units='kg|g|ml|mL|cc|L|l|カップ|パック|切れ|かけ|個|本|枚|丁|袋|缶|片|束|株|房|尾|匹|粒|玉|合|杯|つ|人分';
  const trailing=value.match(new RegExp('^(.+?)\\s*('+number+')\\s*('+units+')?$'));
  const spoon=value.match(new RegExp('^(.+?)\\s*(大さじ|小さじ)\\s*('+number+')$'));
  const leading=value.match(new RegExp('^('+number+')\\s*('+units+')\\s+(.+)$'));
  let name='',unit='',raw='';
  if(spoon){name=spoon[1];unit=spoon[2];raw=spoon[3];}
  else if(trailing){name=trailing[1];raw=trailing[2];unit=trailing[3]||'';}
  else if(leading){raw=leading[1];unit=leading[2];name=leading[3];}
  if(raw){if(/[\d./、,〜～~と+−-]$/.test(name.trim()))return uncertain();const mixed=raw.match(/^(\d+)と(\d+)\/(\d+)$/),parts=raw.split('/').map(Number);let quantity=mixed?Number(mixed[1])+Number(mixed[2])/Number(mixed[3]):parts.length===2?parts[0]/parts[1]:parts[0];if(Number.isFinite(quantity)&&quantity>=0){if(unit==='kg'){unit='g';quantity*=1000;}if(unit==='L'||unit==='l'){unit='ml';quantity*=1000;}if(unit==='mL'||unit==='cc')unit='ml';return {name:name.trim(),quantity,unit,note:''};}}
  return uncertain();
}
export function shoppingList(meals:MealItem[]):ShoppingItem[]{
  const items=new Map<string,ShoppingItem>();
  for(const meal of meals){const base=meal.snapshot.servings;const factor=Number.isFinite(base)&&base>0?meal.servings/base:1;
    for(const line of meal.snapshot.ingredients.split('\n').filter(x=>x.trim())){const parsed=ingredientAmount(line);const name=normalize(parsed.name);const key=(name.toLowerCase()+'|'+parsed.unit+(parsed.quantity===null?'|note':'')).slice(0,200);const old=items.get(key)||{key,name,unit:parsed.unit,quantity:parsed.quantity===null?null:0,notes:[],recipes:[]};
      if(parsed.quantity!==null)old.quantity=(old.quantity||0)+parsed.quantity*factor;else{const note=parsed.note+(factor!==1?`（${formatQuantity(factor)}倍を目安に調整）`:'');if(!old.notes.includes(note))old.notes.push(note);}
      if(!old.recipes.includes(meal.snapshot.title))old.recipes.push(meal.snapshot.title);items.set(key,old);
    }
  }return [...items.values()].sort((a,b)=>a.name.localeCompare(b.name,'ja'));
}
export function shoppingAmount(item:ShoppingItem){if(item.quantity===null)return item.notes.join(' / ');const q=formatQuantity(item.quantity);return ['大さじ','小さじ'].includes(item.unit)?item.unit+q:q+item.unit;}
