import test from 'node:test';
import assert from 'node:assert/strict';
import {ModelCaseRegistry,validateModelCases,parseModelCaseCatalog} from '../src/model-case-registry.mjs';
const item=id=>({id,title:'Test case',brief:'Create a model',checks:{dimensions:{z:[.1,.2]},rays:[{origin:[0,0,1],target:[0,0,0],expect:'clear'}]}});
test('case registrations are atomic, owned, isolated from mutations and disposable',()=>{
  const r=new ModelCaseRegistry(),source=item('first'),remove=r.register('owner',[source]);source.title='changed';const listed=r.list();listed[0].checks.dimensions.z[0]=99;assert.equal(r.list()[0].title,'Test case');assert.equal(r.list()[0].checks.dimensions.z[0],.1);
  assert.throws(()=>r.register('other',[item('second'),item('first')]),/already registered/);assert.equal(r.list().length,1);remove();remove();assert.equal(r.list().length,0);const next=r.register('owner',[item('first')]);remove();assert.equal(r.list().length,1);next();r.close();assert.throws(()=>r.register('new',[item('next')]),/closed/);
});
test('case validation rejects silent unsupported predicates and degenerate measurements',()=>{
  for(const modify of [c=>c.checks.unknown=true,c=>c.checks.dimensions.z=[2,1],c=>c.checks.rays[0].target=[0,0,1],c=>c.id='../escape',c=>delete c.id,c=>c.checks=null,c=>c.brief='']){const c=item('one');modify(c);assert.throws(()=>validateModelCases([c]));}
  assert.throws(()=>validateModelCases([item('one'),item('one')]));assert.deepEqual(validateModelCases([item('valid')])[0],item('valid'));
  assert.throws(()=>new ModelCaseRegistry().register(undefined,[item('one')]));assert.throws(()=>parseModelCaseCatalog({version:2,cases:[item('one')]}));assert.equal(parseModelCaseCatalog({version:1,cases:[item('one')]}).length,1);
});
