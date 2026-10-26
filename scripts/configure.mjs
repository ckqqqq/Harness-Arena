import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {resolveConfig} from './config.mjs';
import {assertKeyIsolation,assertPrivateKeyFile,assertDataIsolation} from '../src/deployment.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const file=process.argv[2];
if(!file)throw new Error('Usage: npm run configure -- /absolute/path/to/your-settings.json');
const config=resolveConfig(JSON.parse(await readFile(resolve(file),'utf8')),root);
await Promise.all([access(join(config.nodeDir,'bin/node')),access(join(config.dshDir,'apps/cli/src/bin.ts')),access(config.pythonDir),access(config.dockerPath)]);
await assertDataIsolation(config);await assertKeyIsolation(config);
if(process.env.DEEPSEEK_API_KEY){const value=process.env.DEEPSEEK_API_KEY.trim();if(!value)throw new Error('DEEPSEEK_API_KEY must not be blank');await mkdir(dirname(config.keyFile),{recursive:true,mode:0o700});await assertKeyIsolation(config);await writeFile(config.keyFile,value+'\n',{mode:0o600,flag:'wx'});}
await assertPrivateKeyFile(config.keyFile);
await writeFile(join(root,'config.local.json'),JSON.stringify(config,null,2)+'\n',{mode:0o600});
await writeFile(join(root,'studio.overlay.json'),JSON.stringify([{insert:[{id:'dsh-studio',name:join(root,'src/index.mjs'),config}]}],null,2)+'\n',{mode:0o600});
console.log('Created config.local.json and studio.overlay.json. Start with npm start.');
