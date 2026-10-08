import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Lexicon} from '../src/lexicon.mjs';
import {createDictionaryFallback} from '../src/dictionary-fallback.mjs';
const lex=new Lexicon(JSON.parse(fs.readFileSync(new URL('../public/data/stdict-lexicon.json',import.meta.url),'utf8')));
const checker=createDictionaryFallback(lex);
test('dictionary-only fallback checks all adjacent noun pairs, not just hardcoded phrases',()=>{
 const hits=checker.check('이것 저것을 확인했다.');
 assert.ok(hits.some(h=>h.from==='이것 저것을'&&h.to==='이것저것을'));
});
test('dictionary-only fallback checks counter spacing',()=>{
 assert.ok(checker.check('책 몇권을 읽었다.').some(h=>h.from==='몇권을'&&h.to==='몇 권을'));
});
test('fallback does not pretend to validate predicate compounds',()=>{
 assert.ok(!checker.check('돌아 오다.').some(h=>h.from==='돌아 오다'));
});
test('falling back never treats an established headword as a spelling error',()=>{
 assert.ok(!checker.check('이것저것.').some(h=>h.from==='이것저것'));
});
