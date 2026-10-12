import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Garu} from 'garu-ko';
import {Lexicon} from '../src/lexicon.mjs';
import {createProofreader} from '../src/proofreader.mjs';
const data=JSON.parse(readFileSync(new URL('../public/data/stdict-lexicon.json',import.meta.url))); const checker=createProofreader({lexicon:new Lexicon(data),morphology:await Garu.load()});
for(const [input,expected] of [
 ['나는 비싼걸 사지 않았다.','비싼 걸'],
 ['비싼걸 사지 않았다.','비싼 걸'],
 ['지나간것 같습니다.','지나간 것'],
 ['나는 할줄 안다.','할 줄'],
 ['몆일전 부터 기다렸다.','며칠 전부터'],
])test('representative spacing: '+input,()=>{
 assert(checker.check(input).some(h=>h.to===expected),JSON.stringify(checker.check(input)));
});
for(const input of ['나는 비싼 걸 사지 않았다.','며칠 전부터 기다렸다.','먹을걸 그랬다.'])
 test('protect grammatical alternatives: '+input,()=>assert(!checker.check(input).some(h=>h.id==='dependent_noun_contraction')));
