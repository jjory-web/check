import {Garu} from 'garu-ko';
import {loadHeadwords} from './dictionary-bridge.js';
import {verifyMorphology} from './morphology.mjs';
import {createProofreader} from './proofreader.mjs';
import {createDictionaryFallback} from './dictionary-fallback.mjs';
let checker=null;
let ready;
function initialize(dictionaryUrl){return (async()=>{
  const results=await Promise.allSettled([Garu.load(),loadHeadwords(dictionaryUrl)]);
  const [g,d]=results;
  const diagnostics={garu:false,dictionary:d.status==='fulfilled',count:d.status==='fulfilled'?d.value.size:0,rows:d.status==='fulfilled'?d.value.data.rowCount:0};
  try {
    if(d.status==='rejected')throw d.reason;
    // A broken WASM response must not disable dictionary-only reviewing.
    checker=createDictionaryFallback(d.value);
    diagnostics.mode='dictionary-only';
    diagnostics.notice='형태소 분석기를 사용할 수 없어 사전 기반 제한 검사만 진행합니다. 검출되지 않은 표현도 오류가 없다는 의미가 아닙니다.';
    if(g.status==='rejected') diagnostics.garuError=String(g.reason?.message||g.reason);
    else {
      try {
        diagnostics.smoke=verifyMorphology(g.value);
        checker=createProofreader({lexicon:d.value,morphology:g.value});
        diagnostics.garu=true;
        diagnostics.mode='full';
        diagnostics.notice='';
      }catch(err){ diagnostics.garuError=String(err.message||err); }
    }
  }catch(error){diagnostics.error=String(error.message||error);}
  self.postMessage({type:'ready',diagnostics});
})();}
self.onmessage=async({data})=>{
  if(data.type==='init'){if(!ready)ready=initialize(data.dictionaryUrl);return;}
  if(data.type!=='check'||!ready)return;
  await ready;
  if(!checker){self.postMessage({type:'result',id:data.id,text:data.text,hits:[],error:'사전/형태소 엔진이 준비되지 않았습니다.'});return;}
  try{
    const start=performance.now(),hits=checker.check(data.text);
    self.postMessage({type:'result',id:data.id,text:data.text,hits,elapsedMs:performance.now()-start});
  }catch(error){self.postMessage({type:'result',id:data.id,text:data.text,hits:[],error:String(error.message||error)});}
};
