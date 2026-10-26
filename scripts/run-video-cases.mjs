/** Real native runs; input files are copied only into newly created conversations. */
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf('--'+name);if(i>=0&&!args[i+1])throw Error('Missing '+name);return i<0?fallback:args[i+1];};
const config=JSON.parse(await readFile(resolve(option('config',join(root,'config.local.json'))),'utf8'));
const input=resolve(option('inputs','data/video-inputs'));
const catalog=JSON.parse(await readFile(resolve(option('cases',join(root,'examples/video-cases.json'))),'utf8'));
if(catalog.version!==1)throw Error('Unsupported catalog');
const cases=catalog.cases.filter(c=>!option('ids')||option('ids').split(',').includes(c.id));
if(!cases.length||cases.some(c=>!/^\w[\w-]*$/.test(c.id)||typeof c.prompt!=='string'))throw Error('Invalid cases');
const names=['shot-a.mp4','shot-b.mp4','shot-c.mp4','beat.wav'];
for(const name of names)await readFile(join(input,name));
const token=(await readFile(join(config.dataDir,'access.token'),'utf8')).trim();
const base=option('url',`http://${config.host}:${config.port}`);
async function api(path,body){const r=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{'x-studio-token':token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});const d=await r.json();if(!r.ok)throw Error(d.error||r.status);return d;}
const runId=randomUUID(),output=join(config.dataDir,'video-runs',runId);
await mkdir(output,{recursive:true,mode:0o700});
const report={runId,started:new Date().toISOString(),image:config.image,cases:[]};
const persist=()=>writeFile(join(output,'summary.json'),JSON.stringify(report,null,2),{mode:0o600});
console.log(JSON.stringify({runId,output}));await persist();
for(const item of cases){
  const {id:conversation}=await api('conversations',{});
  for(const target of ['claude','codex','hermes','dsh'])for(const name of names)await copyFile(join(input,name),join(config.dataDir,'conversations',conversation,target,'workspace',name));
  const prompt=item.prompt+'\n工作区已提供 shot-a.mp4、shot-b.mp4、shot-c.mp4 和 beat.wav。它们是合成测试素材。请直接使用本地 ffmpeg/Python 制作，不下载外部素材。设计有吸引力的色彩、标题和转场；可以把测试图案作为视觉素材的一部分，但不声称它是真实产品拍摄。最终成片必须命名为 output.mp4，放在工作区根目录。保留可复现编辑脚本和时间表。';
  let job=await api('run',{conversation,targets:['claude','codex','hermes','dsh'],prompt});
  const entry={id:item.id,conversation,job:job.id,checks:item.checks,lanes:{}};report.cases.push(entry);await persist();console.log(JSON.stringify({case:item.id,conversation,job:job.id}));
  while(job.running){await new Promise(r=>setTimeout(r,3000));job=await api('job?id='+job.id);}
  const dir=join(output,item.id);await mkdir(dir,{mode:0o700});
  for(const [kind,state]of Object.entries(job.lanes)){
    const lane=entry.lanes[kind]={status:state.status,requests:state.requests,error:state.error||null};
    try{
      const preview=await api('preview',{conversation,target:kind,path:'output.mp4'});
      if(!/^\/artifact\/[a-f0-9]{48}$/.test(preview.src))throw Error('Invalid snapshot');
      const res=await fetch(base+preview.src,{signal:AbortSignal.timeout(30000)});if(!res.ok)throw Error('Snapshot unavailable');
      await writeFile(join(dir,kind+'.mp4'),new Uint8Array(await res.arrayBuffer()),{mode:0o600});lane.snapshot=true;
    }catch(error){lane.snapshot=false;lane.artifactError=error.message;}
  }
  await persist();console.log(JSON.stringify(entry));
}
report.finished=new Date().toISOString();await persist();console.log(JSON.stringify({finished:true,runId}));
