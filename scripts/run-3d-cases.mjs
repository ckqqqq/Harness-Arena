/** Real four-harness case runner. Results and criteria stay outside model workspaces. */
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {buildModelPrompt} from '../src/model-cases.mjs';
import {inspectModel} from '../src/model.mjs';
import {parseModelCaseCatalog} from '../src/model-case-registry.mjs';
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf('--'+name);return i<0?fallback:args[i+1];};
const root=dirname(dirname(fileURLToPath(import.meta.url))),config=JSON.parse(await readFile(resolve(option('config',join(root,'config.local.json'))),'utf8'));
const cases=parseModelCaseCatalog(JSON.parse(await readFile(resolve(option('cases',join(root,'examples/3d-cases.json'))),'utf8'))).filter(c=>!option('ids')||option('ids').split(',').includes(c.id));
const previous=option('recheck')?JSON.parse(await readFile(resolve(option('recheck')),'utf8')):null;
if(!cases.length)throw new Error('No selected cases');
const runId=randomUUID(),output=join(config.dataDir,'case-runs',runId);await mkdir(output,{recursive:true,mode:0o700});
const token=(await readFile(join(config.dataDir,'access.token'),'utf8')).trim(),url=`http://${config.host}:${config.port}`,exec=promisify(execFile);
async function api(path,body){const r=await fetch(url+'/api/'+path,{method:body?'POST':'GET',headers:{'x-studio-token':token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});const d=await r.json();if(!r.ok)throw new Error(d.error||r.status);return d;}
const summary={runId,started:new Date().toISOString(),image:config.image,...previous?{recheckedFrom:previous.runId}:{},cases:[]};
async function persist(){await writeFile(join(output,'summary.json.tmp'),JSON.stringify(summary,null,2),{mode:0o600});await rename(join(output,'summary.json.tmp'),join(output,'summary.json'));}
console.log(JSON.stringify({runId,output,cases:cases.map(c=>c.id),recheck:!!previous}));
for(const item of cases){
  const saved=previous?.cases.find(c=>c.id===item.id);if(previous&&!saved)throw new Error('No prior artifact for '+item.id);
  const conversation=saved?.conversation||(await api('conversations',{})).id;let job=saved?{id:saved.job,running:false,lanes:saved.lanes}:await api('run',{conversation,targets:['claude','codex','hermes','dsh'],prompt:buildModelPrompt(item)});console.log(JSON.stringify({case:item.id,conversation,job:job.id,status:saved?'rechecking':'started'}));
  let pollFailures=0;
  while(job.running){await new Promise(r=>setTimeout(r,2000));try{job=await api('job?id='+job.id);pollFailures=0;}catch(error){if(++pollFailures>=15)throw error;}}
  const result={id:item.id,title:item.title,conversation,job:job.id,lanes:{}};const dir=join(output,item.id);await mkdir(dir,{mode:0o700});await writeFile(join(dir,'checks.json'),JSON.stringify(item.checks),{mode:0o600});
  for(const [kind,state]of Object.entries(job.lanes)){
    const lane=result.lanes[kind]={status:state.status,requests:state.requests,elapsedMs:state.elapsedMs,error:state.error||null};
    try{
      const preview=await api('preview',{conversation,target:kind,path:'model.glb'});if(!/^\/artifact\/[a-f0-9]{48}$/.test(preview.src))throw new Error('Invalid snapshot link');
      const response=await fetch(url+preview.src,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('Snapshot expired');const model=new Uint8Array(await response.arrayBuffer());
      const inspected=inspectModel(model,'model.glb');lane.admission={passed:true,nodes:inspected.nodes,meshes:inspected.meshes,triangles:inspected.renderedTriangles};await writeFile(join(dir,kind+'.glb'),model,{mode:0o600});
      await exec(config.dockerPath,['run','--rm','--read-only','--network','none','--cap-drop','ALL','--security-opt','no-new-privileges','--user',`${process.getuid()}:${process.getgid()}`,'--pids-limit','192','--memory','2g','--cpus','2','--tmpfs','/tmp:rw,size=256m,mode=1777','-e','HOME=/tmp','--mount',`type=bind,source=${join(root,'scripts')},target=/inspection,readonly`,'--mount',`type=bind,source=${dir},target=/report`,config.image,'blender','--background','--factory-startup','--disable-autoexec','-t','2','--python','/inspection/inspect-model.py','--','--input',`/report/${kind}.glb`,'--output',`/report/${kind}.json`,'--checks','/report/checks.json'],{timeout:90000,maxBuffer:1048576});
      const report=JSON.parse(await readFile(join(dir,kind+'.json'),'utf8'));lane.validation={passed:report.passed,dimensions:report.dimensions,meshes:report.meshes,materials:report.materials,triangles:report.triangles,checks:report.checks};
    }catch(error){if(!lane.admission)lane.admission={passed:false,error:error.message};else lane.validation={passed:false,error:String(error.stderr||error.message).slice(-1500)};}
  }
  summary.cases.push(result);await persist();console.log(JSON.stringify(result));
}
summary.finished=new Date().toISOString();await persist();console.log(JSON.stringify({finished:true,runId,output}));
