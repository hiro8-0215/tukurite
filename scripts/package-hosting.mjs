import {mkdir,cp,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
// Keep the Vite frontend and the existing EAS project. Add only the public recipe route.
const root=path.resolve('hosting');
if(path.dirname(root)!==process.cwd()||path.basename(root)!=='hosting')throw Error('Unexpected output directory');
await rm(root,{recursive:true,force:true});
await mkdir('hosting/server/_expo/functions',{recursive:true});
await cp('dist','hosting/client',{recursive:true});
await cp('dist/index.html','hosting/server/index.html');
await cp('server/share.cjs','hosting/server/_expo/functions/share.js');
await writeFile('hosting/server/_expo/routes.json',JSON.stringify({
 apiRoutes:[{file:'_expo/functions/share.js',page:'/r/[id]',namedRegex:'^/r/(?<id>[\\w-]{1,100})/?$',routeKeys:{id:'id'},methods:['GET']}],
 htmlRoutes:[{file:'index.html',page:'/index',namedRegex:'^/(?:index\\.html)?$',routeKeys:{}}],
 notFoundRoutes:[],redirects:[],rewrites:[]
},null,2));
console.log('Packaged Vite assets and public recipe /r/:id HTML route for Expo Hosting');
