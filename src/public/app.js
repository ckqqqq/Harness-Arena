const $=s=>document.querySelector(s);
const names={claude:'Claude Code',codex:'Codex',hermes:'Hermes',dsh:'DSH'},tones={claude:'#b16e4d',codex:'#344d49',hermes:'#7c795b',dsh:'#477a60'};
let token=sessionStorage.getItem('studio-token')||'',conversation=localStorage.getItem('studio-conversation'),view='compare',layout,selected=null,preview=false,busy=false,job=null,pollTimer,strokes=JSON.parse(localStorage.getItem('studio-ink')||'[]'),undo=[],fileDir='',filePath='',fileText='',history={};
let toastTimer;
function toast(text){$('#toast').textContent=text;$('#toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').style.display='none',4000);}
async function api(path,body){const r=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:{'x-studio-token':token,...body===undefined?{}:{'Content-Type':'application/json'}},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new Error(data.error||r.status);return data;}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function button(text,fn,cls=''){const n=el('button',cls,text);n.type='button';n.onclick=()=>Promise.resolve(fn()).catch(e=>toast(e.message));return n;}
const labels={queued:'排队',starting:'启动中',running:'运行中',completed:'已完成',failed:'失败',cancelled:'已停止',timeout:'超时'};
for(const [kind,name] of Object.entries(names)) {
  const pane=el('article','lane');pane.id='lane-'+kind;pane.style.setProperty('--tone',tones[kind]);
  const head=el('div','lane-head');head.append(el('span','lane-icon',name[0]),el('strong','',name),el('span','badge','等待输入'));
  pane.append(head,el('div','messages'),el('div','lane-foot','独立原生会话'));$('#lanes').append(pane);
}
function renderLane(kind,state,finished=false){
  const pane=$('#lane-'+kind),content=pane.querySelector('.messages');const nearBottom=content.scrollHeight-content.scrollTop-content.clientHeight<80;
  const displayStatus=state?.status||(history[kind]||[]).at(-1)?.status||'idle';pane.dataset.status=displayStatus;pane.querySelector('.badge').textContent=labels[displayStatus]||'等待输入';content.replaceChildren();
  for(const turn of history[kind]||[]){const u=el('div','message user');u.append(el('b','','YOU'),el('span','',turn.user));const a=el('div','message');a.append(el('b','',names[kind]),el('span','',turn.assistant||'（本轮没有回复）'));content.append(u,a);}
  if(state){if(!finished){const u=el('div','message user');u.append(el('b','','YOU'),el('span','',job.prompt));const a=el('div','message');a.append(el('b','',names[kind]),el('span','',state.text||'正在等待 harness…'));content.append(u,a);}if(state.error)content.append(el('p','error',state.error));if(state.stderr){const d=el('details'),s=el('summary','','运行日志');d.append(s,el('pre','',state.stderr));content.append(d);}}
  if(!content.childNodes.length)content.append(el('div','empty','准备好接收相同的任务'));
  const usage=state?.usage,elapsed=state?.elapsedMs??(state?.started?Date.now()-state.started:0);
  pane.querySelector('.lane-foot').textContent=state?`${(elapsed/1000).toFixed(1)}s · ${state.requests||0} 次模型请求 · ${state.tools||0} 个工具事件${usage?' · usage '+JSON.stringify(usage):''}`:'独立原生会话 · 相同 DeepSeek 模型';
  if(nearBottom||!state)content.scrollTop=content.scrollHeight;
}
async function loadHistory(){const c=await api('conversation?id='+conversation);history=Object.fromEntries(Object.entries(c.lanes).map(([k,v])=>[k,v.history]));for(const k of Object.keys(names))renderLane(k);renderComponents();}
async function fresh(){if(busy)return;const c=await api('conversations',{});conversation=c.id;localStorage.setItem('studio-conversation',conversation);$('#conversation-label').textContent='会话 '+conversation.slice(0,8);await loadHistory();toast('新对话已创建，公共输入已复制四份');}
async function boot(){const status=await api('status');$('#model').textContent=status.model;$('#runtime-mode').textContent=status.mode;layout=await api('layout');$('#login').hidden=true;if(conversation){try{await loadHistory();}catch(error){await fresh();}}else await fresh();$('#conversation-label').textContent='会话 '+conversation.slice(0,8);renderBoard();const pending=sessionStorage.getItem('studio-job');if(pending){try{const restored=await api('job?id='+pending);if(restored.running){job=restored;conversation=restored.conversation;localStorage.setItem('studio-conversation',conversation);await loadHistory();setBusy(true);void poll();}else sessionStorage.removeItem('studio-job');}catch(error){sessionStorage.removeItem('studio-job');toast('上次运行已结束或插件已重启，已恢复保存的对话');}}}
$('#login-form').onsubmit=async e=>{e.preventDefault();token=$('#access').value.trim();try{await boot();sessionStorage.setItem('studio-token',token);}catch(error){$('#login-error').textContent=error.message;}};
const fragment=new URLSearchParams(location.hash.slice(1));if(fragment.has('access')){token=fragment.get('access');sessionStorage.setItem('studio-token',token);historyReplace();}
function historyReplace(){window.history.replaceState(null,'',location.pathname);}
if(token)boot().catch(error=>{$('#login-error').textContent=error.message;$('#login').hidden=false;});
function setView(next){view=next;$('#compare-view').hidden=view!=='compare';$('#board-view').hidden=view!=='board';$('#tab-compare').classList.toggle('active',view==='compare');$('#tab-board').classList.toggle('active',view==='board');$('#send-scope').textContent=view==='compare'?'发送给全部四栏':'发送给白板中的 DSH';$('#send').textContent=view==='compare'?'同时发送 ↗':'发送给 DSH ↗';if(layout)renderBoard();}
$('#tab-compare').onclick=()=>setView('compare');$('#tab-board').onclick=()=>setView('board');$('#new-conversation').onclick=()=>fresh().catch(e=>toast(e.message));
function setBusy(value){busy=value;$('#send').disabled=value;$('#cancel').disabled=!value;$('#new-conversation').disabled=value;}
async function poll(){try{job=await api('job?id='+job.id);for(const [k,s] of Object.entries(job.lanes))renderLane(k,s);renderChatComponents();$('#run-status').textContent=job.running?'各栏独立执行中…':'本轮结束';if(job.running){pollTimer=setTimeout(poll,650);}else{sessionStorage.removeItem('studio-job');setBusy(false);for(const [k,s] of Object.entries(job.lanes))(history[k]??=[]).push({user:job.prompt,assistant:s.text,status:s.status});for(const [k,s] of Object.entries(job.lanes))renderLane(k,s,true);renderComponents();if(job.error)toast(job.error);}}catch(error){$('#run-status').textContent='连接中断，正在重试';pollTimer=setTimeout(poll,2000);}}
$('#composer').onsubmit=async e=>{e.preventDefault();if(busy)return;const prompt=$('#prompt').value;if(!prompt.trim())return;setBusy(true);try{job=await api('run',{conversation,prompt,targets:view==='compare'?Object.keys(names):['dsh']});sessionStorage.setItem('studio-job',job.id);$('#prompt').value='';await poll();}catch(error){setBusy(false);toast(error.message);}};
$('#prompt').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#composer').requestSubmit();}};
$('#cancel').onclick=()=>job&&api('cancel',{id:job.id}).catch(e=>toast(e.message));
function checkpoint(){undo.push(structuredClone({layout,strokes}));if(undo.length>40)undo.shift();}
function point(e){const r=$('#board').getBoundingClientRect();return{x:Math.min(100,Math.max(0,(e.clientX-r.left)/r.width*100)),y:Math.min(100,Math.max(0,(e.clientY-r.top)/r.height*100))};}
function renderInk(){const svg=$('#ink');svg.replaceChildren();for(const points of strokes){const p=document.createElementNS('http://www.w3.org/2000/svg','polyline');p.setAttribute('points',points.map(p=>[p.x*10,p.y*6].join(',')).join(' '));p.setAttribute('fill','none');p.setAttribute('stroke','#758d75');p.setAttribute('stroke-width','2');svg.append(p);}}
function renderBoard(){renderInk();renderComponents();}
function select(id){selected=id;const c=layout.components.find(c=>c.id===id);$('#component-title').value=c?.title||'';$('#component-type').value=c?.type||'files';$('#component-info').textContent=c?`${c.type} · x ${c.x.toFixed(0)}% / y ${c.y.toFixed(0)}% · ${c.w.toFixed(0)} × ${c.h.toFixed(0)}%`:'画出的区域会变成可操作组件。';renderComponents();}
function renderComponents(){if(!layout)return;const layer=$('#components');layer.replaceChildren();$('#board').classList.toggle('preview',preview);for(const c of layout.components){const n=el('section','component'+(selected===c.id?' selected':'')+(preview?'':' editing'));n.dataset.id=c.id;Object.assign(n.style,{left:c.x+'%',top:c.y+'%',width:c.w+'%',height:c.h+'%'});const head=el('div','component-head');head.append(el('span','',c.title||c.type),el('small','',c.type));const body=el('div','component-body');body.dataset.type=c.type;n.append(head,body);if(!preview)n.append(el('div','resize'));layer.append(n);if(c.type==='files')renderFiles(body);if(c.type==='preview')renderPreview(body);if(c.type==='chat')renderChat(body);if(c.type==='note'){const t=el('textarea','note');t.placeholder='写下界面说明或任务笔记…';t.value=localStorage.getItem('studio-note-'+c.id)||'';t.oninput=()=>localStorage.setItem('studio-note-'+c.id,t.value);body.append(t);}}}
let gesture;
$('#board').onpointerdown=e=>{if(preview||e.button!==0)return;const p=point(e),mode=$('#draw-mode').value,component=e.target.closest('.component');
  if(component&&mode==='select'){const id=component.dataset.id;select(id);checkpoint();gesture={type:e.target.classList.contains('resize')?'resize':'move',id,start:p,original:structuredClone(layout.components.find(c=>c.id===id))};}
  else if(mode==='pen'){checkpoint();strokes.push([p]);gesture={type:'pen'};renderInk();}
  else if(mode==='rect'){checkpoint();const id='c-'+Array.from(crypto.getRandomValues(new Uint8Array(8)),x=>x.toString(16).padStart(2,'0')).join('');const c={id,type:$('#component-type').value,x:p.x,y:p.y,w:0,h:0,title:$('#component-type').selectedOptions[0].textContent};layout.components.push(c);gesture={type:'rect',id,start:p};selected=id;renderComponents();}else return;
  $('#board').setPointerCapture(e.pointerId);e.preventDefault();};
$('#board').onpointermove=e=>{if(!gesture)return;const p=point(e);if(gesture.type==='pen'){strokes.at(-1).push(p);renderInk();return;}const c=layout.components.find(c=>c.id===gesture.id),g=gesture;if(g.type==='rect'){c.x=Math.min(g.start.x,p.x);c.y=Math.min(g.start.y,p.y);c.w=Math.abs(p.x-g.start.x);c.h=Math.abs(p.y-g.start.y);}else if(g.type==='move'){c.x=Math.min(100-c.w,Math.max(0,g.original.x+p.x-g.start.x));c.y=Math.min(100-c.h,Math.max(0,g.original.y+p.y-g.start.y));}else{c.w=Math.max(8,Math.min(100-c.x,g.original.w+p.x-g.start.x));c.h=Math.max(8,Math.min(100-c.y,g.original.h+p.y-g.start.y));}const n=$(`[data-id="${c.id}"]`);Object.assign(n.style,{left:c.x+'%',top:c.y+'%',width:c.w+'%',height:c.h+'%'});};
function endGesture(){if(!gesture)return;if(gesture.type==='rect'){layout.components=layout.components.filter(c=>c.w>=8&&c.h>=8);if(!layout.components.some(c=>c.id===selected))selected=null;}gesture=null;localStorage.setItem('studio-ink',JSON.stringify(strokes));select(selected);}
$('#board').onpointerup=endGesture;$('#board').onpointercancel=endGesture;
$('#component-title').onchange=()=>{const c=layout.components.find(c=>c.id===selected);if(c){checkpoint();c.title=$('#component-title').value;renderComponents();}};
$('#component-type').onchange=()=>{const c=layout.components.find(c=>c.id===selected);if(c){checkpoint();c.type=$('#component-type').value;renderComponents();}};
$('#remove-component').onclick=()=>{if(!selected)return;checkpoint();layout.components=layout.components.filter(c=>c.id!==selected);select(null);};
$('#undo').onclick=()=>{if(undo.length){const previous=undo.pop();layout=previous.layout;strokes=previous.strokes;localStorage.setItem('studio-ink',JSON.stringify(strokes));renderInk();select(null);}};
$('#clear-ink').onclick=()=>{checkpoint();strokes=[];localStorage.setItem('studio-ink','[]');renderInk();};
$('#preview-mode').onclick=()=>{preview=!preview;$('#preview-mode').textContent=preview?'返回绘制':'预览交互';renderComponents();};
$('#apply-layout').onclick=async()=>{try{layout=await api('layout',layout);preview=true;$('#preview-mode').textContent='返回绘制';renderComponents();toast('布局已保存，现在可以操作组件');}catch(error){toast(error.message);}};
$('#export-layout').onclick=()=>{const a=el('a');const url=URL.createObjectURL(new Blob([JSON.stringify({layout,strokes},null,2)],{type:'application/json'}));a.href=url;a.download='dsh-studio-layout.json';a.click();URL.revokeObjectURL(url);};
$('#import-layout').onchange=async e=>{try{const value=JSON.parse(await e.target.files[0].text());const next=await api('layout',value.layout||value);checkpoint();layout=next;strokes=Array.isArray(value.strokes)?value.strokes.filter(s=>Array.isArray(s)&&s.length<10000&&s.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).slice(0,100):[];localStorage.setItem('studio-ink',JSON.stringify(strokes));renderBoard();toast('布局已导入');}catch(error){toast(error.message);}e.target.value='';};
function fileQuery(path){return new URLSearchParams({target:$('#file-target').value,conversation,path}).toString();}
async function renderFiles(body){try{const target=$('#file-target').value,dir=fileDir;const data=await api('files?'+fileQuery(dir));if(!body.isConnected||target!==$('#file-target').value||dir!==fileDir)return;body.replaceChildren();body.append(el('small','',target+' / '+(dir||'.')));if(dir)body.append(button('↰ 上一级',()=>{fileDir=dir.split('/').slice(0,-1).join('/');renderComponents();},'file-item'));for(const item of data.items)body.append(button((item.directory?'▸ ':'· ')+item.name,async()=>{if(item.directory){fileDir=item.path;renderComponents();}else{const f=await api('file?'+fileQuery(item.path));filePath=f.path;fileText=f.text;document.querySelectorAll('[data-type="preview"]').forEach(renderPreview);}},'file-item'));if(!data.items.length)body.append(el('p','','空工作区，可点击右侧“新建文本文件”'));}catch(error){body.textContent=error.message;}}
function renderPreview(body){body.replaceChildren();if(!filePath){body.append(el('p','','在文件列表中选择一个文本文件'));return;}body.append(el('small','',filePath));const editor=el('textarea','preview-text');editor.value=fileText;editor.oninput=()=>{fileText=editor.value;};body.append(editor,button('保存',async()=>{await api('file?'+fileQuery(filePath),{text:editor.value});fileText=editor.value;toast('文件已保存');}),button('附加到问题',()=>{$('#prompt').value+='\n文件 '+filePath+':\n'+editor.value;toast('文本已附加，下一次发送会同步给所选栏');}));}
function renderChat(body){body.replaceChildren();for(const turn of history.dsh||[]){body.append(el('div','message user',turn.user),el('div','message',turn.assistant));}if(job?.running&&job.lanes.dsh)body.append(el('div','message',job.lanes.dsh.text||'DSH 正在工作…'));if(!body.childNodes.length)body.append(el('p','','使用页面下方输入框开始 DSH 对话'));body.scrollTop=body.scrollHeight;}
function renderChatComponents(){document.querySelectorAll('[data-type="chat"]').forEach(renderChat);}
$('#file-target').onchange=()=>{fileDir='';filePath='';fileText='';renderComponents();};$('#refresh-files').onclick=renderComponents;
$('#new-file').onclick=async()=>{const name=window.prompt('文件名（相对于当前目录）','note.txt');if(!name)return;try{const path=[fileDir,name].filter(Boolean).join('/');await api('file?'+fileQuery(path),{text:'',create:true});filePath=path;fileText='';renderComponents();}catch(error){toast(error.message);}};

let sketchController=null,sketchProposal=null;
function sketchImage(){
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=720;
  const pen=canvas.getContext('2d');pen.fillStyle='#ffffff';pen.fillRect(0,0,1200,720);
  pen.font='17px "Microsoft YaHei", sans-serif';
  for(const c of layout.components){pen.fillStyle='#f1f5ed';pen.fillRect(c.x*12,c.y*7.2,c.w*12,c.h*7.2);pen.strokeStyle='#8b9f89';pen.lineWidth=2;pen.strokeRect(c.x*12,c.y*7.2,c.w*12,c.h*7.2);pen.fillStyle='#334c3c';pen.fillText((c.title||c.type).slice(0,60),c.x*12+8,c.y*7.2+24,Math.max(10,c.w*12-16));}
  pen.strokeStyle='#273d2f';pen.lineWidth=3;pen.lineCap='round';pen.lineJoin='round';
  for(const points of strokes){pen.beginPath();points.forEach((p,i)=>i?pen.lineTo(p.x*12,p.y*7.2):pen.moveTo(p.x*12,p.y*7.2));pen.stroke();}
  return canvas.toDataURL('image/png');
}
function showSketchProposal(value){
  sketchProposal=value;$('#sketch-summary').textContent=value.summary;$('#sketch-usage').textContent=value.model+' · '+value.layout.components.length+' 个组件'+(Number.isFinite(value.usage?.total_tokens)?' · 消耗 '+value.usage.total_tokens+' tokens':'');
  const target=$('#sketch-preview');target.replaceChildren();
  for(const c of value.layout.components){const region=el('div','draft-component');Object.assign(region.style,{left:c.x+'%',top:c.y+'%',width:c.w+'%',height:c.h+'%'});region.append(el('strong','',c.title||c.type),el('small','',c.type));target.append(region);}
  $('#sketch-dialog').showModal();
}
$('#recognize-sketch').onclick=async()=>{
  const instruction=$('#sketch-instruction').value.trim();if(!instruction){toast('先用一句话说明草图中的区域和组件');return;}
  const snapshot=JSON.stringify(layout),controller=new AbortController();sketchController=controller;
  $('#recognize-sketch').disabled=true;$('#cancel-sketch').hidden=false;$('#recognize-sketch').textContent='识别中…';
  try{const response=await fetch('/api/sketch',{method:'POST',headers:{'x-studio-token':token,'Content-Type':'application/json'},body:JSON.stringify({instruction,image:sketchImage(),layout}),signal:controller.signal});const proposal=await response.json();if(!response.ok)throw new Error(proposal.error||'识别失败');if(snapshot!==JSON.stringify(layout))toast('白板已变化，请核对识别草案后再采用');showSketchProposal(proposal);}
  catch(error){toast(error.name==='AbortError'?'已取消识别，原布局保留':error.message);}
  finally{if(sketchController===controller)sketchController=null;$('#recognize-sketch').disabled=false;$('#cancel-sketch').hidden=true;$('#recognize-sketch').textContent='识别草图';}
};
$('#cancel-sketch').onclick=()=>sketchController?.abort();
$('#discard-sketch').onclick=()=>$('#sketch-dialog').close();
$('#adopt-sketch').onclick=()=>{if(!sketchProposal)return;checkpoint();layout=structuredClone(sketchProposal.layout);selected=null;preview=true;$('#preview-mode').textContent='返回绘制';$('#sketch-dialog').close();renderComponents();toast('草案已采用，可继续修改；保存后才会持久生效');};
$('#blank-board').onclick=()=>{checkpoint();layout={version:1,components:[]};strokes=[];selected=null;preview=false;localStorage.setItem('studio-ink','[]');$('#preview-mode').textContent='预览交互';renderBoard();toast('当前画布已清空，可直接用自由画笔绘制；已保存布局未改变');};
