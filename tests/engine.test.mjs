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
const negative=['책 한 권','책 두 권','연필 세 자루','사람 다섯 명','아는 만큼 보인다.','도와줬다','다 먹었다','먹었다 다','우리 집','좋은 사람','예쁜 꽃','살펴보았다','뛰어넘었다','들여다보았다','먹어 보았다.','읽어 보았다.','할 수 있다.','먹을 만큼 먹었다.','학생뿐이다.','학교에 갔다.','할수록','하는데','수많은 사람이 왔다.','엉망\n진창','살펴, 보았다','ABC살펴 보았다','살펴 보았다ABC','엉망진창','책을 읽고 있다.','나는 학생이다.'];
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

// ---- 판정 대원칙(P0~P4) ----
// 정책 변경(2026-10-09): '사전에 한 단어로 등재된 경우 다른 규칙은 판정을 막지 못하고 문맥 확인으로 낮추기만 한다.'
// 따라서 큰 집(큰-집), 한 번(한-번)은 '제안 없음'이 아니라 '문맥 확인' 등급으로 제시되며, 오류로 단정하지 않는다.
for(const [input,word] of [['큰 집','큰집'],['한 번','한번'],['작은 집에서 살았다.','작은집에서']])test('dictionary compound with a grammatical alternative is review, never error: '+input,()=>{
 const h=checker.check(input);assert.equal(h.length,1);assert.equal(h[0].to,word);assert.equal(h[0].level,'review');assert.match(h[0].reason,/문맥/);
});
const levelOf=(s)=>checker.check(s).map(h=>[h.from,h.to,h.level]);
test('P0: dictionary-nonstandard headwords are errors even though they are headwords',()=>{
 assert.deepEqual(levelOf('몇일 동안 기다렸다.')[0],['몇일','며칠','error']);
 assert.deepEqual(levelOf('이 컨텐츠를 보라.')[0],['컨텐츠를','콘텐츠를','error']);
 assert.deepEqual(levelOf('오랫만에 왔다.')[0],['오랫만에','오랜만에','error']);
 assert.deepEqual(levelOf('웬지 좋다.')[0],['웬지','왠지','error']);
});
test('P0: particle allomorph follows the corrected word',()=>{
 assert.equal(checker.check('몇일이 지났다.')[0].to,'며칠이');
});
test('P0: conjugated nonstandard predicates are rebuilt, never replaced by a bare lemma',()=>{
 assert.equal(checker.check('마음이 설레였다.')[0].to,'설레었다');
 for(const h of checker.check('마음이 설레였다.'))assert.notEqual(h.to,'설레다');
});
test('P0: a spelling with any standard homonym is not an error (대중, 반대)',()=>{
 for(const s of ['대중 앞에서 말했다.','그 의견에 반대한다.'])assert.deepEqual(checker.check(s),[],s);
});
test('P0: standard word + particle wins over a nonstandard headword of the same spelling (안 + 이 ≠ 안이→아니)',()=>{
 assert.deepEqual(checker.check('방 안이 넓다.'),[]);
});
test('P1: joining needs the dictionary compound mark at the space (방 안 ≠ 방안 方案)',()=>{
 for(const s of ['방 안이 넓다.','책을 세 권 빌렸다.','열 시에 만나자.'])assert(!checker.check(s).some(h=>h.id==='dict_compound'),s);
});
test('P1: a modifier must keep its noun (할 수 없다, 아무 말 없이)',()=>{
 for(const s of ['그 질문에 대답할 수 없었다.','그는 아무 말 없이 떠났다.'])assert.deepEqual(checker.check(s),[],s);
});
test('P1: 살펴 보다 is detected; auxiliary-like structure only lowers the level',()=>{
 const h=checker.check('살펴 보다');assert.equal(h[0].to,'살펴보다');assert.equal(h[0].level,'review');
 assert.equal(checker.check('엉망 진창')[0].level,'error');
});
test('P2: particles including the copula attach to the preceding word',()=>{
 assert.equal(checker.check('그녀는 웃을 뿐 이었다.')[0].to,'뿐이었다');
 assert.equal(checker.check('학생들 마다 다르다.')[0].to,'학생들마다');
});
test('P3: words that are not one dictionary word are spaced',()=>{
 assert.equal(checker.check('열두시에 만나자.')[0].to,'열두 시에');
 assert.equal(checker.check('김철수씨가 왔다.')[0].to,'김철수 씨가');
 assert.equal(checker.check('모든것이 끝났다.')[0].to,'모든 것이');
 assert.equal(checker.check('3개월동안 공부했다.')[0].to,'3개월 동안');
});
test('P3: -아/어지다 and -아/어하다 stay attached (제47항 해설)',()=>{
 for(const s of ['날이 어두워졌다.','이 책은 잘 만들어졌다.','그는 기뻐했다.'])assert.deepEqual(checker.check(s),[],s);
});
test('P3: 사이시옷 compound in the dictionary (머리속 → 머릿속)',()=>{
 assert.equal(checker.check('머리속이 복잡하다.')[0].to,'머릿속이');
});
test('P4: spelling candidates never turn a conjugated verb into its lemma',()=>{
 assert.deepEqual(checker.check('그 사람을 본 지 오래되었다.'),[]);
});
test('every hit carries a level and a principle id',()=>{
 for(const h of checker.check('몇일 동안 살펴 보았다. 학교 에 갔다. 할수있다.')){assert(['error','review','principle'].includes(h.level));assert.match(h.principle,/^P[0-4]$/);}
});
// 요청(2026-10-10): 조사가 붙은 어절과 뒤 어절은 띄어 쓴다.
test('P3: a word ending in a particle is spaced from the next word',()=>{
 for(const [s,to] of [['학교에가다.','학교에 가다'],['밥을먹었다.','밥을 먹었다'],['친구와함께 갔다.','친구와 함께'],['나는학생이다.','나는 학생이다'],['엄마랑나랑 갔다.','엄마랑 나랑']]){
  const h=checker.check(s);assert.equal(h[0]?.to,to,s);assert.equal(h[0].level,'error');
 }
});
test('P3: consecutive particles and dictionary words containing particles are not split',()=>{
 for(const s of ['학교에서부터 걸었다.','나보다 크다.','사람들은커녕 아무도 없다.','이를테면 그렇다.','왜냐하면 비가 왔다.'])assert.deepEqual(checker.check(s),[],s);
});
// 요청(2026-10-10): '나다' — 사전에 한 단어로 없으면 띄어 쓰고(소리 나다), 있으면 붙여 쓴다(화나다).
test('나다: noun + 나다 not in the dictionary is spaced',()=>{
 for(const [s,to] of [['라디오에서 소리났다.','소리 났다'],['기계가 고장났다.','고장 났다'],['짜증나서 그만두었다.','짜증 나서'],['결론났다.','결론 났다'],['눈물나는 이야기','눈물 나는']]){
  const h=checker.check(s).find(x=>x.to===to);assert(h,s);assert.equal(h.level,'error');
 }
});
test('나다: compounds in the dictionary are joined, and stay joined',()=>{
 for(const [s,to] of [['화 났다.','화났다'],['생각 났다.','생각났다'],['기억 나지 않는다.','기억나지']])assert.equal(checker.check(s)[0]?.to,to,s);
 for(const s of ['화났다.','생각났다.','기억나지 않는다.','신나게 놀았다.','혼났다.','나답게 살자.','나같이 해라.'])assert.deepEqual(checker.check(s),[],s);
});
test('나가다 as an auxiliary: spaced is the principle, joined is allowed (principle level only)',()=>{
 assert.equal(checker.check('이끌어나가다')[0].level,'principle');
 assert.deepEqual(checker.check('이끌어 나가다'),[]);
});
test('registered noun+verb compounds written joined are not split',()=>{
 for(const s of ['힘들었다.','마음먹었다.','춤추었다.','뜻깊은 날','앞장섰다.','배고팠다.'])assert.deepEqual(checker.check(s),[],s);
});
