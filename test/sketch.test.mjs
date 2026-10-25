import test from 'node:test';
import assert from 'node:assert/strict';
import {sketchInput,proposalOutput,recognizeSketch} from '../src/sketch.mjs';
import {initialLayout} from '../src/layout.mjs';
test('recognition admits bounded PNGs and rejects remote URLs or invalid layouts',()=>{
  const png=Buffer.alloc(33);Buffer.from('89504e470d0a1a0a','hex').copy(png);png.write('IHDR',12);png.writeUInt32BE(1200,16);png.writeUInt32BE(720,20);
  const input={instruction:'左侧聊天，右侧文件',image:'data:image/png;base64,'+png.toString('base64'),layout:initialLayout};
  assert.equal(sketchInput(input,1024).instruction,input.instruction);
  for(const patch of [{image:'https://untrusted.invalid/image.png'},{instruction:''},{layout:{version:1,components:[{...initialLayout.components[0],type:'script'}]}}])assert.throws(()=>sketchInput({...input,...patch},1024));
  assert.throws(()=>sketchInput(input,10));
  assert.throws(()=>proposalOutput({summary:'bad',layout:{version:1,components:[]}}));
});
test('one model call returns a proposal without modifying the supplied layout',async()=>{
  const original=structuredClone(initialLayout);let count=0;
  const result=await recognizeSketch({instruction:'界面',image:'data:image/png;base64,abc',layout:original},{key:'test-only',model:'deepseek-flash',maxTokens:4000,signal:new AbortController().signal,fetcher:async(url,options)=>{
    count++;assert.equal(url,'https://api.deepseek.com/chat/completions');const body=JSON.parse(options.body);assert.equal(body.response_format.type,'json_object');assert.equal(body.messages[1].content[1].type,'image_url');
    return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({summary:'左侧聊天',layout:initialLayout})}}],usage:{total_tokens:99}});
  }});
  assert.equal(count,1);assert.deepEqual(original,initialLayout);assert.deepEqual(result.layout,initialLayout);assert.equal(result.usage.total_tokens,99);
});
test('malformed, truncated and provider-error responses fail without a replacement layout',async()=>{
  for(const response of [new Response('error',{status:503}),Response.json({choices:[{finish_reason:'length',message:{content:'{}'}}]}),Response.json({choices:[{finish_reason:'stop',message:{content:'not JSON'}}]})]){
    await assert.rejects(recognizeSketch({layout:initialLayout},{key:'test',model:'deepseek-flash',maxTokens:100,fetcher:async()=>response}));
  }
});
