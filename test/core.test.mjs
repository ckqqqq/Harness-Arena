import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,symlink,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateLayout,initialLayout} from '../src/layout.mjs';
import {workspacePath,getFile,putFile,listFiles} from '../src/files.mjs';
import {projectEvent} from '../src/runtime.mjs';
test('drawn components persist as a bounded declarative layout',()=>{
  assert.deepEqual(validateLayout(initialLayout),initialLayout);
  for(const patch of [{type:'script'},{x:95,w:20},{id:'bad<svg>'},{h:0}])assert.throws(()=>validateLayout({version:1,components:[{...initialLayout.components[0],...patch}]}));
  assert.throws(()=>validateLayout({version:1,components:[initialLayout.components[0],initialLayout.components[0]]}));
});
test('workspace edits reject traversal, external symlinks and binary files',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'studio-test-'));
  try{const root=join(dir,'workspace');await mkdir(root);await putFile(root,'hello.txt','你好');assert.equal(await getFile(root,'hello.txt'),'你好');assert.equal((await listFiles(root))[0].name,'hello.txt');
    await assert.rejects(putFile(root,'hello.txt','overwrite',true));assert.equal(await getFile(root,'hello.txt'),'你好');
    for(const path of ['../private','/etc/passwd','a\\b'])await assert.rejects(workspacePath(root,path,true));
    const outside=join(dir,'outside');await mkdir(outside);await writeFile(join(outside,'secret'),'hidden');await symlink(outside,join(root,'linked'),'junction');await assert.rejects(getFile(root,'linked/secret'));
    await writeFile(join(root,'binary'),Buffer.from([0,1]));await assert.rejects(getFile(root,'binary'));await assert.rejects(putFile(root,'big','x'.repeat(262145)));
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('native completion and errors remain distinct for all four harnesses',()=>{
  for(const [kind,event] of [['dsh',{type:'final',text:'好',reason:{kind:'completed'}}],['codex',{type:'turn.completed',usage:{output_tokens:1}}],['claude',{type:'result',result:'好',is_error:false}],['hermes',{type:'result',final_response:'好',exit_code:0}]]){const state={text:'',tools:0};projectEvent(kind,event,state);assert.equal(state.final,true);assert.ok(!state.failed);}
  const state={text:'',tools:0};projectEvent('claude',{type:'result',is_error:true,result:'bad'},state);assert.equal(state.failed,true);
  const blocked={text:'',tools:0};projectEvent('dsh',{type:'final',text:'',reason:{kind:'blocked'}},blocked);assert.equal(blocked.failed,true);
});
