export class CommunityError extends Error { status:number;details:Record<string,unknown>;constructor(message:string,status=400,details:Record<string,unknown>={}){super(message);this.status=status;this.details=details;} }
const fail=(message:string,status=400):never=>{throw new CommunityError(message,status);};
const field=(value:unknown,max:number,required=false)=>{if(typeof value!=='string'||value.length>max)fail('入力内容の長さ・形式を確認してください。');const s=(value as string).trim();if(required&&!s)fail('必要な項目を入力してください。');return s;};
const ident=(value:unknown)=>{const s=field(value,100,true);if(!/^[\w-]+$/.test(s))fail('IDを確認してください。');return s;};
const integer=(value:unknown,min:number,max:number)=>{if(!Number.isInteger(value)||Number(value)<min||Number(value)>max)fail('人数や数値を確認してください。');return Number(value);};
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
function dateValue(value:unknown){const s=field(value,10,true);const d=new Date(s+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(+d)||d.toISOString().slice(0,10)!==s)fail('日付を確認してください。');if(Math.abs(+d-+new Date(today()+'T00:00:00Z'))>370*86400000)fail('日付は前後1年以内で選んでください。');return s;}
// Serialized JSON parameters are cast through text so postgres.js does not encode them twice as jsonb.
function draftPayload(value:any,key:string){
  if(!value||typeof value!=='object'||Array.isArray(value))fail('下書きを確認してください。');
  const r={title:field(value.title,100),description:field(value.description,600),ingredients:field(value.ingredients,6000),steps:field(value.steps,10000),category:field(value.category,20),minutes:integer(value.minutes,0,1440),servings:integer(value.servings,0,100),image:field(value.image||'none',150),...(key==='new'?{}:{id:key,version:Number.isInteger(value.version)&&value.version>=0?value.version:0})};
  return r;
}
export function communityService(sql:any){
  const transaction=(fn:(tx:any)=>Promise<any>)=>sql.begin(async(tx:any)=>{await tx`select pg_advisory_xact_lock(715224)`;return fn(tx);});
  async function visibleRecipe(tx:any,id:string,user:string){const [r]=await tx`select r.*,m.name as author_name from recipes r join members m on m.id=r.owner where r.id=${id} and (r.status='published' or r.owner=${user})`;if(!r)fail('利用できる原本が見つかりません。',404);return r;}
  async function notice(tx:any,recipient:string,actor:string,kind:string,key:string,recipe:string|null=null,post:string|null=null){if(recipient===actor||recipient.startsWith('sample-'))return;await tx`insert into notifications(recipient,actor,kind,entity_key,recipe,post) values(${recipient},${actor},${kind},${key},${recipe},${post}::uuid) on conflict(recipient,kind,entity_key) do nothing`;}
  async function publicPost(tx:any,id:string){const [post]=await tx`select p.*,r.owner as author from cook_posts p join recipes r on r.id=p.recipe where p.id=${id}::uuid and p.status='published' and r.status='published'`;if(!post)fail('公開中の投稿が見つかりません。',404);return post;}
  async function photoOwned(tx:any,photo:string,user:string){if(!await tx`select id from photos where id=${photo} and owner=${user}`.then((r:any)=>r.length))fail('自分がアップロードした写真を選んでください。');}
  async function currentDraft(tx:any,user:string,key:string){const [row]=await tx`select payload,revision::int,updated_at from recipe_drafts where owner=${user} and draft_key=${key}`;return row||null;}
  return async function handle(req:Request,user:string){
    if(!await sql`select id from members where id=${user}`.then((r:any)=>r.length))fail('アプリを読み込んでから操作してください。');
    const url=new URL(req.url);
    if(url.searchParams.has('expectedUser')&&url.searchParams.get('expectedUser')!==user)fail('ログインするアカウントが変わりました。再読み込みしてください。',409);
    if(req.method==='GET'){
      const week=dateValue(url.searchParams.get('week')||today());
      const [following,authors,posts,notifications,unread,drafts,variants,meals,checks]=await Promise.all([
        sql`select following from follows where follower=${user} order by created_at desc limit 500`,
        sql`select m.id,m.name,m.bio,(m.id like 'sample-%') as sample,(select count(*)::int from recipes r where r.owner=m.id and r.status='published') as recipe_count,(select count(*)::int from follows f where f.following=m.id) as followers from members m where exists(select 1 from recipes r where r.owner=m.id and r.status='published') or exists(select 1 from cook_posts p join recipes r on r.id=p.recipe where p.owner=m.id and p.status='published' and r.status='published') order by m.name limit 500`,
        sql`select p.id,p.owner,p.recipe,p.photo,p.caption,p.day,p.created_at,p.sample,m.name as owner_name,r.title as recipe_title,r.owner as author_id,a.name as author_name,(select count(*)::int from cook_comments c where c.post=p.id and c.status='published') as comment_count from cook_posts p join members m on m.id=p.owner join recipes r on r.id=p.recipe join members a on a.id=r.owner where p.status='published' and r.status='published' order by p.created_at desc limit 50`,
        sql`select n.id,n.actor,n.kind,n.recipe,n.post,n.read_at,n.created_at,m.name as actor_name,case when r.status='published' or r.owner=${user} then r.title else null end as recipe_title from notifications n join members m on m.id=n.actor left join recipes r on r.id=n.recipe where n.recipient=${user} order by n.created_at desc limit 100`,
        sql`select count(*)::int as count from notifications where recipient=${user} and read_at is null`,
        sql`select draft_key,revision::int,updated_at,payload->>'title' as title from recipe_drafts where owner=${user} order by updated_at desc limit 50`,
        sql`select v.id,v.source_recipe,v.source_version,v.payload,v.preferences,v.created_at,r.title as source_title,r.status as source_status,m.name as author_name from recipe_variants v join recipes r on r.id=v.source_recipe join members m on m.id=r.owner where v.owner=${user} order by v.created_at desc limit 200`,
        sql`select id,plan_day::text,slot,source_kind,source_id,snapshot,servings from meal_plan_items where owner=${user} and plan_day>=${week}::date and plan_day<${week}::date+7 order by plan_day,case slot when '朝' then 1 when '昼' then 2 else 3 end,created_at`,
        sql`select item_key from shopping_checks where owner=${user} and week=${week}::date and checked`
      ]);
      return {following:following.map((f:any)=>f.following),authors,posts,notifications,unread:unread[0].count,drafts,variants,meals,checks:checks.map((c:any)=>c.item_key),week};
    }
    if(req.method!=='POST')fail('対応していない操作です。',405);
    const raw=await req.text();if(raw.length>40000)fail('入力内容が大きすぎます。',413);
    let b:any;try{b=JSON.parse(raw);}catch{fail('入力形式を確認してください。');}
    if(!b||typeof b!=='object'||Array.isArray(b))fail('入力形式を確認してください。');
    if(b.expectedUser!==undefined&&b.expectedUser!==user)fail('ログインするアカウントが変わりました。再読み込みしてください。',409);
    if(b.op==='export'){const [following,posts,comments,drafts,variants,meals,checks]=await Promise.all([sql`select following,created_at from follows where follower=${user}`,sql`select * from cook_posts where owner=${user}`,sql`select * from cook_comments where owner=${user}`,sql`select draft_key,payload,revision::int,updated_at from recipe_drafts where owner=${user}`,sql`select * from recipe_variants where owner=${user}`,sql`select * from meal_plan_items where owner=${user}`,sql`select * from shopping_checks where owner=${user}`]);return {following,posts,comments,drafts,variants,meals,checks};}
    if(b.op==='post'){const p=await publicPost(sql,ident(b.post));const [post]=await sql`select p.id,p.owner,p.recipe,p.photo,p.caption,p.day,p.created_at,p.sample,m.name as owner_name,r.title as recipe_title,r.owner as author_id,a.name as author_name,(select count(*)::int from cook_comments c where c.post=p.id and c.status='published') as comment_count from cook_posts p join members m on m.id=p.owner join recipes r on r.id=p.recipe join members a on a.id=r.owner where p.id=${p.id}::uuid`;return {post};}
    if(b.op==='follow')return transaction(async(tx:any)=>{
      const target=ident(b.author);if(target===user)fail('自分自身はフォローできません。');
      if(b.follow===false){await tx`delete from follows where follower=${user} and following=${target}`;return {ok:true,following:false};}
      const [author]=await tx`select id from members m where id=${target} and (exists(select 1 from recipes r where r.owner=m.id and r.status='published') or exists(select 1 from cook_posts p join recipes r on r.id=p.recipe where p.owner=m.id and p.status='published' and r.status='published'))`;
      if(!author)fail('公開中の作者を選んでください。',404);
      const [count]=await tx`select count(*)::int as n from follows where follower=${user}`;if(count.n>=500)fail('フォローは500人までです。');
      const rows=await tx`insert into follows(follower,following) values(${user},${target}) on conflict do nothing returning following`;
      if(rows.length)await notice(tx,target,user,'follow',user);
      return {ok:true,following:true};
    });
    if(b.op==='readNotifications'){const id=b.id?ident(b.id):null;if(id)await sql`update notifications set read_at=coalesce(read_at,now()) where id=${id}::uuid and recipient=${user}`;else await sql`update notifications set read_at=coalesce(read_at,now()) where recipient=${user}`;return {ok:true};}
    if(b.op==='cook')return transaction(async(tx:any)=>{
      if(b.confirmCooked!==true)fail('実際に作ったことを確認してください。');
      const r=await visibleRecipe(tx,ident(b.recipe),user);if(r.status!=='published')fail('公開中の原本を選んでください。');
      const day=today(),photo=b.photo?ident(b.photo):null,caption=field(b.caption||'',1000);
      if(photo&&b.photoConsent!==true)fail('写真・感想をアプリ内で公開することを確認してください。');
      if(photo)await photoOwned(tx,photo,user);
      const [existing]=await tx`select id from events where "user"=${user} and recipe=${r.id} and kind='cook' and day=${day}`;
      if(!existing){const [count]=await tx`select count(*)::int as n from events where "user"=${user} and kind='cook' and day=${day}`;if(count.n>=10)fail('調理報告は1日10件までです。',429);await tx`insert into events(id,"user",recipe,kind,period,day,eligible,created) values(${crypto.randomUUID()},${user},${r.id},'cook',${day.slice(0,7)},${day},${r.owner!==user&&!r.sample?1:0},${new Date().toISOString()})`;}
      let post=null;
      if(photo){const [already]=await tx`select id from cook_posts where owner=${user} and recipe=${r.id} and day=${day}::date`;if(already)fail('今日はこのレシピの写真を投稿済みです。次の投稿は明日できます。',409);[post]=await tx`insert into cook_posts(owner,recipe,photo,caption,day) values(${user},${r.id},${photo},${caption},${day}::date) returning id`;}
      if((photo||!existing)&&!r.sample)await notice(tx,r.owner,user,'cook',photo?'photo:'+post.id:`cook:${r.id}:${user}:${day}`,r.id,post?.id||null);
      return {ok:true,already:!!existing,post:post?.id||null,eligible:r.owner!==user&&!r.sample};
    });
    if(b.op==='archiveCook')return transaction(async(tx:any)=>{const result=await tx`update cook_posts set status='archived' where id=${ident(b.id)}::uuid and owner=${user} returning id`;if(!result.length)fail('自分の写真投稿を選んでください。',404);return {ok:true};});
    if(b.op==='comments'){const post=await publicPost(sql,ident(b.post));const rows=await sql`select c.id,c.owner,c.body,c.created_at,m.name as owner_name from cook_comments c join members m on m.id=c.owner where c.post=${post.id} and c.status='published' order by c.created_at desc limit 100`;return {comments:[...rows].reverse(),author:post.author};}
    if(b.op==='comment')return transaction(async(tx:any)=>{const post=await publicPost(tx,ident(b.post)),body=field(b.body,400,true);const [count]=await tx`select count(*)::int as n from cook_comments where owner=${user} and created_at>now()-interval '1 hour'`;if(count.n>=20)fail('コメントは1時間20件までです。',429);const [c]=await tx`insert into cook_comments(post,owner,body) values(${post.id},${user},${body}) returning id`;for(const recipient of new Set([post.owner,post.author]))await notice(tx,recipient as string,user,'comment',c.id,post.recipe,post.id);return {ok:true};});
    if(b.op==='archiveComment'){const result=await sql`update cook_comments set status='archived' where id=${ident(b.id)}::uuid and owner=${user} returning id`;if(!result.length)fail('自分のコメントを選んでください。',404);return {ok:true};}
    if(b.op==='reportPost'){const post=await publicPost(sql,ident(b.post));await sql`insert into reports(id,"user",recipe,reason,created) values(${crypto.randomUUID()},${user},${post.recipe},${'[作った投稿:'+post.id+'] '+field(b.reason,1200,true)},${new Date().toISOString()})`;return {ok:true};}
    if(['draftGet','draftPut','draftDelete'].includes(b.op))return transaction(async(tx:any)=>{
      const key=b.key==='new'?'new':ident(b.key);if(key!=='new'){const [r]=await tx`select id from recipes where id=${key} and owner=${user} and sample=0`;if(!r)fail('自分の原本の下書きを選んでください。',404);}
      const current=await currentDraft(tx,user,key);if(b.op==='draftGet')return {draft:current};
      const revision=integer(b.revision,0,Number.MAX_SAFE_INTEGER);
      if(revision!==(current?.revision||0))throw new CommunityError('別の端末で下書きが更新されました。どちらを使うか選んでください。',409,{conflict:true,draft:current});
      if(b.op==='draftDelete'){if(current)await tx`delete from recipe_drafts where owner=${user} and draft_key=${key} and revision=${revision}`;return {ok:true};}
      const payload=draftPayload(b.payload,key);if(payload.image.startsWith('photo:'))await photoOwned(tx,payload.image.slice(6),user);else if(payload.image!=='none')fail('写真の指定を確認してください。');
      if(!current){const [count]=await tx`select count(*)::int as n from recipe_drafts where owner=${user}`;if(count.n>=50)fail('同期できる下書きは50件までです。');}
      const [saved]=await tx`insert into recipe_drafts(owner,draft_key,payload) values(${user},${key},${JSON.stringify(payload)}::text::jsonb) on conflict(owner,draft_key) do update set payload=excluded.payload,revision=nextval('public.recipe_draft_revision_seq'),updated_at=now() returning payload,revision::int,updated_at`;
      return {ok:true,draft:saved};
    });
    if(b.op==='variantSave')return transaction(async(tx:any)=>{
      const source=await visibleRecipe(tx,ident(b.sourceRecipe),user);const payload=draftPayload({...b.payload,image:'none'},'new');if(!payload.title||!payload.ingredients||!payload.steps||payload.servings<1)fail('アレンジの内容を確認してください。');
      if(b.sourceVersion!==source.version||b.sourceHash!==source.hash)fail('原本が更新されました。最新の原本からアレンジを作り直してください。',409);
      const [count]=await tx`select count(*)::int as n from recipe_variants where owner=${user}`;if(count.n>=200)fail('自分用アレンジは200件までです。');
      const [row]=await tx`insert into recipe_variants(owner,source_recipe,source_version,source_hash,payload,preferences) values(${user},${source.id},${source.version},${source.hash},${JSON.stringify(payload)}::text::jsonb,${field(b.preferences||'',1000)}) returning id`;
      return {ok:true,id:row.id};
    });
    if(b.op==='variantDelete'){await sql`delete from recipe_variants where id=${ident(b.id)}::uuid and owner=${user}`;return {ok:true};}
    if(b.op==='planAdd')return transaction(async(tx:any)=>{
      const day=dateValue(b.day),slot=field(b.slot,1,true),id=ident(b.sourceId),kind=field(b.kind,10,true),servings=integer(b.servings,1,100);if(!['朝','昼','夜'].includes(slot))fail('朝・昼・夜から選んでください。');
      let snapshot:any;
      if(kind==='recipe'){const r=await visibleRecipe(tx,id,user);if(!await tx`select id from shelves where "user"=${user} and recipe=${r.id}`.then((rows:any)=>rows.length))fail('先にレシピを棚へ保存してください。');snapshot={title:r.title,ingredients:r.ingredients,steps:r.steps,servings:r.servings,sourceRecipe:r.id,authorName:r.author_name};}
      else if(kind==='shelf'){const [r]=await tx`select title,ingredients,steps,url from shelves where id=${id} and "user"=${user} and recipe is null`;if(!r)fail('自分の外部メモを選んでください。',404);snapshot={...r,servings:integer(b.baseServings,1,100),sourceUrl:r.url};}
      else if(kind==='variant'){const [r]=await tx`select v.payload,v.source_recipe,m.name as author_name from recipe_variants v join recipes r on r.id=v.source_recipe join members m on m.id=r.owner where v.id=${id}::uuid and v.owner=${user}`;if(!r)fail('自分用アレンジを選んでください。',404);snapshot={...r.payload,sourceRecipe:r.source_recipe,authorName:r.author_name};}
      else fail('献立に使うレシピを選んでください。');
      if(!snapshot.ingredients.trim())fail('材料が入力されているレシピを選んでください。');
      const [count]=await tx`select count(*)::int as n from meal_plan_items where owner=${user} and plan_day>=${day}::date-6 and plan_day<=${day}::date+6`;if(count.n>=100)fail('この期間の献立が多すぎます。');
      const [row]=await tx`insert into meal_plan_items(owner,plan_day,slot,source_kind,source_id,snapshot,servings) values(${user},${day}::date,${slot},${kind},${id},${JSON.stringify(snapshot)}::text::jsonb,${servings}) returning id`;return {ok:true,id:row.id};
    });
    if(b.op==='planDelete'){await sql`delete from meal_plan_items where id=${ident(b.id)}::uuid and owner=${user}`;return {ok:true};}
    if(b.op==='planServings'){const rows=await sql`update meal_plan_items set servings=${integer(b.servings,1,100)} where id=${ident(b.id)}::uuid and owner=${user} returning id`;if(!rows.length)fail('自分の献立を選んでください。',404);return {ok:true};}
    if(b.op==='shoppingCheck'){const week=dateValue(b.week),key=field(b.key,200,true);if(b.checked===true)await sql`insert into shopping_checks(owner,week,item_key) values(${user},${week}::date,${key}) on conflict(owner,week,item_key) do update set checked=true`;else await sql`delete from shopping_checks where owner=${user} and week=${week}::date and item_key=${key}`;return {ok:true};}
    fail('対応していない操作です。');
  };
}
