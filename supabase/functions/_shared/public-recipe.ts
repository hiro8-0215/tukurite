export function publicRecipeService(db:any,bucket:any){
 return async(req:Request)=>{
  const headers={'Cache-Control':'no-store','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff'};
  if(req.method==='OPTIONS')return new Response('ok',{headers});
  if(req.method!=='GET')return new Response(null,{status:405,headers});
  const url=new URL(req.url);
  if(url.searchParams.get('health')==='1'){await db.prepare('SELECT 1').first();return Response.json({ok:true},{headers});}
  const id=url.searchParams.get('id')||url.searchParams.get('photoFor')||'';
  if(!/^[\w-]{1,100}$/.test(id))return Response.json({error:'原本が見つかりません。'},{status:404,headers});
  const r=await db.prepare(`SELECT r.id,r.title,r.description,r.ingredients,r.steps,r.minutes,r.servings,r.category,r.image,r.version,r.hash,r.sample,m.name AS "authorName",v.signature,v.chain_status AS "chainStatus" FROM recipes r JOIN members m ON m.id=r.owner LEFT JOIN versions v ON v.recipe=r.id AND v.version=r.version WHERE r.id=? AND r.status='published'`).bind(id).first();
  if(!r)return Response.json({error:'原本が見つからないか、現在は非公開です。'},{status:404,headers});
  if(url.searchParams.has('photoFor')){
   if(!r.image.startsWith('photo:'))return new Response(null,{status:404,headers});
   const photo=await db.prepare('SELECT mime FROM photos WHERE id=?').bind(r.image.slice(6)).first();
   if(!photo)return new Response(null,{status:404,headers});
   const data=await bucket.get('photos/'+r.image.slice(6));if(!data)return new Response(null,{status:404,headers});
   return new Response(data.body,{headers:{...headers,'Content-Type':photo.mime}});
  }
  return Response.json({recipe:r},{headers});
 };
}
