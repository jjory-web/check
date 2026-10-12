import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Garu} from 'garu-ko';
import {Lexicon} from '../src/lexicon.mjs';
import {createProofreader} from '../src/proofreader.mjs';
const data=JSON.parse(readFileSync(new URL('../public/data/stdict-lexicon.json',import.meta.url)));
const checker=createProofreader({lexicon:new Lexicon(data),morphology:await Garu.load()});
function apply(text,hits){for(const h of [...hits].reverse()) {assert.equal(text.slice(h.start,h.end),h.from);text=text.slice(0,h.start)+h.to+text.slice(h.end);}return text;}
for(const [before,after] of [
  ['몇일전 부터 기다렸다.','며칠 전부터 기다렸다.'],
  ['몆일전 부터 기다렸다.','며칠 전부터 기다렸다.'],
  ['몇일전부터 기다렸다.','며칠 전부터 기다렸다.'],
  ['몆일전부터 기다렸다.','며칠 전부터 기다렸다.'],
  ['며칠전 부터 기다렸다.','며칠 전부터 기다렸다.'],
  ['며칠전부터 기다렸다.','며칠 전부터 기다렸다.'],
  ['몇일 후에 보자.','며칠 후에 보자.'],
  ['몆일후에 보자.','며칠 후에 보자.'],
  ['😀 몆일전 부터 기다렸다.','😀 며칠 전부터 기다렸다.'],
])test('combined spelling and spacing: '+before,()=>{const h=checker.check(before);assert.equal(apply(before,h),after);assert.deepEqual(checker.check(after),[]);});
for(const s of ['며칠 전부터 기다렸다.','이틀 후에 만나자.','대중 앞에서 말했다.','마음이 설레였다.'])
  test('no unrelated multi-stage hit: '+s,()=>assert(!checker.check(s).some(h=>h.id==='compound_norm_spacing'),s));
