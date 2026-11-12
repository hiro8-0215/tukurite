import {readFile,readdir} from 'node:fs/promises';
import ts from 'typescript';
const root='supabase/functions';
const files=[];
for(const directory of ['api','community','import-recipe','account-security','public-recipe','register-with-id','_shared'])for(const file of await readdir(root+'/'+directory)){
  if(!file.endsWith('.ts'))continue;
  const name=directory+'/'+file,content=await readFile(root+'/'+name,'utf8');
  const result=ts.transpileModule(content,{fileName:name,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
  if(result.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error))throw Error('Invalid TypeScript: '+name);
  files.push({name,content});
}
process.stdout.write(JSON.stringify(files));
