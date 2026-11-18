const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createSubmission}=require('../assets/form.js');
const data={name:'Тест',contact:'test@example.com',description:'Ізольована перевірка форми'};
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
test('only matching readable acceptance succeeds',async()=>{
  const calls=[];
  const submit=createSubmission({uuid:()=> 'request-1',fetchImpl:async(url,options)=>{calls.push(options);return response({accepted:true,request_id:options.body.get('request_id')});}});
  assert.equal((await submit(data)).status,'accepted');assert.equal(calls.length,1);assert.equal(calls[0].mode,undefined);assert.equal(calls[0].body.get('contact'),data.contact);
});
for(const [label,body] of [['generic 200',{success:true}],['wrong ID',{accepted:true,request_id:'wrong'}],['explicit rejection',{accepted:false,request_id:'request-1'}]])test(label+' is uncertain, not success',async()=>{
  const submit=createSubmission({uuid:()=> 'request-1',fetchImpl:async()=>response(body)});assert.equal((await submit(data)).status,'unknown');
});
for(const code of [400,422,500,503])test(`readable ${code} reports error with no retry`,async()=>{let calls=0;const submit=createSubmission({fetchImpl:async()=>{calls++;return response({error:'failure'},code);}});assert.equal((await submit(data)).status,'error');assert.equal(calls,1);});
test('network/CORS failure makes one attempt',async()=>{let calls=0;const submit=createSubmission({fetchImpl:async()=>{calls++;throw new TypeError('Failed to fetch');}});assert.equal((await submit(data)).status,'unknown');assert.equal(calls,1);});
test('opaque response never succeeds',async()=>{const submit=createSubmission({fetchImpl:async()=>({type:'opaque'})});assert.equal((await submit(data)).status,'unknown');});
test('invalid JSON and empty 200 never succeed',async()=>{for(const text of ['','OK','not json']){const submit=createSubmission({fetchImpl:async()=>new Response(text)});assert.equal((await submit(data)).status,'unknown');}});
test('timeout bounds fetch and body reading',async()=>{
  for(const fetchImpl of [()=>new Promise(()=>{}),async()=>({ok:true,json:()=>new Promise(()=>{})})]){
    const submit=createSubmission({fetchImpl,timeoutMs:20});const start=Date.now();assert.equal((await submit(data)).status,'timeout');assert.ok(Date.now()-start<500);
  }
});
test('double click suppressed; uncertain retry keeps ID; changed payload gets new ID',async()=>{
  let release,calls=0,ids=0;const seen=[];
  const submit=createSubmission({uuid:()=>`request-${++ids}`,fetchImpl:(url,options)=>{calls++;seen.push(options.body.get('request_id'));if(calls===1)return new Promise(resolve=>{release=()=>resolve(response({unexpected:true}));});return Promise.resolve(response({unexpected:true}));}});
  const pending=submit(data);assert.equal((await submit(data)).status,'busy');release();assert.equal((await pending).status,'unknown');await submit(data);await submit({...data,description:'Інша задача для перевірки'});assert.deepEqual(seen,['request-1','request-1','request-2']);assert.equal(data.name,'Тест');
});
test('a new identical submission after acceptance gets a fresh ID',async()=>{
  let i=0;const submit=createSubmission({uuid:()=>`id-${++i}`,fetchImpl:async(url,options)=>response({accepted:true,request_id:options.body.get('request_id')})});
  const first=await submit(data),second=await submit(data);assert.equal(first.status,'accepted');assert.equal(second.status,'accepted');assert.notEqual(first.requestId,second.requestId);
});
