import {readFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {validateConfiguration} from '../src/configuration.mjs';
import {launchHelp,parseLaunchOptions,validatePatches,patchArguments} from './launch-options.mjs';
const options=parseLaunchOptions(process.argv.slice(2));
if(options.help){console.log(launchHelp);process.exit(0);}
if(process.platform!=='linux')throw new Error('The execution host requires Linux with Docker; use WSL2 or a Linux server.');
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const config=validateConfiguration(JSON.parse(await readFile(join(root,'config.local.json'),'utf8')),{requireHostPort:true});
await validatePatches(options.patches);
const env={...process.env,PATH:join(config.nodeDir,'bin')+':'+process.env.PATH,DSH_HOME:join(root,'host-home')};
delete env.DEEPSEEK_API_KEY;
const child=spawn(join(config.nodeDir,'bin/node'),['--import',join(config.dshDir,'node_modules/tsx/dist/esm/index.mjs'),join(config.dshDir,'apps/cli/src/bin.ts'),'--profile','web',...patchArguments(join(root,'studio.overlay.json'),options.patches),'--host','127.0.0.1','--port',String(config.hostPort),'--no-open'],{cwd:config.dshDir,env,stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('close',(code,signal)=>{process.exitCode=code??(signal?1:0);});
