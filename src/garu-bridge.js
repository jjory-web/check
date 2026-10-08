// Keep WASM + dictionary processing off the editor's main thread.
const worker=new Worker(new URL('./engine-worker.js',import.meta.url),{type:'module'});
worker.postMessage({type:'init',dictionaryUrl:new URL('data/stdict-lexicon.json',document.baseURI).href});
let sequence=0,timer,latest='',inFlight=false,pending=null,ready=false,fatalError=null;
function send(){if(!ready||inFlight||!pending)return;inFlight=true;worker.postMessage(pending);pending=null;}
worker.onmessage=({data})=>{
  if(data.type==='ready'){
    ready=true;window.setEngineDiagnostics?.(data.diagnostics);
    window.requestProofreading?.(document.getElementById('editor').value,true);send();
  }else if(data.type==='result'){
    inFlight=false;
    if(data.id===sequence&&data.text===latest)window.setEngineFindings?.(data);
    send();
  }
};
worker.onerror=()=>{ready=false;fatalError='분석 작업 실패';window.setEngineDiagnostics?.({garu:false,error:'분석 작업을 실행하지 못했습니다. 새로고침 후 다시 확인하세요.'});window.setEngineFindings?.({text:latest,hits:[],error:'분석 작업 실패'});};
window.requestProofreading=(text,force=false)=>{
  if(!force&&text===latest)return;
  latest=text;sequence++;clearTimeout(timer);
  pending=null;
  if(fatalError){queueMicrotask(()=>window.setEngineFindings?.({text:latest,hits:[],error:fatalError}));return;}
  timer=setTimeout(()=>{pending={type:'check',id:sequence,text:latest};send();},150);
};
window.requestProofreading(document.getElementById('editor').value,true);
