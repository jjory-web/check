// 검출률·오검출률 측정: node scripts/evaluate.mjs [corpus.json] [--verbose]
// EVAL_ENGINE=다른/src/ 경로, EVAL_DICT=다른 사전 JSON 으로 이전 버전과 비교할 수 있다.
// tests/fixtures/eval-corpus.json의 정답 문장으로 엔진을 평가한다.
import {readFileSync} from 'node:fs';
import {Garu} from 'garu-ko';

const root=new URL('../',import.meta.url);
const corpusPath=process.argv.find(a=>a.endsWith('.json'))||'tests/fixtures/eval-corpus.json';
const corpus=JSON.parse(readFileSync(new URL(corpusPath,root)));
const dictPath=process.env.EVAL_DICT||'public/data/stdict-lexicon.json';
const engineDir=process.env.EVAL_ENGINE||'../src/';
const {Lexicon}=await import(new URL(engineDir+'lexicon.mjs',import.meta.url));
const {createProofreader}=await import(new URL(engineDir+'proofreader.mjs',import.meta.url));
const lexicon=new Lexicon(JSON.parse(readFileSync(new URL(dictPath,root))));
const checker=createProofreader({lexicon,morphology:await Garu.load()});
const verbose=process.argv.includes('--verbose');
const apply=(text,hits)=>{for(const h of [...hits].reverse())text=text.slice(0,h.start)+h.to+text.slice(h.end);return text;};
const show=hits=>hits.map(h=>`${h.from}→${h.to}[${h.level}]`).join(' ; ')||'(없음)';

let detected=0,corrected=0;const byPrinciple={};
for(const [input,expected,principle] of corpus.errors){
  const hits=checker.check(input),out=apply(input,hits);
  const ok=out===expected,hit=hits.length>0;
  detected+=hit;corrected+=ok;
  const p=byPrinciple[principle]??={n:0,ok:0};p.n++;p.ok+=ok;
  if(verbose||!ok)console.log(`${ok?'✔':hit?'△':'✘'} ${input}  =>  ${show(hits)}${ok?'':'   (정답: '+expected+')'}`);
}
const fp={error:0,review:0,principle:0};let anyFP=0;
for(const s of corpus.correct){
  const hits=checker.check(s);
  if(hits.length)anyFP++;
  for(const lv of Object.keys(fp))if(hits.some(h=>h.level===lv))fp[lv]++;
  if(hits.length)console.log(`! ${s}  =>  ${show(hits)}`);
}
const pct=(a,b)=>(100*a/b).toFixed(1)+'%';
const E=corpus.errors.length,C=corpus.correct.length;
console.log('\n== 결과 ==');
console.log(`오류 문장 ${E}개: 검출 ${detected} (${pct(detected,E)}), 정답과 똑같이 교정 ${corrected} (${pct(corrected,E)})`);
console.log('원칙별 교정:',Object.entries(byPrinciple).map(([k,v])=>`${k} ${v.ok}/${v.n}`).join(', '));
console.log(`올바른 문장 ${C}개: 표시된 문장 ${anyFP} (${pct(anyFP,C)}) — 오류 등급 ${fp.error}, 문맥 확인 ${fp.review}, 원칙 권장 ${fp.principle}`);
