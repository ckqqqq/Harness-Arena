import {stat,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {validateConfiguration} from '../src/configuration.mjs';
import {assertKeyIsolation,assertPrivateKeyFile,assertDataIsolation} from '../src/deployment.mjs';
/** Read-only report: never return configuration values, credential contents or command output. */
export async function inspectDeployment(config,{platform=process.platform,nodeVersion=process.versions.node,execute=promisify(execFile)}={}){
  const checks=[],add=(id,status,message)=>checks.push({id,status,message});
  try{validateConfiguration(config);add('configuration','pass','Configuration structure and limits are valid');}catch(error){add('configuration','fail',error.message);return {ok:false,checks};}
  add('host-platform',platform==='linux'?'pass':'fail','Execution hosts require Linux; Windows clients can use WSL2 or a Linux server');
  add('host-node',Number(nodeVersion.split('.')[0])>=24?'pass':'fail','The doctor requires Node 24 or newer');
  const files=[['node-runtime',join(config.nodeDir,'bin/node'),true],['dsh-entry',join(config.dshDir,'apps/cli/src/bin.ts')],['dsh-loader',join(config.dshDir,'node_modules/tsx/dist/esm/index.mjs')],['codex-cli',join(config.pluginDir,'vendor/node_modules/.bin/codex'),true],['claude-cli',join(config.pluginDir,'vendor/node_modules/.bin/claude'),true],['hermes-cli',join(config.pluginDir,'vendor/hermes-agent/.venv/bin/hermes'),true],['docker-cli',config.dockerPath,true]];
  const present=new Set();
  for(const [id,path,executable]of files){try{if(!(await stat(path)).isFile())throw new Error();await access(path,executable?constants.X_OK:constants.R_OK);present.add(id);add(id,'pass','Required runtime file is accessible');}catch{add(id,'fail','Required runtime file is missing or inaccessible');}}
  try{if(!(await stat(config.pythonDir)).isDirectory())throw new Error();add('python-runtime','pass','Dedicated Python runtime directory exists');}catch{add('python-runtime','fail','Python runtime directory is missing or inaccessible');}
  try{await assertDataIsolation(config);add('data-isolation','pass','Data and runtime mount directories are separate');}catch{add('data-isolation','fail','Data overlaps runtime mounts or cannot be safely resolved');}
  try{await assertKeyIsolation(config);add('key-isolation','pass','Resolved key location is outside runtime and workspace mounts');}catch{add('key-isolation','fail','Key location overlaps a mount or cannot be safely resolved');}
  try{await assertPrivateKeyFile(config.keyFile);add('key-file','pass','Key metadata and read access passed; contents and API validity are not checked');}catch{add('key-file','fail','Key must be a readable nonempty private regular file owned by this user');}
  const options={encoding:'utf8',timeout:10000,maxBuffer:65536};
  if(platform==='linux'&&present.has('node-runtime')){try{const {stdout}=await execute(join(config.nodeDir,'bin/node'),['--version'],options);const match=/^v(\d+)\.\d+\.\d+/.exec(stdout.trim());if(!match||Number(match[1])<24)throw new Error();add('configured-node-version','pass','Configured Node runtime supports the project');}catch{add('configured-node-version','fail','Configured Node runtime cannot execute or is older than Node 24');}}else add('configured-node-version','skip','Requires an accessible Linux Node runtime');
  let docker=false;
  if(platform==='linux'&&present.has('docker-cli')){try{const {stdout}=await execute(config.dockerPath,['version','--format','{{.Server.Version}}'],options);if(!/^\d+\./.test(stdout.trim()))throw new Error();docker=true;add('docker-daemon','pass','Docker daemon is accessible to this user');}catch{add('docker-daemon','fail','Docker daemon is unavailable to this user');}}else add('docker-daemon','skip','Requires an accessible Linux Docker CLI');
  if(docker){try{const {stdout}=await execute(config.dockerPath,['image','inspect','--format','{{.Id}}',config.image],options);if(stdout.trim()!==config.image)throw new Error();add('runtime-image','pass','Configured immutable image exists in this Docker daemon');}catch{add('runtime-image','fail','Configured immutable image is unavailable');}}else add('runtime-image','skip','Requires an accessible Docker daemon');
  return {ok:!checks.some(c=>c.status==='fail'),checks};
}
