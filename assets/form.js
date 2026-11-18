/* One readable acknowledgement is required. Server contract: docs/form-contract.md. */
(function(root){
  'use strict';
  const WEBHOOK='https://n8n.myproject.pp.ua/webhook/b591e01e-c6ff-4fcf-843d-28cb282f8fba';
  function createSubmission({fetchImpl=globalThis.fetch,timeoutMs=8000,uuid=()=>globalThis.crypto.randomUUID()}={}){
    let inFlight=false,lastPayload='',requestId='';
    return async function submit(data){
      if(inFlight)return {status:'busy'};
      const payload=JSON.stringify(data);
      if(payload!==lastPayload){requestId=uuid();lastPayload=payload;}
      inFlight=true;
      const controller=new AbortController();
      let timer;
      try{
        const result=await Promise.race([
          (async()=>{
            const response=await fetchImpl(WEBHOOK,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...data,request_id:requestId}),signal:controller.signal});
            if(response.type==='opaque')return {status:'unknown',requestId};
            if(!response.ok)return {status:'error',requestId,httpStatus:response.status};
            const body=await response.json();
            return body.accepted===true&&body.request_id===requestId?{status:'accepted',requestId}:{status:'unknown',requestId};
          })(),
          new Promise(resolve=>{timer=setTimeout(()=>{controller.abort();resolve({status:'timeout',requestId});},timeoutMs);})
        ]);
        if(result.status==='accepted'){lastPayload='';requestId='';}
        return result;
      }catch(error){return {status:'unknown',requestId};}
      finally{clearTimeout(timer);inFlight=false;}
    };
  }
  const api={createSubmission};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.PortfolioForm=api;
})(typeof window==='undefined'?globalThis:window);
