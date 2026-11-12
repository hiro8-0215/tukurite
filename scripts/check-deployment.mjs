import {readFile} from 'node:fs/promises';
const expected=(await readFile('dist/index.html','utf8')).match(/\/assets\/index-[^"\s]+\.js/)?.[0];
for(const url of ['https://tsukurite-kitchen.expo.app/',...process.argv.slice(2)]){
  const r=await fetch(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)}),html=await r.text(),script=html.match(/\/assets\/index-[^"\s]+\.js/)?.[0];
  console.log(JSON.stringify({url,status:r.status,cacheControl:r.headers.get('cache-control'),age:r.headers.get('age'),script,expected,matches:script===expected}));
  if(r.status!==200||script!==expected)process.exitCode=1;
}
