import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Garu} from 'garu-ko';
import {Lexicon,normalizeHeadword} from '../src/lexicon.mjs';
import {verifyMorphology,analyzeUTF16} from '../src/morphology.mjs';
import {createProofreader} from '../src/proofreader.mjs';
const data=JSON.parse(readFileSync(new URL('../public/data/stdict-lexicon.json',import.meta.url)));
const lexicon=new Lexicon(data),morphology=await Garu.load(),checker=createProofreader({lexicon,morphology});
test('all 15 XLS sheets and all 436,587 source rows retained',()=>{
 assert.equal(data.files.length,15);assert.equal(data.rowCount,436587);assert.equal(data.entries.length,data.rowCount);
 assert.equal(data.files.reduce((s,f)=>s+f.rows,0),data.rowCount);
 assert.deepEqual(data.unitCounts,{'관용구':3886,'구':63010,'단어':362255,'속담':7436});
});
test('homonyms, POS and irregular inflections are preserved; ^ is not flattened',()=>{
 assert.equal(normalizeHeadword('살펴-보다(01)'),'살펴보다');
 assert.equal(normalizeHeadword('암모늄^명반'),'암모늄 명반');
 assert(lexicon.hasPOS('보다','보조 동사'));assert(lexicon.hasPOS('수','의존 명사'));
 assert(lexicon.forms.get('도와').has('돕다'));assert(!lexicon.has('암모늄명반'));
});
test('real Garu WASM POS and Unicode offset smoke check',()=>{assert(verifyMorphology(morphology).tokens>0);});
test('emoji/CRLF offsets map to original UTF-16 manuscript',()=>{
 const s='😀\r\n  학생이 글을 읽었다.';const ts=analyzeUTF16(morphology,s).tokens;
 assert(ts.some(t=>t.text==='학생'&&s.slice(t.start,t.end)==='학생이'));
});
const positive=[
 ['먹어버렸다','먹어 버렸다'],['꺼져간다','꺼져 간다'],['웃고있다','웃고 있다'],['먹지않았다','먹지 않았다'],['하지마라','하지 마라'],['가는듯하다','가는 듯하다'],['먹을만하다','먹을 만하다'],['공부해보았다','공부해 보았다'],['사과를 먹을수있었다.','사과를 먹을 수 있었다.'],
 ['먹 었다','먹었다'],['먹었 다','먹었다'],['아름 다웠다','아름다웠다'],['어려 워서','어려워서'],['할때','할 때'],['먹을때','먹을 때'],
 ['엉망 진창','엉망진창'],['엉망 진창이었다.','엉망진창이었다.'],
 ['살펴 보았다','살펴보았다'],['살펴 보았겠지만','살펴보았겠지만'],['살펴 봤다','살펴봤다'],
 ['뛰어 넘었다','뛰어넘었다'],['뛰어 넘었겠지만','뛰어넘었겠지만'],['들여다 보았다','들여다보았다'],
 ['돌아 보니','돌아보니'],['사과 나무를','사과나무를'],['손 수건','손수건'],
 ['읽어보았다','읽어 보았다'],['먹어보았다','먹어 보았다'],['말해줬다','말해 줬다'],
 ['먹고싶다','먹고 싶다'],['할수있다','할 수 있다'],['할 수있다','할 수 있다'],
 ['표현하는것이 중요하다.','표현하는 것이 중요하다.'],['읽을것을 가져왔다.','읽을 것을 가져왔다.'],
 ['학교 에 갔다','학교에 갔다'],['학생 뿐이다','학생뿐이다'],['나 는 학생이다.','나는 학생이다.'],
 ['😀\r\n  살펴 보았다.','😀\r\n  살펴보았다.'],['“엉망\t진창”','“엉망진창”'],
];
function apply(text,hits){for(const h of [...hits].reverse()){assert.equal(text.slice(h.start,h.end),h.from);text=text.slice(0,h.start)+h.to+text.slice(h.end);}return text;}
for(const [input,expected]of positive)test('detect: '+input,()=>{const hits=checker.check(input);assert.equal(apply(input,hits),expected);assert(hits.every(h=>h.review));});
const negative=['책 한 권','책 두 권','연필 세 자루','사람 다섯 명','아는 만큼 보인다.','도와줬다','다 먹었다','먹었다 다','큰 집','한 번','우리 집','좋은 사람','예쁜 꽃','작은 집에서 살았다.','살펴보았다','뛰어넘었다','들여다보았다','먹어 보았다.','읽어 보았다.','할 수 있다.','먹을 만큼 먹었다.','학생뿐이다.','학교에 갔다.','할수록','하는데','수많은 사람이 왔다.','엉망\n진창','살펴, 보았다','ABC살펴 보았다','살펴 보았다ABC','엉망진창','책을 읽고 있다.','나는 학생이다.'];
for(const input of negative)test('protect: '+input,()=>assert.deepEqual(checker.check(input),[]));
test('all repeated occurrences have independent exact spans',()=>{
 const s='😀 엉망 진창.\n엉망 진창!';let h=checker.check(s);assert.equal(h.length,2);assert.deepEqual(h.map(x=>x.start),[3,10]);assert.equal(apply(s,h),'😀 엉망진창.\n엉망진창!');
});
test('applied suggestions do not oscillate',()=>{for(const [s]of positive){const fixed=apply(s,checker.check(s));assert.deepEqual(checker.check(fixed),[],fixed);}});
test('auxiliary output is recommendation, not an assertion that permitted spelling is wrong',()=>{assert.equal(checker.check('읽어보았다')[0].kind,'principle');});
test('dictionary candidate never claims dictionary membership proves an error',()=>{const h=checker.check('돌아 보니')[0];assert.equal(h.kind,'review');assert(h.reason.includes('문맥'));});

test('long multi-paragraph manuscript keeps every offset',()=>{
 const text='😀 학생이 글을 읽었다. 엉망 진창인 방을 살펴 보았다.\r\n'.repeat(100);
 const hits=checker.check(text);assert.equal(hits.length,200);for(const h of hits)assert.equal(text.slice(h.start,h.end),h.from);
});
test('long single paragraph chunk boundaries preserve spans',()=>{
 const text='학생이 글을 읽었다. 엉망 진창인 방을 살펴 보았다. '.repeat(100);
 const hits=checker.check(text);assert.equal(hits.length,200);for(const h of hits)assert.equal(text.slice(h.start,h.end),h.from);
});
