import {test} from 'node:test';
import assert from 'node:assert/strict';
import {manuscriptToDocx,docxEntries,docxFileName,manuscriptParagraphs} from '../src/docx-export.mjs';
import {unzip,docxParagraphs} from './helpers/docx-reader.mjs';

const sample='제1장 들어가며\r\n\r\n이 컨텐츠를 통해 학생들은 작품을 이해할 수 있다.\n두 칸  띄운 공백과\t탭, 특수문자 <>&"\' 😀\n\n\n마지막 문단';
test('docx is a valid ZIP with the required Word parts and correct CRCs',()=>{
  const files=unzip(manuscriptToDocx(sample));
  for(const part of ['[Content_Types].xml','_rels/.rels','word/document.xml','word/styles.xml','word/_rels/document.xml.rels'])assert(files.has(part),part);
  assert.match(files.get('[Content_Types].xml').toString(),/wordprocessingml\.document\.main\+xml/);
});
test('every line becomes one paragraph; blank lines, spaces and tabs are kept',()=>{
  assert.deepEqual(docxParagraphs(manuscriptToDocx(sample)),sample.split(/\r\n|\n/));
});
test('Korean text is stored as UTF-8 without loss',()=>{
  const xml=unzip(manuscriptToDocx('가나다 한글 원고')).get('word/document.xml').toString('utf8');
  assert(xml.includes('가나다 한글 원고'));assert(xml.startsWith('<?xml version="1.0" encoding="UTF-8"'));
});
test('only the manuscript text is written: no title, counts, sheets or check results',()=>{
  const text='원고 본문 한 줄';
  const paragraphs=docxParagraphs(manuscriptToDocx(text));
  assert.deepEqual(paragraphs,[text]);
  const all=[...unzip(manuscriptToDocx(text)).values()].map(b=>b.toString('utf8')).join('');
  for(const extra of ['글자 수','원고지','매','검토','교정','<w:hdr','<w:ftr','<w:comment','<w:ins','<w:del '])assert(!all.includes(extra),extra);
});
test('XML special and control characters cannot break the document',()=>{
  const paragraphs=docxParagraphs(manuscriptToDocx('a<b>&"c\u0007d\u000be'));
  assert.deepEqual(paragraphs,['a<b>&"cde']);
});
test('empty manuscript produces one empty paragraph',()=>{
  assert.deepEqual(docxParagraphs(manuscriptToDocx('')),['']);
  assert.deepEqual(manuscriptParagraphs(undefined),['']);
});
test('file name uses the local date and the .docx extension',()=>{
  assert.equal(docxFileName(new Date(2026,9,10,0,5)),'원고_2026-10-10.docx');
});
test('same text gives an identical file (no embedded timestamps)',()=>{
  assert.deepEqual(manuscriptToDocx(sample),manuscriptToDocx(sample));
  assert.equal(docxEntries(sample).length,5);
});
