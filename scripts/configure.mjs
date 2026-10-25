import {readFile,writeFile,mkdir,access,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join,relative,isAbsolute} from 'node:path';
import {resolveConfig} from './config.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const file=process.argv[2];
if(!file)throw new Error('Usage: npm run configure -- /absolute/path/to/your-settings.json');
const config=resolveConfig(JSON.parse(await readFile(resolve(file),'utf8')),root);
await Promise.all([access(join(config.nodeDir,'bin/node')),access(join(config.dshDir,'apps/cli/src/bin.ts')),access(config.pythonDir),access(config.dockerPath)]);
for(const mount of [config.nodeDir,config.dshDir,join(root,'vendor'),config.pythonDir]){
  const key=relative(await realpath(mount),resolve(config.keyFile));
  if(key===''||(!key.startsWith('..')&&!isAbsolute(key)))throw new Error('keyFile must stay outside all container runtime mounts');
}
if(process.env.DEEPSEEK_API_KEY){await mkdir(dirname(config.keyFile),{recursive:true,mode:0o700});await writeFile(config.keyFile,process.env.DEEPSEEK_API_KEY.trim()+'\n',{mode:0o600,flag:'wx'});}
await access(config.keyFile);
await writeFile(join(root,'config.local.json'),JSON.stringify(config,null,2)+'\n',{mode:0o600});
await writeFile(join(root,'studio.overlay.json'),JSON.stringify([{insert:[{id:'dsh-studio',name:join(root,'src/index.mjs'),config}]}],null,2)+'\n',{mode:0o600});
console.log('Created config.local.json and studio.overlay.json. Start with npm start.');
