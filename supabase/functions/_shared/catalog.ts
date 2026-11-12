import {recipeDocument,sha256,similarity} from './model.ts';

export class CatalogError extends Error {
  status:number;details:Record<string,unknown>;
  constructor(message:string,status=400,details:Record<string,unknown>={}){super(message);this.status=status;this.details=details;}
}
const field=(v:unknown,max:number)=>{if(typeof v!=='string'||v.length>max)throw new CatalogError('入力の長さ・形式を確認してください。');return v.trim();};
const identifier=(v:unknown)=>{const s=field(v,100);if(!/^[\w-]+$/.test(s))throw new CatalogError('原本IDを確認してください。');return s;};
const number=(v:unknown,max:number)=>{if(!Number.isInteger(v)||Number(v)<1||Number(v)>max)throw new CatalogError('人数・調理時間を確認してください。');return Number(v);};
const selectRecipe=`SELECT r.*,m.name AS "authorName",m.wallet,
 (SELECT count(*) FROM events e WHERE e.recipe=r.id AND e.kind='save') AS saves,
 (SELECT count(*) FROM events e WHERE e.recipe=r.id AND e.kind='cook') AS cooks,
 v.chain_status AS "chainStatus",v.signature FROM recipes r JOIN members m ON m.id=r.owner
 LEFT JOIN versions v ON v.recipe=r.id AND v.version=r.version`;

export function catalogService(db:any){
  const rows=async(query:string,...args:unknown[])=>(await db.prepare(query).bind(...args).all()).results;
  async function recipe(user:string,id:unknown){
    const result=await rows(selectRecipe+" WHERE r.id=? AND (r.status='published' OR r.owner=?)",identifier(id),user);
    if(!result.length)throw new CatalogError('原本が見つからないか、現在は非公開です。',404);
    return {recipe:result[0]};
  }
  async function personal(user:string){
    return rows(selectRecipe+" WHERE r.owner=? OR (r.status='published' AND EXISTS(SELECT 1 FROM shelves s WHERE s.user=? AND s.recipe=r.id)) ORDER BY r.created DESC,r.id DESC",user,user);
  }
  async function recent(){return rows(selectRecipe+" WHERE r.status='published' ORDER BY r.created DESC,r.id DESC LIMIT 200");}
  async function feed(params:URLSearchParams){
    const args:unknown[]=[],where=["r.status='published'"];
    const query=(params.get('q')||'').normalize('NFKC').toLowerCase().trim();
    if(query.length>200)throw new CatalogError('検索は200文字以内にしてください。');
    for(const token of query.split(/\s+/).filter(Boolean).slice(0,12)){
      where.push("lower(r.title||' '||r.description||' '||r.ingredients||' '||m.name) LIKE ? ESCAPE '\\'");
      args.push('%'+token.replace(/[\\%_]/g,'\\$&')+'%');
    }
    if(params.get('category')&&params.get('category')!=='すべて'){where.push('r.category=?');args.push(field(params.get('category'),20));}
    if(params.get('author')){where.push('r.owner=?');args.push(identifier(params.get('author')));}
    const sorted=params.get('sort')==='saved',sort=sorted?'saves DESC,r.created DESC,r.id DESC':'r.created DESC,r.id DESC';
    if(params.get('cursor')){
      let c:any;try{c=JSON.parse(params.get('cursor')!);}catch{throw new CatalogError('一覧を更新してください。');}
      if(!c||typeof c.created!=='string'||c.created.length>40||typeof c.id!=='string'||!Number.isSafeInteger(c.saves)||c.saves<0)throw new CatalogError('一覧を更新してください。');
      identifier(c.id);
      if(sorted){where.push("((SELECT count(*) FROM events e WHERE e.recipe=r.id AND e.kind='save'),r.created,r.id)<(?,?,?)");args.push(c.saves,c.created,c.id);}
      else{where.push('(r.created,r.id)<(?,?)');args.push(c.created,c.id);}
    }
    const result=await rows(selectRecipe+' WHERE '+where.join(' AND ')+' ORDER BY '+sort+' LIMIT 41',...args);
    const items=result.slice(0,40),last=items.at(-1);
    return {recipes:items,nextCursor:result.length>40?JSON.stringify({created:last.created,id:last.id,saves:Number(last.saves)}):null};
  }
  async function exportOwn(user:string){
    const [profile,recipes,shelf,sources,versions,transfers]=await Promise.all([
      rows('SELECT id,name,bio,wallet FROM members WHERE id=?',user),rows('SELECT * FROM recipes WHERE owner=? ORDER BY created,id',user),
      rows('SELECT * FROM shelves WHERE user=? ORDER BY created,id',user),rows('SELECT * FROM sources WHERE owner=? ORDER BY created,id',user),
      rows('SELECT v.* FROM versions v JOIN recipes r ON r.id=v.recipe WHERE r.owner=? ORDER BY v.created,v.id',user),
      rows('SELECT * FROM transfers WHERE payer_user=? OR author=? ORDER BY created,id',user,user)
    ]);
    return {profile:profile[0],recipes,shelf,sources,versions,transfers};
  }
  async function publish(user:string,b:any){
    if(b.consent!==true)throw new CatalogError('公開と利用許諾を確認してください。');
    const id=b.id?identifier(b.id):crypto.randomUUID();
    const r={title:field(b.title,100),description:field(b.description,600),ingredients:field(b.ingredients,6000),steps:field(b.steps,10000),minutes:number(b.minutes,1440),servings:number(b.servings,100),category:field(b.category,20)};
    if(!r.title||!r.ingredients||!r.steps)throw new CatalogError('タイトル、材料、手順を入力してください。');
    const snapshot=recipeDocument(r),hash=await sha256(snapshot),image=field(b.image||'none',150);
    return db.transaction(async(tx:any)=>{
      const all=async(q:string,...a:unknown[])=>(await tx.prepare(q).bind(...a).all()).results;
      const run=async(q:string,...a:unknown[])=>tx.prepare(q).bind(...a).run();
      const old=b.id?(await all('SELECT * FROM recipes WHERE id=? AND owner=? AND sample=0',id,user))[0]:null;
      if(b.id&&!old)throw new CatalogError('自分の原本を選んでください。',404);
      if(old&&(!Number.isInteger(b.version)||b.version!==old.version))throw new CatalogError('別の端末で原本が更新されています。最新の版と比べてから公開してください。',409,{publicationConflict:true,current:old});
      if((await all("SELECT id FROM recipes WHERE hash=? AND status='published' AND id<>?",hash,id)).length)throw new CatalogError('同じ内容の原本が登録されています。原本を棚に追加してください。',409);
      if(!b.acknowledgeSimilarity){
        let after='',similar:any[]=[];
        for(;;){const page=await all("SELECT id,title,ingredients,steps FROM recipes WHERE status='published' AND id<>? AND id>? ORDER BY id LIMIT 500",id,after);
          similar.push(...page.filter((x:any)=>similarity(r.ingredients+r.steps,x.ingredients+x.steps)>.82).map((x:any)=>({id:x.id,title:x.title})));
          if(page.length<500||similar.length>=5)break;after=page.at(-1).id;
        }
        if(similar.length)throw new CatalogError('似た内容のレシピがあります。独自の工夫・権利を確認してください。',409,{similar:similar.slice(0,5)});
      }
      if(image.startsWith('photo:')){if(!(await all('SELECT id FROM photos WHERE id=? AND owner=?',image.slice(6),user)).length)throw new CatalogError('自分の写真を選んでください。');}
      else if(image!=='none')throw new CatalogError('自分の写真を選んでください。');
      const t=new Date().toISOString(),version=old?old.version+1:1;
      await run('INSERT INTO recipes(id,owner,title,description,ingredients,steps,minutes,servings,category,image,status,version,hash,sample,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,ingredients=excluded.ingredients,steps=excluded.steps,minutes=excluded.minutes,servings=excluded.servings,category=excluded.category,image=excluded.image,status=excluded.status,version=excluded.version,hash=excluded.hash,updated=excluded.updated',id,user,r.title,r.description,r.ingredients,r.steps,r.minutes,r.servings,r.category,image,'published',version,hash,0,old?.created||t,t);
      await run('INSERT INTO versions(id,recipe,version,hash,snapshot,created) VALUES(?,?,?,?,?,?)',crypto.randomUUID(),id,version,hash,snapshot,t);
      await run("INSERT INTO notifications(recipient,actor,kind,recipe,entity_key) SELECT follower,?,'recipe',?,? FROM follows WHERE following=? AND follower<>? ON CONFLICT(recipient,kind,entity_key) DO NOTHING",user,id,id+':'+version,user,user);
      return {ok:true,id,version};
    });
  }
  return {recipe,personal,recent,feed,exportOwn,publish};
}
