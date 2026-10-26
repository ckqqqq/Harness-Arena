import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {resolveConfig} from '../scripts/config.mjs';
const root=join(tmpdir(),'studio-source');
const input={dshDir:join(root,'dsh'),nodeDir:join(root,'node'),image:'sha256:'+'a'.repeat(64)};
test('configuration derives private locations from the current checkout',()=>{
  const c=resolveConfig(input,root);assert.equal(c.pluginDir,root);assert.equal(c.dataDir,join(root,'data'));assert.equal(c.keyFile,join(root,'private/deepseek.key'));assert.equal(c.pythonDir,join(root,'python-runtimes'));assert.equal(c.host,'127.0.0.1');
});
test('configuration rejects unpinned images, relative mounts and colliding ports',()=>{
  for(const patch of [{image:'ubuntu:latest'},{nodeDir:'relative'},{gatewayPort:3081},{port:80},{model:'other-model'}])assert.throws(()=>resolveConfig({...input,...patch},root));
});
test('configuration rejects malformed limits, timer overflows and bind addresses',()=>{
  for(const patch of [{timeoutSeconds:0},{timeoutSeconds:2147484},{maxTurns:1.5},{artifactMaxBytes:Number.MAX_SAFE_INTEGER+1},{host:''},{gatewayHost:'http://localhost'}])assert.throws(()=>resolveConfig({...input,...patch},root));
  assert.throws(()=>resolveConfig([],root));
});
