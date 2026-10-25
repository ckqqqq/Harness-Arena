/** Check repository-relative Markdown link paths; external URLs and anchors are out of scope. */
import {spawnSync} from 'node:child_process';
import {readFile,access} from 'node:fs/promises';
import {dirname,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const listed=spawnSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'});if(listed.status!==0)throw new Error('Cannot enumerate documentation');
let count=0;const failures=[];
for(const file of new Set(listed.stdout.split('\0').filter(f=>f.endsWith('.md')))){
  const text=(await readFile(resolve(root,file),'utf8')).replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm,'');
  for(const match of text.matchAll(/\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/g)){
    const target=match[1]||match[2];if(/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target))continue;
    const path=decodeURIComponent(target.split('#')[0].split('?')[0]);if(!path)continue;count++;
    const resolved=resolve(dirname(resolve(root,file)),path),rel=relative(root,resolved);
    if(rel==='..'||rel.startsWith('..\\')||rel.startsWith('../')||isAbsolute(rel)){failures.push(file+': link escapes repository: '+target);continue;}
    try{await access(resolved);}catch{failures.push(file+': missing target: '+target);}
  }
}
if(failures.length)throw new Error(failures.join('\n'));console.log(`Documentation paths passed (${count} local links; anchors not checked).`);
