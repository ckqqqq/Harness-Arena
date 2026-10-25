import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {admitModelRequest,terminalStatus} from '../src/budget.mjs';
import {ArtifactPreviews,listArtifacts} from '../src/artifacts.mjs';
import {StudioRuntime,projectEvent} from '../src/runtime.mjs';
test('budget rejection is terminal without counting rejected retries or token estimates',()=>{
  const state={requests:0};assert.ok(admitModelRequest(state,1,'/responses'));assert.ok(admitModelRequest(state,1,'/messages/count_tokens'));
  for(let i=0;i<6;i++)assert.equal(admitModelRequest(state,1,'/messages'),false);
  assert.equal(state.requests,1);assert.equal(terminalStatus(state,1),'budget_exhausted');assert.match(state.error,/1 次/);
  const partial={text:'已生成部分内容',tools:0};projectEvent('dsh',{type:'final',text:'',reason:{kind:'error',error:{message:'budget'}}},partial);assert.equal(partial.text,'已生成部分内容');assert.equal(partial.error,'budget');assert.equal(partial.failed,true);
  const truncated={text:'partial',tools:0};projectEvent('dsh',{type:'final',text:'',reason:{kind:'max-tokens'}},truncated);assert.equal(terminalStatus(truncated,1),'output_limit');assert.match(truncated.error,/长度上限/);assert.equal(truncated.text,'partial');
});
test('workspace readers prevent a new run and active writers prevent snapshots',async()=>{
  const rt=new StudioRuntime({}),root=join(tmpdir(),'test-workspace');let release;
  const reading=rt.withWorkspaceRead(root,()=>new Promise(resolve=>{release=resolve;}));assert.equal(rt.readers.get(root),1);release();await reading;assert.equal(rt.readers.has(root),false);
  rt.unsafeWorkspaces.add(root);await assert.rejects(rt.withWorkspaceRead(root,()=>{}));
});
test('artifact grants serve isolated immutable snapshots with bounded byte ranges',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'studio-artifacts-')),root=join(dir,'workspace');await mkdir(root);
  const previews=new ArtifactPreviews({dir:join(dir,'snapshots'),maxBytes:4096,ttlSeconds:60});await previews.init();
  const lease=async(_root,fn)=>fn();
  const server=createServer((req,res)=>previews.serve(req,res,req.url.split('/').pop().split('?')[0]).catch(()=>{res.writeHead(400);res.end();}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  try{
    await writeFile(join(root,'index.html'),'<button>Interactive</button>');await writeFile(join(root,'demo.mp4'),'0123456789');await mkdir(join(root,'node_modules'));await writeFile(join(root,'node_modules/hidden.html'),'ignored');
    assert.deepEqual((await listArtifacts(root,4096)).map(x=>x.path),['index.html','demo.mp4']);
    const url=await previews.grant(root,'index.html',lease);await writeFile(join(root,'index.html'),'changed');const html=await fetch(base+url);assert.equal(await html.text(),'<button>Interactive</button>');assert.match(html.headers.get('content-security-policy'),/sandbox allow-scripts/);assert.match(html.headers.get('content-security-policy'),/connect-src 'none'/);
    assert.equal((await fetch(base+'/artifact/unknown')).status,404);await assert.rejects(previews.grant(root,'../secret.html',lease));
    const video=await previews.grant(root,'demo.mp4',lease),range=await fetch(base+video,{headers:{Range:'bytes=2-5'}});assert.equal(range.status,206);assert.equal(range.headers.get('content-range'),'bytes 2-5/10');assert.equal(await range.text(),'2345');
    assert.equal((await fetch(base+video,{headers:{Range:'bytes=50-'}})).status,416);
    const grant=previews.grants.get(video.split('/').pop());grant.expires=0;assert.equal((await fetch(base+video)).status,404);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await previews.dispose();await rm(dir,{recursive:true,force:true});}
});
