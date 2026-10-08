import {Garu} from 'garu-ko';
import {loadHeadwords} from './dictionary-bridge.js';
import {verifyMorphology} from './morphology.mjs';
import {createProofreader} from './proofreader.mjs';
let checker=null;
let ready;
function initialize(dictionaryUrl){return (async()=>{
  const results=await Promise.allSettled([Garu.load(),loadHeadwords(dictionaryUrl)]);
  const [g,d]=results;
  const diagnostics={garu:false,dictionary:d.status==='fulfilled',count:d.status==='fulfilled'?d.value.size:0,rows:d.status==='fulfilled'?d.value.data.rowCount:0};
  try {
    if(g.status==='rejected')throw g.reason;
    diagnostics.smoke=verifyMorphology(g.value);diagnostics.garu=true;
    if(d.status==='rejected')throw d.reason;
    checker=createProofreader({lexicon:d.value,morphology:g.value});
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
