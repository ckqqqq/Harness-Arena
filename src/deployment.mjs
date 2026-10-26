import {lstat,realpath,readlink,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,dirname,basename,join,relative,isAbsolute} from 'node:path';
/** Resolve existing symlinks even when the final key/seed path is not created yet. */
export async function canonicalPath(path,links=0){
  if(links>40)throw new Error('Too many symbolic links in deployment path');
  let current=resolve(path);const suffix=[];
  while(true){try{return resolve(await realpath(current),...suffix);}catch(error){if(error.code!=='ENOENT')throw error;let info;try{info=await lstat(current);}catch(missing){if(missing.code!=='ENOENT')throw missing;}if(info?.isSymbolicLink())return canonicalPath(resolve(dirname(current),await readlink(current),...suffix),links+1);const parent=dirname(current);if(parent===current)throw error;suffix.unshift(basename(current));current=parent;}}
}
const contains=(root,path)=>{const rel=relative(root,path);return rel===''||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('../')&&!rel.startsWith('..\\'));};
const runtimeMounts=config=>[config.nodeDir,config.dshDir,join(config.pluginDir,'vendor'),config.pythonDir];
export async function assertDataIsolation(config){
  const data=await canonicalPath(config.dataDir);
  for(const mount of runtimeMounts(config)){const runtime=await canonicalPath(mount);if(contains(runtime,data)||contains(data,runtime))throw new Error('dataDir must not overlap container runtime mount directories');}
}
export async function assertKeyIsolation(config){
  const key=await canonicalPath(config.keyFile);
  const mounts=[...runtimeMounts(config),join(config.dataDir,'seed'),join(config.dataDir,'conversations')];
  for(const mount of mounts)if(contains(await canonicalPath(mount),key))throw new Error('keyFile resolves inside a container runtime or workspace mount');
}
export async function assertPrivateKeyFile(path){
  const info=await lstat(path);if(!info.isFile()||!info.size)throw new Error('keyFile must be a nonempty regular file');
  if(process.platform!=='win32'&&((info.mode&0o077)!==0||typeof process.getuid==='function'&&info.uid!==process.getuid()))throw new Error('keyFile must be owned by the current user and inaccessible to group/others');
  await access(path,constants.R_OK);
}
