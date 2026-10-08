import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Lexicon} from '../src/lexicon.mjs';
import {createDictionaryFallback} from '../src/dictionary-fallback.mjs';
const lex=new Lexicon(JSON.parse(fs.readFileSync(new URL('../public/data/stdict-lexicon.json',import.meta.url),'utf8')));
const checker=createDictionaryFallback(lex);
test('compound joined across adjacent nouns with a particle',()=>{
 const hits=checker.check('이것 저것을 확인해 보았다.');
 assert.ok(hits.some(h=>h.from==='이것 저것을'&&h.to==='이것저것을'));
});
test('punctuation and newlines are not joined',()=>{
 for(const text of ['이것, 저것을','이것\n저것을']){
  assert.ok(!checker.check(text).some(h=>h.id==='dictionary_compound'));
 }
});
test('well-formed compound is not flagged',()=>{
 assert.equal(checker.check('이것저것을').length,0);
});
test('predicate compound is not auto-joined in limited mode',()=>{
 assert.ok(!checker.check('돌아 오다.').some(h=>h.id==='dictionary_compound'));
});
