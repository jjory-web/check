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
test('dictionary ambiguity is preserved (not silently called an error)',()=>{
  assert.ok(lex.has('오랫만'));
  assert.ok(lex.has('오랜만'));
});
