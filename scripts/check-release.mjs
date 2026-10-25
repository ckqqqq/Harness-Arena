import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {dirname,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
/** Scan the actual Git candidate set, including tracked files that are now ignored. */
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const listed=spawnSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'});
if(listed.status!==0)throw new Error('Initialize the Git repository before running the release check');
const files=[...new Set(listed.stdout.split('\0').filter(Boolean))],problems=[];
for(const file of files){
  if(/^(data|private|vendor|host-home|python-runtimes|test-results)\//.test(file)||/\.(key|pem|token|log)$/.test(file)||['.env','config.local.json','studio.overlay.json'].includes(basename(file)))problems.push(file+': private/runtime file');
  const content=await readFile(join(root,file));
  if(content.includes(0))continue;
  const text=content.toString('utf8');
  for(const [label,pattern]of [
    ['API key',/\bsk-[A-Za-z0-9_-]{24,}/],
    ['GitHub token',/\b(?:gh[pousr]_[A-Za-z0-9]{24,}|github_pat_[A-Za-z0-9_]{30,})/],
    ['embedded access code',/#access=[a-f0-9]{32,}/],
    ['personal Windows path',/[A-Z]:[\\/]Users[\\/][A-Za-z0-9_.-]+[\\/]/],
    ['personal Linux path',/\/home\/(?!agent\/|USER\/)[A-Za-z0-9_.-]+\//],
    ['LAN deployment address',/\b192\.168\.\d{1,3}\.\d{1,3}\b/],
  ])if(pattern.test(text))problems.push(file+': '+label);
  if(/\.(mjs|js)$/.test(file)){const result=spawnSync(process.execPath,['--check',join(root,file)],{encoding:'utf8'});if(result.status!==0)problems.push(file+': syntax error');}
}
if(problems.length){console.error(problems.join('\n'));process.exitCode=1;}else console.log(`Release check passed (${files.length} source files; no runtime data or recognized credentials).`);
