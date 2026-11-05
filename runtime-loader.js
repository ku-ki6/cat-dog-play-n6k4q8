// Observe only this game's two pinned Ruffle modules; all other fetches are unchanged.
(() => {
  const sources={
    jsdelivr:'https://cdn.jsdelivr.net/npm/@ruffle-rs/ruffle@0.2.0-nightly.2026.4.1/',
    unpkg:'https://unpkg.com/@ruffle-rs/ruffle@0.2.0-nightly.2026.4.1/',
    local:new URL('assets/ruffle/',document.baseURI).href
  };
  const sizes={'d1aa79a4419ccda1bb84.wasm':13088093,'6e6cde8d04b39a8ac29d.wasm':14082180};
  const nativeFetch=window.fetch.bind(window);
  let choicePromise,status={source:null,received:0,total:0,downloadMs:null,error:null};
  const api={onProgress:null,status:()=>({...status}),prepare};
  window.PetRuntime=api;

  function prepare(){
    if(choicePromise)return choicePromise;
    choicePromise=(async()=>{
      const requested=new URLSearchParams(location.search).get('engine');
      if(Object.prototype.hasOwnProperty.call(sources,requested)){
        status.source=requested;return sources[requested];
      }
      const controllers=[];
      try{
        const key=await Promise.any(['jsdelivr','unpkg'].map(async key=>{
          const controller=new AbortController();controllers.push(controller);
          const timer=setTimeout(()=>controller.abort(),2500);
          try{
            const response=await nativeFetch(sources[key]+'d1aa79a4419ccda1bb84.wasm',{headers:{Range:'bytes=0-255'},signal:controller.signal});
            if(!response.ok)throw new Error('下载线路不可用');
            const reader=response.body.getReader(),{value}=await reader.read();
            reader.cancel().catch(()=>{});
            if(!value||value[0]!==0||value[1]!==97||value[2]!==115||value[3]!==109)throw new Error('运行组件响应无效');
            return key;
          }finally{clearTimeout(timer);}
        }));
        status.source=key;return sources[key];
      }catch{
        status.source='local';return sources.local;
      }finally{controllers.forEach(controller=>controller.abort());}
    })();
    return choicePromise;
  }

  window.fetch=async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,document.baseURI);
    const file=url.pathname.split('/').pop();
    if(!sizes[file]||!Object.values(sources).some(base=>url.href.startsWith(base))||(init?.method||input.method||'GET')!=='GET')return nativeFetch(input,init);
    const base=await prepare();
    const controller=new AbortController(),started=performance.now();
    let timer,lastUpdate=0;
    const clear=()=>clearTimeout(timer);
    const arm=()=>{
      clear();timer=setTimeout(()=>{status.error='运行组件下载超过 15 秒没有响应，请换线路重试';controller.abort();},15000);
    };
    const sourceSignal=init?.signal||input.signal;
    const abort=()=>controller.abort();
    if(sourceSignal?.aborted)controller.abort();
    else sourceSignal?.addEventListener('abort',abort,{once:true});
    const cleanup=()=>{clear();sourceSignal?.removeEventListener('abort',abort);};
    status={...status,received:0,total:sizes[file],downloadMs:null,error:null};
    arm();
    try{
      const target=input instanceof Request?new Request(new URL(file,base),input):new URL(file,base);
      const response=await nativeFetch(target,{...init,signal:controller.signal});
      if(!response.ok||!response.body){
        if(!response.ok)status.error=`运行组件下载失败（HTTP ${response.status}）`;
        cleanup();return response;
      }
      const reader=response.body.getReader();
      const body=new ReadableStream({
        async pull(stream){
          try{
            const {done,value}=await reader.read();
            if(done){
              cleanup();status.downloadMs=Math.round(performance.now()-started);
              api.onProgress?.({...status,done:true});stream.close();return;
            }
            arm();status.received+=value.byteLength;
            const now=performance.now();
            if(now-lastUpdate>100){lastUpdate=now;api.onProgress?.({...status,done:false});}
            stream.enqueue(value);
          }catch(error){cleanup();status.error=status.error||String(error.message||error);stream.error(error);}
        },
        cancel(reason){cleanup();controller.abort();return reader.cancel(reason);}
      });
      const headers=new Headers(response.headers);
      headers.delete('content-encoding');headers.delete('content-length');
      return new Response(body,{status:response.status,statusText:response.statusText,headers});
    }catch(error){cleanup();status.error=status.error||String(error.message||error);throw error;}
  };
})();
