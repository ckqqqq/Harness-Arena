import {spawnSync} from 'node:child_process';
import {mkdir,copyFile,access} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
if(process.platform!=='linux')throw new Error('Install the runners on the Linux execution host.');
const root=dirname(dirname(fileURLToPath(import.meta.url))),vendor=join(root,'vendor');
await mkdir(vendor,{recursive:true});
await copyFile(join(root,'examples/harnesses.package.json'),join(vendor,'package.json'));
await copyFile(join(root,'examples/harnesses.package-lock.json'),join(vendor,'package-lock.json'));
function run(command,args,cwd=vendor,env=process.env){const result=spawnSync(command,args,{cwd,env,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw new Error(`${command} failed (${result.status})`);}
run('npm',['ci']);
const hermes=join(vendor,'hermes-agent');let exists=true;try{await access(hermes);}catch(error){if(error.code!=='ENOENT')throw error;exists=false;}
if(!exists)run('git',['clone','https://github.com/NousResearch/hermes-agent.git',hermes]);
run('git',['checkout','--detach','4ea8d23cc9f527332ccb1d55359b27741b6ea51b'],hermes);
run('uv',['sync','--frozen','--python','3.14','--no-dev'],hermes,{...process.env,UV_PYTHON_INSTALL_DIR:join(root,'python-runtimes')});
console.log('Harness runtimes installed under vendor/. DSH is supplied separately.');
