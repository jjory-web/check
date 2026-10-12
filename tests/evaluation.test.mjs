// 정확도 회귀 방지: 평가 코퍼스의 교정률·오검출 하한선.
// 평가 문장은 엔진 코드에 하드코딩하지 않는다. 블라인드 세트는 측정 전용이라 하한선을 두지 않는다.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Garu} from 'garu-ko';
import {Lexicon} from '../src/lexicon.mjs';
import {createProofreader} from '../src/proofreader.mjs';
const lexicon=new Lexicon(JSON.parse(readFileSync(new URL('../public/data/stdict-lexicon.json',import.meta.url))));
const checker=createProofreader({lexicon,morphology:await Garu.load()});
const apply=(t,hits)=>{for(const h of [...hits].reverse())t=t.slice(0,h.start)+h.to+t.slice(h.end);return t;};
for(const [file,floor] of [['eval-corpus',0.85],['eval-holdout',0.85]]){
  const c=JSON.parse(readFileSync(new URL(`fixtures/${file}.json`,import.meta.url)));
  test(`${file}: exact correction rate ≥ ${floor*100}%`,()=>{
    const ok=c.errors.filter(([i,e])=>apply(i,checker.check(i))===e).length;
    assert(ok/c.errors.length>=floor,`${ok}/${c.errors.length}`);
  });
  test(`${file}: no error-level hit on correct sentences`,()=>{
    const bad=c.correct.filter(s=>checker.check(s).some(h=>h.level==='error'));
    assert.deepEqual(bad,[]);
  });
}
// 요청(2026-10-10): 짧은 글에서 잡히던 것이 긴 글에서 빠지면 안 된다(문장 단위 분석).
test('results do not depend on text length: every hit of a sentence alone is found inside a long paragraph',()=>{
  const sets=['eval-corpus','eval-holdout'].map(f=>JSON.parse(readFileSync(new URL(`fixtures/${f}.json`,import.meta.url))));
  const errs=sets.flatMap(c=>c.errors.map(e=>e[0])),fill=sets.flatMap(c=>c.correct);
  let text='';const spans=[];
  errs.forEach((e,i)=>{text+=fill[i%fill.length]+' ';spans.push([text.length,e]);text+=e+' ';});
  text=text.repeat(3); // ~7,000 characters on one line
  const hits=checker.check(text),lost=[];
  for(const [start,sentence] of spans){
    const inLong=hits.filter(h=>h.start>=start&&h.end<=start+sentence.length).map(h=>h.from+'→'+h.to);
    for(const h of checker.check(sentence))if(!inLong.includes(h.from+'→'+h.to))lost.push(sentence+' : '+h.from+'→'+h.to);
  }
  assert.deepEqual(lost,[]);
});
// 한 문장 자체가 길어도(쉼표로 이어진 150자 이상) 단독 문장에서 '오류'로 잡히던 것은 그대로 잡혀야 한다.
test('results do not depend on sentence length: error-level hits survive inside one long sentence',()=>{
  const sets=['eval-corpus','eval-holdout'].map(f=>JSON.parse(readFileSync(new URL(`fixtures/${f}.json`,import.meta.url))));
  const clauses=sets.flatMap(c=>c.errors.map(e=>e[0].replace(/[.]$/,''))),lost=[];
  for(let i=0;i<clauses.length;i+=12){
    let text='';const spans=[];
    for(const g of clauses.slice(i,i+12)){spans.push([text.length,g]);text+=g+', ';}
    text=text.replace(/, $/,'.');
    const hits=checker.check(text);
    for(const [start,g] of spans){
      const inLong=hits.filter(h=>h.start>=start&&h.end<=start+g.length).map(h=>h.from+'→'+h.to);
      for(const h of checker.check(g+'.'))if(h.level==='error'&&!inLong.includes(h.from+'→'+h.to))lost.push(g+' : '+h.from+'→'+h.to);
    }
  }
  assert.deepEqual(lost,[]);
});
