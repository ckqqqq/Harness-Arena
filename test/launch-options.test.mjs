import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {parseLaunchOptions,validatePatches,patchArguments} from '../scripts/launch-options.mjs';

test('launcher preserves ordered overlays and paths with spaces without shell interpretation',()=>{
  const cwd=resolve('operator home');
  const {patches}=parseLaunchOptions(['--patch','ring pack.json','--patch','$(literal).json'],cwd);
  assert.deepEqual(patchArguments('base.json',patches),['--patch','base.json','--patch',join(cwd,'ring pack.json'),'--patch',join(cwd,'$(literal).json')]);
  assert.deepEqual(parseLaunchOptions([]).patches,[]);
  assert.equal(parseLaunchOptions(['--help']).help,true);
  for(const args of [['--patch'],['--unknown'],['--help','--patch','x'],['--patch','--patch']])assert.throws(()=>parseLaunchOptions(args));
});

test('launcher rejects missing and malformed overlays before starting a host',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'studio-launch-'));
  try{
    const path=join(dir,'pack.json');
    await assert.rejects(validatePatches([path]),/unreadable/);
    await writeFile(path,'secret-invalid-json');
    await assert.rejects(validatePatches([path]),error=>!error.message.includes('secret-invalid-json'));
    await writeFile(path,'{}');
    await assert.rejects(validatePatches([path]),/JSON array/);
    await writeFile(path,'[{"insert":[]}]');
    await validatePatches([path]);
  }finally{await rm(dir,{recursive:true,force:true});}
});
