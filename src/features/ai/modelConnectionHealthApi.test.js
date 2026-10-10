import test from "node:test";
import assert from "node:assert/strict";
import { testAiModelConnection, modelConnectionHealthTimeoutMs } from "./modelConnectionHealthApi.js";

test("connection deadline budgets server stages and configured retry count", () => {
  assert.equal(modelConnectionHealthTimeoutMs({timeout_seconds:1,retry_count:0}),33000);
  assert.equal(modelConnectionHealthTimeoutMs({timeout_seconds:60,retry_count:3}),750000);
});
test("successful connection response uses authenticated request and abort signal", async () => {
  let called=0;
  const result=await testAiModelConnection({model_id:'qa-model'}, {timeoutMs:100,fetcher:async(url,options)=>{
    called++;assert.equal(url,'/api/v1/ai-model-connection-tests');assert.equal(options.credentials,'same-origin');
    assert.ok(options.signal instanceof AbortSignal);return {ok:true,json:async()=>({status:'READY'})};
  }});
  assert.equal(result.status,'READY');assert.equal(called,1);
});
for (const stage of ['fetch','json']) test(`stalled ${stage} releases deadline without retry`, async () => {
  let calls=0,signal;
  await assert.rejects(testAiModelConnection({}, {timeoutMs:15,fetcher:async(_url,options)=>{
    calls++;signal=options.signal;
    if(stage==='fetch')return new Promise(()=>{});
    return {ok:true,json:()=>new Promise(()=>{})};
  }}),{code:'CONNECTION_TEST_TIMEOUT'});
  assert.equal(calls,1);assert.equal(signal.aborted,true);
});
test("unsafe server error text is never propagated as a code", async () => {
  await assert.rejects(testAiModelConnection({}, {timeoutMs:100,fetcher:async()=>({ok:false,status:503,json:async()=>({detail:{code:'unsafe error text'}})})}),{code:'HTTP_503'});
});
test("invalid deadlines never dispatch requests", async () => {
  for(const timeoutMs of [0,-1,NaN,Infinity])await assert.rejects(testAiModelConnection({}, {timeoutMs,fetcher:()=>assert.fail('dispatched')}),TypeError);
});
