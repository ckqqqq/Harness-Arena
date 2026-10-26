import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,copyFile,symlink,access,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
test('configure rejects a symlinked runtime key before provisioning and never overwrites an existing key',async()=>{
  const root=await mkdtemp(join(tmpdir(),'studio-configure-security-')),app=join(root,'app'),secret='FIXTURE_NOT_A_REAL_CREDENTIAL';
  try{
    for(const name of ['scripts/configure.mjs','scripts/config.mjs','src/deployment.mjs','src/configuration.mjs']){await mkdir(dirname(join(app,name)),{recursive:true});await copyFile(new URL('../'+name,import.meta.url),join(app,name));}
    const c={nodeDir:join(root,'node'),dshDir:join(root,'dsh'),pythonDir:join(root,'python'),dockerPath:join(root,'docker'),image:'sha256:'+'c'.repeat(64)};
    for(const name of [join(c.nodeDir,'bin/node'),join(c.dshDir,'apps/cli/src/bin.ts'),c.dockerPath]){await mkdir(dirname(name),{recursive:true});await writeFile(name,'fixture',{mode:0o755});}await mkdir(c.pythonDir);
    const alias=join(root,'alias');await symlink(c.nodeDir,alias,process.platform==='win32'?'junction':'dir');c.keyFile=join(alias,'future/key');const settings=join(root,'settings.json');await writeFile(settings,JSON.stringify(c));
    const run=()=>promisify(execFile)(process.execPath,[join(app,'scripts/configure.mjs'),settings],{env:{...process.env,DEEPSEEK_API_KEY:secret}});
    await assert.rejects(run(),e=>{assert.match(e.stderr,/inside a container/);assert.ok(!e.stderr.includes(secret));return true;});await assert.rejects(access(join(c.nodeDir,'future/key')));await assert.rejects(access(join(app,'config.local.json')));
    c.keyFile=join(root,'private/key');await mkdir(dirname(c.keyFile));await writeFile(c.keyFile,'ORIGINAL_FIXTURE',{mode:0o600});await writeFile(settings,JSON.stringify(c));await assert.rejects(run());assert.equal(await readFile(c.keyFile,'utf8'),'ORIGINAL_FIXTURE');await assert.rejects(access(join(app,'studio.overlay.json')));
  }finally{await rm(root,{recursive:true,force:true});}
});
