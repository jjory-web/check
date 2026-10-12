import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Lexicon} from '../src/lexicon.mjs';
const lex=new Lexicon(JSON.parse(fs.readFileSync(new URL('../public/data/stdict-lexicon.json',import.meta.url),'utf8')));
test('all dictionary records load and substantive POS survives',()=>{assert.equal(lex.data.rowCount,436587);assert.ok(lex.size>250000);});
test('whole dictionary suggests unattested spellings without fixed correction map',()=>{
  assert.ok(lex.suggestWithParticles('일일히').some(x=>x.word==='일일이'));
  assert.ok(lex.suggestWithParticles('머리속에서').some(x=>x.word==='머릿속에서'));
});
test('counter split is dictionary POS driven',()=>{
  assert.deepEqual(lex.findCounterSplit('몇권'),['몇','권']);
  assert.equal(lex.findCounterSplit('책권'),null);
});
// 정책 변경(2026-10-09): 사전 원본의 '→ 표준어' 표시를 추출하므로 데이터가 규범을 판정한다.
// 오랫만은 표제어이지만 비표준 표기, 오랜만은 표준 표기다.
test('dictionary normative data decides between headword variants',()=>{
  assert.ok(lex.isHeadword('오랫만'));
  assert.ok(!lex.has('오랫만'));
  assert.equal(lex.norm('오랫만').target,'오랜만');
  assert.ok(lex.has('오랜만'));
});
test('only spellings whose every homonym is nonstandard are nonstandard',()=>{
  assert.equal(lex.norm('대중'),null); // 대중(04) → 타이중, but 대중 '大衆' is standard
  assert.ok(lex.has('대중'));
  assert.ok(lex.nonstandardCount>5000);
});
test('ordinary words are not excluded by a definition mentioning 잘못',()=>{
  for(const w of ['비난','리콜','버그'])assert.ok(lex.has(w),w);
});
