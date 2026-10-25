/** Optional integration check against the operator's installed, built DSH checkout. */
import assert from 'node:assert/strict';
import {resolve,join,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ModelCaseRegistry} from '../src/model-case-registry.mjs';
import * as example from '../examples/plugins/model-case/index.mjs';
const directory=process.argv[2];if(!directory||!isAbsolute(directory))throw new Error('Usage: npm run check:cordis -- /absolute/path/to/built-dsh');
const {Context}=await import(pathToFileURL(join(resolve(directory),'vendor/cordis/lib/index.js')).href);
const ctx=new Context();
function provider(registry){return {name:'studio-case-check-provider',provide:['studioModelCases'],apply(ctx){ctx.provide('studioModelCases',registry);ctx.effect(()=>()=>registry.close());}};}
try{
  const first=new ModelCaseRegistry(),host=await ctx.plugin(provider(first)),plugin=await ctx.plugin(example);
  assert.equal(first.list()[0].id,'example-ring');await plugin.dispose();assert.equal(first.list().length,0);
  const dependent=await ctx.plugin(example);assert.equal(first.list().length,1);await host.dispose();assert.equal(first.list().length,0);
  const second=new ModelCaseRegistry(),replacement=await ctx.plugin(provider(second));
  for(let i=0;i<100&&second.list().length!==1;i++)await new Promise(r=>setTimeout(r,10));
  assert.equal(second.list()[0].id,'example-ring');await dependent.dispose();assert.equal(second.list().length,0);await replacement.dispose();
  console.log('Native Cordis plugin loading, disposal and service reinjection passed. No model calls made.');
}finally{await ctx.fiber.dispose();}
