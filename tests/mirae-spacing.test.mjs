import test from 'node:test';
import assert from 'node:assert/strict';
import {checkMiraeExamples} from '../src/mirae-spacing.mjs';
test('미래엔 사전 검수 사례는 문맥 확인으로 표시한다',()=>{
 const hits=checkMiraeExamples('그 다음날 꽃가게.');
 assert.deepEqual(hits.map(x=>x.to),['그다음 날','꽃 가게']);
 assert.ok(hits.every(x=>x.level==='review'));
});
test('단어 안의 문자열은 잘못 검사하지 않는다',()=>{
 assert.equal(checkMiraeExamples('작은꽃가게에서').length,0);
});
