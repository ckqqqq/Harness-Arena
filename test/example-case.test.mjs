import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ModelCaseRegistry,parseModelCaseCatalog} from '../src/model-case-registry.mjs';
import {apply} from '../examples/plugins/model-case/index.mjs';

test('example plugin and batch catalog share identical normalized cases',async()=>{
  const expected=parseModelCaseCatalog(JSON.parse(await readFile(new URL('../examples/plugins/model-case/cases.json',import.meta.url),'utf8')));
  const registry=new ModelCaseRegistry();
  let dispose;
  apply({studioModelCases:registry,effect:effect=>{dispose=effect();}});
  assert.deepEqual(registry.list(),expected);
  assert.equal(expected.length,1);
  assert.equal(expected[0].checks.rays[0].expect,'clear');
  dispose();
  assert.deepEqual(registry.list(),[]);
});
