import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile,readFile,cp,appendFile,chmod,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import {StringDecoder} from 'node:string_decoder';
import {terminalStatus} from './budget.mjs';
import {readdir} from 'node:fs/promises';
export const harnesses=['claude','codex','hermes','dsh'];
/** Translate native JSONL without guessing that process exit alone means task completion. */
export function projectEvent(kind,e,state) {
  if(e.type==='status'&&e.phase==='step_start'||e.type==='tool_result'||e.type==='item.completed'&&e.item?.type==='command_execution')state.phase='generating';
  if(e.type==='tool_call'||e.type==='tool_use'||e.type==='item.started'&&e.item?.type==='command_execution')state.phase='executing';
  if(e.type==='stream_event'&&e.event?.type==='content_block_start')state.phase=e.event.content_block?.type==='tool_use'?'executing':'generating';
  if(e.session_id) state.session=e.session_id;
  if(e.sessionId) state.session=e.sessionId;
  if(e.type==='thread.started') state.session=e.thread_id;
  if(kind==='codex' && e.type==='item.completed' && e.item?.type==='agent_message') state.text=e.item.text;
  if(kind==='claude' && e.type==='assistant') state.text=(e.message?.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n');
  if(kind==='claude' && e.type==='stream_event' && e.event?.type==='content_block_delta' && e.event.delta?.type==='text_delta') state.text+=e.event.delta.text;
  if(kind==='hermes' && e.type==='text') state.text+=e.text;
  if(kind==='dsh' && e.type==='text') state.text+=e.text||e.delta||'';
  if(e.type==='final' && kind==='dsh') {state.stopReason=e.reason?.kind;if(e.reason?.kind==='max-tokens'){state.outputLimited=true;state.error='单次模型输出达到长度上限，文件和会话保留，可继续生成。';}state.text=e.text||state.text;state.final=true;state.failed=['blocked','error'].includes(e.reason?.kind);if(e.reason?.error?.message)state.error=e.reason.error.message;}
  if(e.type==='result' && kind==='claude') {state.text=e.result||state.text;state.final=true;state.failed=!!e.is_error;state.usage=e.usage||null;}
  if(e.type==='result' && kind==='hermes') {state.text=e.final_response||e.text||e.result||state.text;state.final=true;state.failed=!!e.error||!!e.exit_code;state.usage=e.usage||e.stats||null;}
  if(e.type==='turn.completed' && kind==='codex') {state.final=true;state.usage=e.usage||null;}
  if(e.type==='turn.failed'||e.type==='error') {state.failed=true;state.error=JSON.stringify(e.error||e.message||e).slice(0,1200);}
  if(e.type.includes('tool') || e.item?.type==='command_execution') state.tools++;
  const calls=kind==='claude'&&e.type==='assistant'?(e.message?.content||[]).filter(c=>c.type==='tool_use'):[];
  if(e.type==='tool_call'||e.type==='tool_use')calls.push({name:e.tool||e.name,input:e.input});
  if(kind==='codex'&&e.type==='item.started'&&e.item?.type==='command_execution')calls.push({name:'terminal',input:{description:e.item.command}});
  for(const call of calls){state.phase='executing';state.toolCalls=(state.toolCalls||0)+1;state.activity=String(call.input?.description||call.name).slice(0,160);}
}
/** Own conversations, container processes and short-lived inference credentials. */
export class StudioRuntime {
  constructor(config) {this.config=config;this.conversations=new Map();this.jobs=new Map();this.tokens=new Map();this.saves=new Map();this.readers=new Map();this.removals=new Map();this.unsafeWorkspaces=new Set();this.closed=false;}
  async init() {
    await mkdir(join(this.config.dataDir,'seed'),{recursive:true,mode:0o700});
    const run=promisify(execFile),options={env:{PATH:'/usr/bin:/bin'},timeout:10000,maxBuffer:1048576};
    const {stdout}=await run(this.config.dockerPath,['ps','-q','--filter','name=dsh-studio-'],options);
    for(const id of stdout.trim().split(/\s+/).filter(Boolean)){
      let result;try{result=await run(this.config.dockerPath,['inspect','--format','{{json .Mounts}}',id],options);}catch(error){if(/No such (object|container)/i.test(error.stderr||''))continue;throw error;}
      for(const mount of JSON.parse(result.stdout))if(mount.Destination==='/work'&&mount.RW&&mount.Source.startsWith(join(this.config.dataDir,'conversations')+'/'))this.unsafeWorkspaces.add(mount.Source);
    }
  }
  async create() {
    if(this.closed) throw new Error('插件已停止');
    const id=randomUUID(), dir=join(this.config.dataDir,'conversations',id);
    const convo={id,dir,lanes:{},busy:false};
    for(const kind of harnesses) {
      const root=join(dir,kind); await mkdir(join(root,'home'),{recursive:true,mode:0o700});
      await cp(join(this.config.dataDir,'seed'),join(root,'workspace'),{recursive:true,dereference:false});
      convo.lanes[kind]={root,session:null,history:[]};
    }
    this.conversations.set(id,convo); await this.save(convo); return convo;
  }
  async get(id) {
    if(this.conversations.has(id)) return this.conversations.get(id);
    if(!/^[a-f0-9-]{36}$/.test(id||'')) throw new Error('会话不存在');
    const dir=join(this.config.dataDir,'conversations',id), data=JSON.parse(await readFile(join(dir,'state.json'),'utf8'));
    // Roots are derived from the requested id; durable JSON cannot redirect file access.
    for(const kind of harnesses) data.lanes[kind].root=join(dir,kind);
    data.dir=dir;data.busy=false;
    // Old histories omitted errors; recover them only when saved jobs align exactly.
    const names=(await readdir(dir)).filter(n=>/^[a-f0-9-]{36}\.json$/.test(n)).slice(0,500);
    const saved=await Promise.all(names.map(n=>readFile(join(dir,n),'utf8').then(JSON.parse)));
    saved.sort((a,b)=>a.started-b.started);
    for(const kind of harnesses){const runs=saved.filter(j=>j.lanes?.[kind]);const history=data.lanes[kind].history;
      if(runs.length===history.length&&runs.every((j,i)=>j.prompt===history[i].user))history.forEach((h,i)=>{const s=runs[i].lanes[kind];h.error=s.error||null;h.requests=s.requests;h.elapsedMs=s.elapsedMs;});
    }
    this.conversations.set(id,data);return data;
  }
  workspaceBusy(root){if(this.unsafeWorkspaces.has(root))return true;for(const job of this.jobs.values())if(job.running){const c=this.conversations.get(job.conversation);for(const [kind,s]of Object.entries(job.lanes))if(join(c.lanes[kind].root,'workspace')===root&&!s.workspaceReady)return true;}return false;}
  async withWorkspaceRead(root,fn){if(this.workspaceBusy(root))throw new Error('此栏仍在生成，结束后可以查看作品');this.readers.set(root,(this.readers.get(root)||0)+1);try{return await fn();}finally{const n=this.readers.get(root)-1;if(n)this.readers.set(root,n);else this.readers.delete(root);}}
  async save(convo) {
    const previous=this.saves.get(convo.id)||Promise.resolve();
    const next=previous.then(async()=>{
      const file=join(convo.dir,'state.json'),tmp=file+'.tmp';
      await writeFile(tmp,JSON.stringify({id:convo.id,lanes:convo.lanes}),{mode:0o600});
      await rename(tmp,file);
    });
    this.saves.set(convo.id,next.catch(()=>{}));await next;
  }
  async start(id,prompt,targets=harnesses) {
    if(typeof prompt!=='string'||!prompt.trim()||Buffer.byteLength(prompt)>65536) throw new Error('输入为空或超过 64 KB');
    if(!Array.isArray(targets)||!targets.length||new Set(targets).size!==targets.length||targets.some(k=>!harnesses.includes(k))) throw new Error('未知 harness');
    const convo=await this.get(id); if(convo.busy||this.closed) throw new Error('已有运行中的请求');
    if(targets.some(k=>this.unsafeWorkspaces.has(join(convo.lanes[k].root,'workspace'))))throw new Error('此工作区仍有未清理的容器，检查 Docker 后再恢复');
    if(targets.some(k=>this.readers.has(join(convo.lanes[k].root,'workspace'))))throw new Error('正在准备作品预览，请稍后发送');
    if([...this.jobs.values()].some(j=>j.running)) throw new Error('当前已有对比任务运行，请等待或停止');
    convo.busy=true;
    const job={id:randomUUID(),conversation:id,prompt,started:Date.now(),running:true,lanes:{},children:new Map()};
    for(const kind of targets) job.lanes[kind]={status:'queued',text:'',tools:0,usage:null,requests:0,requestLimit:this.config.maxTurns};
    this.jobs.set(job.id,job);
    job.done=Promise.allSettled(targets.map(kind=>this.runLane(convo,job,kind))).then(async()=>{job.running=false;convo.busy=false;await this.save(convo);await writeFile(join(convo.dir,job.id+'.json'),JSON.stringify(this.publicJob(job),null,2),{mode:0o600});});
    job.done.catch(error=>{job.error=error.message;job.running=false;convo.busy=false;});
    return job;
  }
  publicJob(job) {return {id:job.id,conversation:job.conversation,prompt:job.prompt,started:job.started,running:job.running,lanes:job.lanes,error:job.error};}
  async runLane(convo,job,kind) {
    const lane=convo.lanes[kind],state=job.lanes[kind];state.status='starting';state.started=Date.now();
    const token=lane.relayToken||randomBytes(32).toString('hex');lane.relayToken=token;this.tokens.set(token,{state,job,kind});
    const config=this.config, vendor=join(config.pluginDir,'vendor'), node=join(config.nodeDir,'bin/node');
    const gateway=`http://${config.gatewayHost}:${config.gatewayPort}`;
    const container='dsh-studio-'+randomUUID(); state.container=container;
    const env={HOME:'/home/agent',PATH:`${config.nodeDir}/bin:/usr/bin:/bin`,LANG:'C.UTF-8',TERM:'dumb',DEEPSEEK_API_KEY:token,OPENAI_API_KEY:token,DEEPSEEK_BASE_URL:gateway,OPENAI_BASE_URL:gateway+'/v1',HERMES_HOME:'/home/agent/.hermes',CODEX_HOME:'/home/agent/.codex',DSH_HOME:'/home/agent/.dsh',ANTHROPIC_API_KEY:token,ANTHROPIC_AUTH_TOKEN:token,ANTHROPIC_BASE_URL:gateway+'/anthropic',ANTHROPIC_MODEL:config.model,ANTHROPIC_DEFAULT_OPUS_MODEL:config.model,ANTHROPIC_DEFAULT_SONNET_MODEL:config.model,ANTHROPIC_DEFAULT_HAIKU_MODEL:config.model,CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1',DISABLE_AUTOUPDATER:'1',CLAUDE_CONFIG_DIR:'/home/agent/.claude',DSH_PERMISSION_MODE:'danger-full-access'};
    let command;
    try {
      if(kind==='codex') {
        await mkdir(join(lane.root,'home/.codex'),{recursive:true});
        await writeFile(join(lane.root,'home/.codex/config.toml'),`model = "${config.model}"\nmodel_provider = "deepseek"\nweb_search = "disabled"\n[model_providers.deepseek]\nname = "DeepSeek"\nbase_url = "${gateway}"\nwire_api = "responses"\nenv_key = "DEEPSEEK_API_KEY"\nrequires_openai_auth = false\n`,{mode:0o600});
        command=[join(vendor,'node_modules/.bin/codex'),'exec',...(lane.session?['resume',lane.session]:[]),'--skip-git-repo-check','--json','--dangerously-bypass-approvals-and-sandbox','-'];
      } else if(kind==='claude') command=[join(vendor,'node_modules/.bin/claude'),'-p','--verbose','--output-format','stream-json','--include-partial-messages','--dangerously-skip-permissions','--model',config.model,...(lane.session?['--resume',lane.session]:[])];
      else if(kind==='hermes') {
        await mkdir(join(lane.root,'home/.hermes'),{recursive:true,mode:0o700});
        await chmod(join(lane.root,'home/.hermes'),0o700);
        await writeFile(join(lane.root,'home/.hermes/config.yaml'),`model:\n  default: ${config.model}\n  provider: custom\n  base_url: ${gateway}/v1\nagent:\n  run_budget_seconds: ${config.timeoutSeconds}\n`,{mode:0o600});
        command=[join(vendor,'hermes-agent/.venv/bin/hermes'),'chat','--query-file','-','--format','stream-json','--provider','custom','--base-url',gateway+'/v1','--api-key',token,'--model',config.model,'--max-turns',String(config.maxTurns),'--yolo',...(lane.session?['--resume',lane.session]:[])];
      }
      else {
        const profile=join(lane.root,'home/.dsh/profiles/studio');await mkdir(profile,{recursive:true});
        await writeFile(join(profile,'package.json'),JSON.stringify({private:true,dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-headless']}}}));
        await writeFile(join(profile,'cordis.patch.yml'),'[]\n');
        const patch=[{id:'agent-default-model',config:{provider:'deepseek-official',model:config.model}},{id:'llm-deepseek',config:{baseURL:gateway,thinking:'disabled',maxTokens:32768}},{id:'sandbox-policy',config:{mode:'danger-full-access'}},...['session-title-llm','hmr','tool-subagent','tool-subagent-fork','tool-subagent-control','tool-subagent-list-agents','tool-plugin-manager','plugin-manager'].map(id=>({id,disabled:true}))];
        await writeFile(join(lane.root,'home/dsh-patch.json'),JSON.stringify(patch));
        env.TSX_TSCONFIG_PATH=join(config.dshDir,'tsconfig.json');
        command=[node,'--import',join(config.dshDir,'node_modules/tsx/dist/esm/index.mjs'),join(config.dshDir,'apps/cli/src/bin.ts'),'--profile','studio','--patch','/home/agent/dsh-patch.json','--json',...(lane.session?['--session-id',lane.session]:[]),'-'];
      }
      if(state.cancelled) {state.status='cancelled';return;}
      const args=['run','--rm','--init','-i','--name',container,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','192','--memory','2g','--cpus','2','--user',`${process.getuid()}:${process.getgid()}`,'--tmpfs','/tmp:rw,size=256m,mode=1777','--workdir','/work',
        '--mount',`type=bind,source=${lane.root}/workspace,target=/work`, '--mount',`type=bind,source=${lane.root}/home,target=/home/agent`,
        ...[config.nodeDir,config.dshDir,vendor,config.pythonDir].flatMap(p=>['--mount',`type=bind,source=${p},target=${p},readonly`]),
        ...Object.entries(env).flatMap(([k,v])=>['-e',`${k}=${v}`]),config.image,...command];
      // Native modules load from the read-only runtime tree; /tmp remains non-executable.
      const nodeCacheAt=args.indexOf(config.image);args.splice(nodeCacheAt,0,'-e','NARB_DISABLE_NATIVE_CACHE=1');
      state.status='running';state.model=config.model;
      const child=spawn(config.dockerPath,args,{env:{PATH:'/usr/bin:/bin',HOME:process.env.HOME},stdio:['pipe','pipe','pipe']});job.children.set(kind,{child,container});
      let buffer='',stderr='',bytes=0;const decoder=new StringDecoder('utf8');
      const rawFile=join(convo.dir,job.id+'-'+kind+'.jsonl');
      let writes=Promise.resolve();
      const timer=setTimeout(()=>{state.timedOut=true;this.kill(job,kind);},config.timeoutSeconds*1000);
      child.stdout.on('data',chunk=>{
        bytes+=chunk.length;if(bytes>64*1024*1024){state.error='原生事件流超过 64 MiB，本轮已停止，文件保留';this.kill(job,kind);return;}
        const raw=decoder.write(chunk).split(token).join('[redacted]');writes=writes.then(()=>appendFile(rawFile,raw,{mode:0o600}));buffer+=raw;
        let at;while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);try{projectEvent(kind,JSON.parse(line),state);}catch(error){state.diagnostics=(state.diagnostics||'')+line.slice(0,200)+'\n';}}
      });
      child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString('utf8').split(token).join('[redacted]')).slice(-12000);});
      child.stdin.on('error',error=>{if(error.code!=='EPIPE') state.error=error.message;});
      child.stdin.end(job.prompt);
      const outcome=await new Promise(resolve=>{child.once('error',error=>resolve({error:error.message}));child.once('close',(exitCode,signal)=>resolve({exitCode,signal}));});
      clearTimeout(timer);await writes;
      Object.assign(state,outcome);state.stderr=stderr;state.elapsedMs=Date.now()-state.started;
      state.status=terminalStatus(state,outcome.exitCode);
      if(state.timedOut)state.error=`达到本轮 ${config.timeoutSeconds} 秒时限，已生成的文件保留。`;
      if(state.status==='failed'&&!state.error) state.error=stderr.slice(-2000)||'缺少有效完成事件';
      if(state.session) lane.session=state.session;
    } catch(error) {state.status='failed';state.error=error.message;}
    finally {
      this.tokens.delete(token);state.workspaceReady=await this.removeContainer(container);job.children.delete(kind);
      if(!state.workspaceReady){state.status='cleanup_failed';state.error='容器清理未完成，已阻止此工作区的预览和继续运行，请检查 Docker。';this.unsafeWorkspaces.add(join(lane.root,'workspace'));}
      state.elapsedMs=Date.now()-state.started;
      lane.history.push({user:job.prompt,assistant:state.text,status:state.status,error:state.error||null,requests:state.requests,elapsedMs:state.elapsedMs});
    }
  }
  async removeContainer(name) {
    if(!this.removals.has(name))this.removals.set(name,new Promise(resolve=>{let error='';const p=spawn(this.config.dockerPath,['rm','-f',name],{stdio:['ignore','ignore','pipe'],env:{PATH:'/usr/bin:/bin'}});p.stderr.on('data',chunk=>error=(error+chunk.toString()).slice(-2000));p.once('close',code=>resolve(code===0||/No such (container|object)/i.test(error)));p.once('error',()=>resolve(false));}));
    return this.removals.get(name);
  }
  kill(job,kind) {const item=job.children.get(kind);if(item){void this.removeContainer(item.container);item.child.kill('SIGTERM');}}
  cancel(job) {for(const kind of Object.keys(job.lanes)){if(['queued','starting','running'].includes(job.lanes[kind].status)){job.lanes[kind].cancelled=true;this.kill(job,kind);}}}
  async dispose() {this.closed=true;for(const job of this.jobs.values()) if(job.running)this.cancel(job);await Promise.allSettled([...this.jobs.values()].map(j=>j.done));}
}
