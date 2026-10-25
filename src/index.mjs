/** Independent DSH plugin: whiteboard UI, comparison runtime and credential-isolating relay. */
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,rename,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {randomBytes,timingSafeEqual,randomUUID} from 'node:crypto';
import {sketchInput,recognizeSketch} from './sketch.mjs';
import {StudioRuntime,harnesses} from './runtime.mjs';
import {validateLayout,initialLayout} from './layout.mjs';
import {listFiles,getFile,putFile} from './files.mjs';
import {admitModelRequest} from './budget.mjs';
import {ArtifactPreviews,listArtifacts} from './artifacts.mjs';
import {buildModelPrompt} from './model-cases.mjs';
import {ModelCaseRegistry,parseModelCaseCatalog} from './model-case-registry.mjs';
export const name='dsh-studio';
export const inject=['webServer'];
export const provide=['studioModelCases'];
const mime={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8'};
function same(a,b) {return typeof a==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
async function jsonBody(req,limit=1048576) {
  let n=0;const chunks=[];for await(const chunk of req){n+=chunk.length;if(n>limit)throw new Error('请求过大');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
}
function json(res,value,status=200) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}
async function listen(server,port,host) {await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.off('error',reject);resolve();});});}
async function close(server) {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
/** Mount this function through a DSH --patch overlay. Disposal stops all owned containers. */
export async function apply(ctx,config) {
  for(const k of ['pluginDir','dataDir','keyFile','dshDir','nodeDir','pythonDir','image','host','gatewayHost','model','sketchModel','dockerPath']) if(typeof config[k]!=='string'||!config[k]) throw new Error('dsh-studio: missing '+k);
  for(const k of ['port','gatewayPort','timeoutSeconds','maxTurns','sketchTimeoutSeconds','sketchMaxImageBytes','sketchMaxOutputTokens','artifactMaxBytes','artifactTokenSeconds'])if(!Number.isInteger(config[k])||config[k]<1)throw new Error('dsh-studio: invalid '+k);
  const key=(await readFile(config.keyFile,'utf8')).trim();if(!key)throw new Error('DeepSeek key file is empty');
  await mkdir(config.dataDir,{recursive:true,mode:0o700});
  const tokenFile=join(config.dataDir,'access.token');let access;
  try{access=(await readFile(tokenFile,'utf8')).trim();}catch(error){if(error.code!=='ENOENT')throw error;access=randomBytes(24).toString('hex');await writeFile(tokenFile,access+'\n',{mode:0o600,flag:'wx'});}
  const runtime=new StudioRuntime(config);await runtime.init();
  const previews=new ArtifactPreviews({maxBytes:config.artifactMaxBytes,ttlSeconds:config.artifactTokenSeconds,dir:join(config.dataDir,'previews')});await previews.init();
  const layoutFile=join(config.dataDir,'layout.json');let layout=initialLayout;
  try{layout=validateLayout(JSON.parse(await readFile(layoutFile,'utf8')));}catch(error){if(error.code!=='ENOENT')throw error;}
  let saveQueue=Promise.resolve();let sketchRequest=null;
  const modelCases=new ModelCaseRegistry();const builtinCases=parseModelCaseCatalog(JSON.parse(await readFile(new URL('../examples/3d-cases.json',import.meta.url),'utf8')));modelCases.register('builtin-3d',builtinCases);ctx.provide('studioModelCases',modelCases);
  const ui=createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://studio.internal'), path=url.pathname;
      if(req.method==='GET'&&/^\/artifact\/[a-f0-9]{48}$/.test(path)){await previews.serve(req,res,path.split('/').pop());return;}
      if(req.method==='GET'&&['/model-viewer.html','/model-viewer.js'].includes(path)){
        const origin=new URL('http://'+req.headers.host).origin;
        const policy=`sandbox allow-scripts; default-src 'none'; script-src ${origin}/model-viewer.js; style-src 'unsafe-inline'; connect-src ${origin}/artifact/ data: blob:; img-src data: blob:; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'`;
        res.writeHead(200,{'Content-Type':path.endsWith('.html')?mime.html:mime.js,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':policy});res.end(await readFile(new URL('./public'+path,import.meta.url)));return;
      }
      if(req.method==='GET' && ['/', '/app.js','/style.css'].includes(path)) {
        const file=path==='/'?'index.html':path.slice(1),ext=file.split('.').pop();
        const body=await readFile(new URL('./public/'+file,import.meta.url));
        res.writeHead(200,{'Content-Type':mime[ext],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; media-src 'self'; frame-src 'self'; frame-ancestors 'none'; object-src 'none'"});res.end(body);return;
      }
      if(!same(req.headers['x-studio-token'],access)){json(res,{error:'请输入访问码'},401);return;}
      if(req.method==='POST' && req.headers.origin && req.headers.origin!==`http://${req.headers.host}`){json(res,{error:'来源不允许'},403);return;}
      if(path==='/api/status'&&req.method==='GET'){json(res,{model:config.model,harnesses,mode:'原生 CLI / 独立会话 / Docker 工作区',maxTurns:config.maxTurns,timeoutSeconds:config.timeoutSeconds});return;}
      if(path==='/api/model-cases'&&req.method==='GET'){json(res,{cases:modelCases.list().map(c=>({...c,prompt:buildModelPrompt(c)}))});return;}
      if(path==='/api/model-runs'&&req.method==='GET'){
        const dir=join(config.dataDir,'case-runs');let entries=[];try{entries=await readdir(dir,{withFileTypes:true});}catch(error){if(error.code!=='ENOENT')throw error;}
        const runs=[];for(const e of entries.filter(e=>e.isDirectory()&&/^[a-f0-9-]{36}$/.test(e.name)).slice(-100)){try{runs.push(JSON.parse(await readFile(join(dir,e.name,'summary.json'),'utf8')));}catch(error){if(error.code!=='ENOENT')throw error;}}
        json(res,{runs:runs.sort((a,b)=>b.started.localeCompare(a.started)).slice(0,10)});return;
      }
      if(path==='/api/layout'&&req.method==='GET'){json(res,layout);return;}
      if(path==='/api/sketch'&&req.method==='POST'){
        if(sketchRequest){json(res,{error:'已有草图正在识别，请等待或取消'},409);return;}
        const controller=new AbortController();sketchRequest={controller,done:null};const owned=sketchRequest;
        res.on('close',()=>{if(!res.writableEnded)controller.abort();});
        owned.done=(async()=>{
          const input=sketchInput(await jsonBody(req,config.sketchMaxImageBytes*2+65536),config.sketchMaxImageBytes);
          const proposal=await recognizeSketch(input,{key,model:config.sketchModel,maxTokens:config.sketchMaxOutputTokens,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(config.sketchTimeoutSeconds*1000)])});
          const id=randomUUID(),dir=join(config.dataDir,'proposals');await mkdir(dir,{recursive:true,mode:0o700});
          await writeFile(join(dir,id+'.json'),JSON.stringify({id,created:new Date().toISOString(),input,...proposal}),{mode:0o600});
          return {id,...proposal};
        })();
        try{json(res,await owned.done);}finally{if(sketchRequest===owned)sketchRequest=null;}
        return;
      }
      if(path==='/api/layout'&&req.method==='POST'){
        const next=validateLayout(await jsonBody(req));const task=saveQueue.then(async()=>{await writeFile(layoutFile+'.tmp',JSON.stringify(next),{mode:0o600});await rename(layoutFile+'.tmp',layoutFile);layout=next;});saveQueue=task.catch(error=>ctx.logger.warn(error.message));await task;json(res,layout);return;
      }
      if(path==='/api/conversations'&&req.method==='POST'){const c=await runtime.create();json(res,{id:c.id});return;}
      if(path==='/api/conversation'&&req.method==='GET'){const c=await runtime.get(url.searchParams.get('id'));json(res,{id:c.id,lanes:Object.fromEntries(harnesses.map(k=>[k,{history:c.lanes[k].history,session:c.lanes[k].session}]))});return;}
      if(path==='/api/run'&&req.method==='POST'){const body=await jsonBody(req);const j=await runtime.start(body.conversation,body.prompt,body.targets);json(res,runtime.publicJob(j));return;}
      if(path==='/api/job'&&req.method==='GET'){const j=runtime.jobs.get(url.searchParams.get('id'));if(!j)throw new Error('运行不存在');json(res,runtime.publicJob(j));return;}
      if(path==='/api/cancel'&&req.method==='POST'){const body=await jsonBody(req),j=runtime.jobs.get(body.id);if(!j)throw new Error('运行不存在');runtime.cancel(j);json(res,{ok:true});return;}
      if(path==='/api/artifacts'&&req.method==='GET'){
        const target=url.searchParams.get('target');if(!harnesses.includes(target))throw new Error('未知工作区');
        const c=await runtime.get(url.searchParams.get('conversation')),root=join(c.lanes[target].root,'workspace');
        json(res,{items:await runtime.withWorkspaceRead(root,()=>listArtifacts(root,config.artifactMaxBytes))});return;
      }
      if(path==='/api/preview'&&req.method==='POST'){
        const body=await jsonBody(req);if(!harnesses.includes(body.target))throw new Error('未知工作区');
        const c=await runtime.get(body.conversation),root=join(c.lanes[body.target].root,'workspace');
        const src=await previews.grant(root,body.path,(dir,fn)=>runtime.withWorkspaceRead(dir,fn));json(res,{src});return;
      }
      if(['/api/files','/api/file'].includes(path)) {
        const target=url.searchParams.get('target')||'seed';let root=join(config.dataDir,'seed');
        if(target!=='seed'){if(!harnesses.includes(target))throw new Error('未知工作区');const c=await runtime.get(url.searchParams.get('conversation'));if(c.busy)throw new Error('运行结束后可浏览或编辑各栏文件');root=join(c.lanes[target].root,'workspace');}
        const filename=url.searchParams.get('path')||'';
        if(path==='/api/files'&&req.method==='GET'){json(res,{items:await listFiles(root,filename)});return;}
        if(path==='/api/file'&&req.method==='GET'){json(res,{path:filename,text:await getFile(root,filename)});return;}
        if(path==='/api/file'&&req.method==='POST'){const body=await jsonBody(req);await putFile(root,filename,body.text,body.create===true);json(res,{ok:true});return;}
      }
      json(res,{error:'接口不存在'},404);
    }catch(error){if(!res.headersSent&&!res.destroyed)json(res,{error:error.message},400);else if(!res.destroyed)res.end();}
  });
  const relay=createServer(async(req,res)=>{
    try {
      const credential=(req.headers.authorization||'').replace(/^Bearer /i,'')||req.headers['x-api-key'];
      const owner=runtime.tokens.get(credential);if(!owner){json(res,{error:'invalid ephemeral token'},401);return;}
      const path=new URL(req.url,'http://relay').pathname;
      const routes={'/responses':'/responses','/v1/responses':'/responses','/v1/chat/completions':'/chat/completions','/chat/completions':'/chat/completions','/anthropic/v1/messages':'/anthropic/v1/messages','/anthropic/v1/messages/count_tokens':'/anthropic/v1/messages/count_tokens','/messages':'/anthropic/v1/messages','/v1/messages':'/anthropic/v1/messages','/models':'/models','/v1/models':'/models'};
      const upstream=routes[path];if(!upstream){json(res,{error:'unsupported relay path: '+path},404);return;}
      let body;if(req.method==='POST') {body=await jsonBody(req,64*1024*1024);if(body.model!==config.model)throw new Error('所有栏必须使用 '+config.model);
        if(!admitModelRequest(owner.state,config.maxTurns,upstream)){
          json(res,{error:{message:owner.state.error,type:'invalid_request_error',code:'studio_budget_exhausted'}},400);
          owner.state.activity='预算已用尽，正在结束本轮并保存会话';
          if(owner.state.deniedRequests>1)runtime.kill(owner.job,owner.kind);
          return;
        }
      }
      const abort=new AbortController();res.on('close',()=>{if(!res.writableEnded)abort.abort();});
      const response=await fetch('https://api.deepseek.com'+upstream,{method:req.method,headers:{'Content-Type':'application/json','Authorization':'Bearer '+key,'x-api-key':key,...req.headers['anthropic-version']?{'anthropic-version':req.headers['anthropic-version']}:{}},body:body?JSON.stringify(body):undefined,signal:AbortSignal.any([abort.signal,AbortSignal.timeout(config.timeoutSeconds*1000)])});
      res.writeHead(response.status,{'Content-Type':response.headers.get('content-type')||'application/json','Cache-Control':'no-store'});
      for await(const chunk of response.body){if(res.destroyed)break;if(!res.write(chunk))await new Promise(resolve=>{const done=()=>{res.off('drain',done);res.off('close',done);resolve();};res.once('drain',done);res.once('close',done);});}res.end();
    }catch(error){if(!res.headersSent)json(res,{error:{message:error.message,type:'studio_relay_error'}},502);else res.end();}
  });
  try{await listen(relay,config.gatewayPort,config.gatewayHost);await listen(ui,config.port,config.host);}
  catch(error){await close(relay);await close(ui);await runtime.dispose();modelCases.close();throw error;}
  ctx.effect(()=>async()=>{if(sketchRequest){sketchRequest.controller.abort();await Promise.allSettled([sketchRequest.done]);}await runtime.dispose();await Promise.all([close(ui),close(relay)]);await previews.dispose();modelCases.close();await saveQueue;});
  ctx.logger.info('DSH studio listening at http://%s:%s',config.host,config.port);
}
