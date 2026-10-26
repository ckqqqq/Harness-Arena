import {readFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectDeployment} from './deployment-report.mjs';
const args=process.argv.slice(2),json=args.includes('--json'),root=dirname(dirname(fileURLToPath(import.meta.url)));
const usage='Usage: npm run doctor -- [--config generated-config.json] [--json]';
if(args.includes('--help')){console.log(usage+'\nRead-only runtime, key-metadata and Docker checks. No containers or model requests are started.');}
else{
  let configPath=join(root,'config.local.json'),report;
  for(let i=0;i<args.length;i++){if(args[i]==='--json')continue;if(args[i]==='--config'&&args[i+1]&&!args[i+1].startsWith('--'))configPath=resolve(args[++i]);else{report={ok:false,checks:[{id:'arguments',status:'fail',message:usage}]};break;}}
  if(!report){let config;try{config=JSON.parse(await readFile(configPath,'utf8'));}catch{report={ok:false,checks:[{id:'configuration-file',status:'fail',message:'Cannot read generated configuration; run configure first or use --config'}]};}if(!report)report=await inspectDeployment(config);}
  if(json)console.log(JSON.stringify(report));else{for(const c of report.checks)console.log(`${c.status.toUpperCase()} ${c.id}: ${c.message}`);console.log(report.ok?'Deployment preflight passed.':'Deployment preflight found problems.');}
  process.exitCode=report.ok?0:1;
}
