export function translate(query:string){
  let i=0;
  let q=query.replaceAll(/(?<!")\buser\b(?!")/g,'"user"').replaceAll("datetime('now','-30 days')","to_char(now()-interval '30 days','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')").replaceAll('?',()=>'$'+(++i));
  if(/INSERT OR IGNORE/i.test(q))q=q.replace(/INSERT OR IGNORE/i,'INSERT')+' ON CONFLICT DO NOTHING';
  return q;
}
