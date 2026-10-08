import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Lexicon} from '../src/lexicon.mjs';
const data=JSON.parse(readFileSync(new URL('../public/data/stdict-lexicon.json',import.meta.url)));
const lex=new Lexicon(data);
test('all imported entries retained and indexed',()=>{assert.equal(lex.data.entries.length,436587);assert.equal(lex.size,283354)});
test('candidate discovery derives from dictionary, not a typo whitelist',()=>{
 assert(lex.suggest('일일히').includes('일일이'));
 assert(lex.suggest('머리속').includes('머릿속'));
 assert(lex.suggest('아릅답다').includes('아름답다'));
});
test('valid words and unknown tokens are not automatically declared errors',()=>{
 assert.deepEqual(lex.suggest('학생'),[]);
 assert.deepEqual(lex.suggest('오랫만'),[]); // Both variants exist in source; normative labels still needed.
});
