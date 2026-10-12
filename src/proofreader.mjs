import {checkMiraeExamples} from './mirae-spacing.mjs';
import {analyzeUTF16} from './morphology.mjs';

/*
 * 판정 대원칙 (위에 있는 원칙이 우선한다)
 *
 *  P0 규범 표기   사전이 '→ 표준어'로 안내하는 표기(몇일, 컨텐츠…)는 표제어라도 틀린 표기다.
 *  P1 한 단어     띄어 쓴 어절을 붙인 형태가 사전 표제어(또는 그 활용형)이면 붙여 쓴다.
 *                 코드 규칙(관형어·수량 표현·보조 용언 구성 등)은 이 판정을 '막지' 못하고
 *                 '문맥 확인' 등급으로 낮추기만 한다.
 *  P2 조사        조사는 앞말에 붙여 쓴다.
 *  P3 단어 사이   사전에 한 단어로 없는 어절이 사전 등재어 두 개 이상으로 분석되면 띄어 쓴다
 *                 (의존 명사·단위 명사·보조 용언 포함).
 *  P4 철자 후보   사전에서 비슷한 표준 표기를 찾았을 때만 참고로 제시한다.
 *
 * 등급(level)
 *  error      근거가 명확한 오류 (규범 표기, 등재어 분리, 분리된 조사 등)
 *  review     사전 판정은 있으나 다른 구성일 가능성이 있어 문맥 확인이 필요
 *  principle  원칙 표기 권장. 허용 표기가 있으므로 원문을 오류로 단정하지 않음
 *
 * 같은 위치에 판정이 겹치면 priority가 낮은(=원칙 번호가 앞선) 것을 쓴다.
 */
export const PRINCIPLES=[
  {id:'P0',title:'규범 표기',rule:'사전이 비표준어·잘못된 표기로 안내하는 표제어는 틀린 표기로 본다.'},
  {id:'P1',title:'사전 등재어는 한 단어',rule:'붙인 형태가 사전 표제어이면 붙여 쓴다. 다른 규칙은 이를 막지 못하고 문맥 확인으로 낮추기만 한다.'},
  {id:'P2',title:'조사는 붙여 쓴다',rule:'조사는 앞말에 붙여 쓴다(한글 맞춤법 제41항).'},
  {id:'P3',title:'단어와 단어는 띄어 쓴다',rule:'사전에 한 단어로 없는 결합은 각 단어를 띄어 쓴다(제2항·제42항·제43항·제47항).'},
  {id:'P4',title:'철자 후보',rule:'사전에서 찾은 유사 표준 표기를 참고로 제시한다.'},
];
export const PRIORITY={norm:0,join:1,particle:2,split:3,candidate:4};
const LABEL={error:'규범·띄어쓰기 오류',review:'문맥 확인',principle:'원칙 표기 권장'};
const SEVERITY={error:0,review:1,principle:2};

const tag=t=> t.pos==='VX'?'V':/^(VV|VA)$/.test(t.pos)?'V':/^(EC|EF)$/.test(t.pos)?'E':t.pos;
const signature=ts=>ts.map(t=>t.text+'/'+tag(t)).join('|');
const grammatical=t=>/^(E|J)/.test(t.pos)||['VCP','VCN'].includes(t.pos);
const grammaticalTail=ts=>{let k=ts.length;while(k>0&&grammatical(ts[k-1]))k--;return ts.slice(k);};
const nominal=t=>/^(NNG|NNP|NP|NR|NNB|XSN|J.*)$/.test(t?.pos||'');
const issue=({id,from,to,start,level,reason,source,priority,principle})=>({
  id,name:level==='principle'?'원칙 표기 권장':id==='norm_spelling'?'규범 표기':'띄어쓰기 검토',
  from,to,start,end:start+from.length,level,
  kind:level==='principle'?'principle':level==='error'?'error':'review',
  review:true,label:LABEL[level],principle,reason,source,priority});

// Particle allomorphs follow the final consonant of the new word (몇일이 → 며칠이, X를/X을).
const hasBatchim=s=>{const c=s.charCodeAt(s.length-1)-44032;return c>=0&&c<11172&&c%28!==0;};
const rieulFinal=s=>{const c=s.charCodeAt(s.length-1)-44032;return c>=0&&c<11172&&c%28===8;};
const PAIRS=[['이','가'],['을','를'],['은','는'],['과','와'],['이랑','랑'],['이나','나'],['이며','며'],['이라','라'],['으로','로']];
export function adjustParticle(word,rest){
  for(const [withB,withoutB] of PAIRS){
    for(const p of [withB,withoutB]){
      if(!rest.startsWith(p))continue;
      let want=hasBatchim(word)?withB:withoutB;
      if(withB==='으로'&&rieulFinal(word))want='로';
      return want+rest.slice(p.length);
    }
  }
  return rest;
}

// Rebuild stem + endings with the regular rules of 한글 맞춤법 제16·34항
// (vowel harmony 아/어, obligatory ㅏ·ㅓ elision, single-jamo endings).
const SYL=c=>{const x=c.charCodeAt(0)-44032;return x>=0&&x<11172?{i:Math.floor(x/588),v:Math.floor(x/28)%21,f:x%28}:null;};
const MAKE=(i,v,f)=>String.fromCharCode(44032+i*588+v*28+f);
const JAMO_FINAL={'ㄴ':4,'ㄹ':8,'ㅁ':16,'ㅂ':17,'ㅆ':20};
export function conjugate(stem,endings){
  let out=stem;
  for(let e of endings){
    const last=SYL(out.at(-1));if(!last)return null;
    if(JAMO_FINAL[e[0]]!==undefined){if(last.f)return null;out=out.slice(0,-1)+MAKE(last.i,last.v,JAMO_FINAL[e[0]])+e.slice(1);continue;}
    const first=SYL(e[0]);
    if(first&&first.i===11&&(first.v===0||first.v===4)){ // ending begins with 아/어(았/었…)
      const bright=[0,8].includes(last.v); // ㅏ, ㅗ
      const v=last.v===0&&!last.f?0:bright?0:4;
      const head=MAKE(11,v,first.f);
      e=head+e.slice(1);
      // 가+아 → 가, 서+어 → 서 (same vowel, no final consonant): obligatory elision
      if(!last.f&&((last.v===0&&v===0)||(last.v===4&&v===4))){out=out.slice(0,-1)+MAKE(last.i,last.v,first.f)+e.slice(1);continue;}
    }
    out+=e;
  }
  return out;
}
// Character offsets of the internal boundaries a headword is recorded with (살펴-보다 → {2}).
export function compoundMarks(raw){
  const marks=new Set();let n=0;
  for(const c of raw.replace(/\(\d+\)$/,'')){if(c==='-'||c==='^')marks.add(n);else n++;}
  return marks;
}
// Add ㅅ as a final consonant (사이시옷) to a syllable without one: 머리 → 머릿.
export function addSiot(word){
  const c=word.charCodeAt(word.length-1)-44032;
  if(c<0||c>=11172||c%28!==0)return null;
  return word.slice(0,-1)+String.fromCharCode(44032+c+19);
}
export function selectNonOverlapping(hits){
  hits.sort((a,b)=>a.start-b.start||(a.priority??1)-(b.priority??1)||(b.end-b.start)-(a.end-a.start));
  const result=[];let end=-1;
  for(const h of hits)if(h.start>=end){result.push(h);end=h.end;}return result;
}

export function createProofreader({lexicon,morphology}){
  if(!lexicon||!morphology)throw new Error('사전과 형태소 분석기가 모두 필요합니다.');
  const cache=new Map();
  const analyze=text=>{if(cache.has(text))return cache.get(text);const t=analyzeUTF16(morphology,text).tokens; if(cache.size>=4096)cache.clear();cache.set(text,t);return t;};
  // A numeral in the dictionary, or a compound of two (열두 = 열 + 두, 스물세 = 스물 + 세).
  const isNum=x=>lexicon.hasPOS(x,'수사','관형사');
  const numeral=x=>isNum(x)||[...x].some((_,i)=>i>0&&isNum(x.slice(0,i))&&isNum(x.slice(i)));
  const lookup=s=>s?lexicon.lookupSurface(s,analyze(s)):null;
  const standard=s=>{const e=lookup(s);return e&&!e.nonstandard?e:null;};
  // Locate an internal boundary by comparing analyses of both pieces; morpheme
  // token spans in Garu are EOJEOL spans and must not be used as morpheme spans.
  function boundary(surface,tokens,index){
    // 1) The right-hand morphemes usually appear literally (올것 → 것, 할수있다 → 수있다).
    const rightText=tokens.slice(index).map(t=>t.text).join('');
    if(rightText&&surface.length>rightText.length&&surface.endsWith(rightText)){
      const p=surface.length-rightText.length;
      if(signature(analyze(surface.slice(p)))===signature(tokens.slice(index))||lexicon.isHeadword(tokens[index].text)||lexicon.isHeadword(tokens[index].text+'다'))return p;
    }
    // 2) The left-hand morphemes appear literally and the right one contracted
    //    with its ending (짜증나서 = 짜증 + 나-아서, 소리나다).
    const leftText=tokens.slice(0,index).map(t=>t.text).join('');
    if(leftText&&leftText.length<surface.length&&surface.startsWith(leftText)&&/^N/.test(tokens[index-1].pos)){
      const right=surface.slice(leftText.length),r=analyze(right),tok=tokens[index];
      // Same morpheme (possibly fused with its ending: 나서 = 나-아서), or the
      // dictionary confirms the right piece is a word of the same class (나다: 동사).
      const sameMorpheme=r[0]&&tag(r[0])===tag(tok)&&r[0].text.startsWith(tok.text);
      const e=lexicon.lookupSurface(right,r);
      const sameClass=e&&!e.nonstandard&&(tag(tok)==='V'?['동사','형용사'].some(p=>e.pos.has(p)):/^N/.test(tok.pos)&&['명사','의존 명사','대명사'].some(p=>e.pos.has(p)));
      if(sameMorpheme||sameClass)return leftText.length;
    }
    // 3) Contracted forms (먹어버렸다): compare analyses of both pieces.
    const a=signature(tokens.slice(0,index)),b=signature(tokens.slice(index));
    for(let p=1;p<surface.length;p++)if(signature(analyze(surface.slice(0,p)))===a && signature(analyze(surface.slice(p)))===b)return p;
    return null;
  }

  // ---------- P0: nonstandard headwords ----------
  function normHit(w){
    if(/[0-9]/.test(w.text))return null;
    const make=(head,n,to,extra='')=>issue({id:'norm_spelling',from:w.text,to,start:w.start,level:'error',priority:PRIORITY.norm,principle:'P0',
      reason:(n.note||`‘${head}’은(는) 표준국어대사전에서 규범에 맞지 않는 표기로 안내하며 ‘${n.target}’이(가) 표준 표기입니다.`)+extra,
      source:'표준국어대사전 규범 정보'});
    const e=lookup(w.text);
    if(e?.nonstandard){
      const n=lexicon.norm(e.word);
      if(w.text===e.word)return make(e.word,n,n.target);
      if(e.word.endsWith('다')&&n.target.endsWith('다')){
        const stem=e.word.slice(0,-1),tstem=n.target.slice(0,-1);
        if(w.text.startsWith(stem))return make(e.word,n,tstem+w.text.slice(stem.length),' 활용형이 맞는지 함께 확인하세요.');
        const ts=analyze(w.text);
        if(ts[0]&&ts[0].text===stem&&ts.length>1&&ts.slice(1).every(t=>/^E/.test(t.pos))){
          const rebuilt=conjugate(tstem,ts.slice(1).map(t=>t.text));
          if(rebuilt)return make(e.word,n,rebuilt,' 활용형이 맞는지 함께 확인하세요.');
        }
        return null; // conjugation cannot be rebuilt reliably; never output a bare lemma
      }
      if(w.text.startsWith(e.word))return make(e.word,n,n.target+adjustParticle(n.target,w.text.slice(e.word.length)));
      return null;
    }
    if(e)return null;
    // A nonstandard noun/adverb followed by particles, endings or another standard word (몇일동안).
    for(let p=w.text.length-1;p>=2;p--){
      const head=w.text.slice(0,p),n=lexicon.norm(head);
      if(!n||n.target.endsWith('다')||!lexicon.hasPOS(head,'명사','대명사','수사','부사','의존 명사','관형사'))continue;
      const rest=w.text.slice(p),rt=analyze(rest);
      const grammatical=rt.length&&rt.every(t=>/^(J|E)/.test(t.pos)||['VCP','VCN','XSV','XSA'].includes(t.pos));
      if(grammatical||standard(rest))return make(head,n,n.target+adjustParticle(n.target,rest));
    }
    return null;
  }

  // Recover a nonstandard dictionary headword *inside* a merged eojeol before
  // asking Garu to decide where its word boundaries should be. A typo such as
  // 몆일전 must not be discarded solely because Garu tags the whole run NNG.
  const nonstandardHeads=[...lexicon.words.values()].filter(e=>e.nonstandard&&e.word.length>=2&&e.word.length<=6&&
    e.normTargets.size===1&&!([...e.normTargets][0]||'').endsWith('다')&&
    [...e.pos].some(pos=>['명사','대명사','수사','부사','관형사'].includes(pos)));
  const jamoDelta=(a,b)=>{
    const x=a.charCodeAt(0)-44032,y=b.charCodeAt(0)-44032;
    if(x<0||y<0||x>=11172||y>=11172)return 9;
    return (Math.floor(x/588)!==Math.floor(y/588)?1:0)+
      (Math.floor(x/28)%21!==Math.floor(y/28)%21?1:0)+(x%28!==y%28?1:0);
  };
  function recoverPrefix(surface){
    const choices=[];
    for(const e of nonstandardHeads){
      const n=e.word.length;if(surface.length<=n)continue;
      let rest=surface.slice(n);
      let attachedParticle='';
      // Allow an attached particle after the independent following noun.
      const suffixTokens=analyze(rest);
      if(suffixTokens.length>1&&/^J/.test(suffixTokens.at(-1).pos)){
        const p=suffixTokens.at(-1).text;
        if(rest.endsWith(p)&&lexicon.hasPOS(rest.slice(0,-p.length),'명사','의존 명사')){attachedParticle=p;rest=rest.slice(0,-p.length);}
      }
      // Restrict to a complete, independently attested following word. This is
      // not a substitution table for a particular phrase or suffix.
      if(!lexicon.hasPOS(rest,'명사')||!['전','후'].includes(rest))continue;
      const typed=surface.slice(0,n);
      let distance=0;
      for(let i=0;i<n;i++)distance+=jamoDelta(typed[i],e.word[i]);
      if(distance>1)continue;
      if(distance===1&&(lexicon.has(typed)||(typed[0]!==e.word[0]&&(typed.length<2||typed.slice(1)!==e.word.slice(1)))))continue;
      const target=[...e.normTargets][0];
      if(!lexicon.has(target))continue;
      const normalized=target+' '+rest+attachedParticle;
      // Do not split a registered compound word merely because a prefix resembles
      // a nonstandard spelling; a correction must be grounded in the dictionary.
      if(lexicon.has(surface))continue;
      choices.push({typed,head:e.word,target,rest,normalized,distance});
    }
    choices.sort((a,b)=>a.distance-b.distance||b.head.length-a.head.length);
    if(!choices.length||choices.some((c,i)=>i>0&&c.distance===choices[0].distance))return null;
    return choices[0];
  }
  // Semantic class, NOT a table of erroneous full phrases. Temporal noun +
  // relative-time noun is a two-word construction (e.g. 며칠 전, 이틀 후).
  const TEMPORAL_UNITS=new Set(['며칠','하루','이틀','사흘','나흘','닷새','엿새','일주일','한달','한해']);
  const RELATIVE_TIME_NOUNS=new Set(['전','후']);
  function temporalBoundary(surface){
    if(lexicon.has(surface))return null;
    for(let p=1;p<surface.length;p++){
      const head=surface.slice(0,p),tail=surface.slice(p);
      if(TEMPORAL_UNITS.has(head)&&RELATIVE_TIME_NOUNS.has(tail)&&lexicon.has(head)&&lexicon.hasPOS(tail,'명사'))
        return head+' '+tail;
    }
    return null;
  }
  function detachedParticle(word,next,text){
    if(!next||! /^[ \t]+$/.test(text.slice(word.end,next.start)))return null;
    const nextTags=analyze(next.text);
    if(!nextTags.length||!/^J/.test(nextTags[0].pos))return null;
    if(!nextTags.every(t=>/^J/.test(t.pos)))return null;
    const preceding=analyze(word.text);
    if(!preceding.some(t=>/^(NNG|NNP|NNB|NP|NR)$/.test(t.pos)))return null;
    const joined=analyze(word.text+next.text);
    if(joined.map(t=>t.text+'/'+t.pos).join('|')!==[...preceding,...nextTags].map(t=>t.text+'/'+t.pos).join('|'))return null;
    return next;
  }

  function check(text){
    if(!text.trim())return [];
    const full=[],hits=[];
    // Sentence-local analysis: Garu reads each sentence on its own, so a word's
    // analysis does not depend on how much text surrounds it (results were
    // drifting in long paragraphs). Sentences end at . ? ! … (and their closing
    // quotes/brackets) followed by whitespace. A very long sentence is divided
    // only at whitespace, never inside a word.
    const SENTENCE_LIMIT=300;
    for(const line of text.matchAll(/[^\r\n]+/g)){
      for(const sentence of line[0].matchAll(/\S(?:[\s\S]*?(?:[.?!…]+["'”’)\]」』]*(?=\s|$))|[\s\S]*$)/g)){
        const base=line.index+sentence.index,body=sentence[0];
        let offset=0;
        while(offset<body.length){
          let end=Math.min(offset+SENTENCE_LIMIT,body.length);
          if(end<body.length){
            const cut=body.slice(offset,end).search(/\s+\S*$/);
            if(cut>0)end=offset+cut;
            else {const next=body.slice(end).search(/\s/);end=next<0?body.length:end+next;}
          }
          const part=body.slice(offset,end);
          if(part.trim()&&!(part.length>1500&&!/\s/.test(part)))for(const t of analyze(part))full.push({...t,start:t.start+base+offset,end:t.end+base+offset});
          offset=end;while(offset<body.length&&/\s/.test(body[offset]))offset++;
        }
      }
    }
    // An eojeol is a run of Hangul, optionally led by Arabic digits (3개월동안).
    const words=[...text.matchAll(/[0-9]*[가-힣]+/g)].map(m=>({text:m[0],start:m.index,end:m.index+m[0].length}));
    let cursor=0;
    const contexts=new Map();
    for(const w of words){
      while(cursor<full.length&&full[cursor].end<=w.start)cursor++;
      const ts=[];
      for(let k=cursor;k<full.length&&full[k].start<=w.start;k++)if(full[k].end>=w.end&&!/^S/.test(full[k].pos))ts.push(full[k]);
      contexts.set(w.start,ts);
    }
    // No newlines, punctuation, embedded Latin/alphanumeric words, or identifiers.
    const usable=w=> !/[\p{L}\p{N}_]/u.test(text.slice(0,w.start).at(-1)||'')&&!/[\p{L}\p{N}_]/u.test(text[w.end]||'');
    const hangul=w=>w.text.replace(/^[0-9]+/,'');
    const tokensFor=w=>{const c=contexts.get(w.start)||[];return c.length?c:analyze(hangul(w));};

    // Multi-stage correction: dictionary-backed nonstandard spelling, followed by
    // a fresh lexical boundary check and an independent detached-particle check.
    // One combined hit is emitted so replacement spans never overlap.
    const recovered=new Set();
    for(let i=0;i<words.length;i++){
      const w=words[i];if(!usable(w)||/[0-9]/.test(w.text))continue;
      const candidate=recoverPrefix(w.text);if(!candidate)continue;
      const next=words[i+1];
      const followingParticle=next&&/^[ \t]+$/.test(text.slice(w.end,next.start))&&
        analyze(next.text).length>0&&analyze(next.text).every(t=>/^J/.test(t.pos))&&
        analyze(candidate.rest+next.text).some(t=>/^J/.test(t.pos));
      const particle=detachedParticle(w,next,text)||(followingParticle?next:null);
      const end=particle?particle.end:w.end;
      const original=text.slice(w.start,end);
      const replacement=candidate.normalized+(particle?particle.text:'');
      hits.push(issue({id:'compound_norm_spacing',from:original,to:replacement,start:w.start,
        level:'error',priority:PRIORITY.norm,principle:'P0',
        reason:`‘${candidate.head}’의 표준 표기는 ‘${candidate.target}’입니다. 사전상 독립적인 두 단어를 구분하고 조사는 앞말에 붙여 씁니다. 철자·띄어쓰기 복합 오류를 함께 확인하세요.`,
        source:'표준국어대사전 규범 정보 · 형태소 분석 · 한글 맞춤법 제2항·제41항'}));
      recovered.add(w.start);if(particle)recovered.add(particle.start);
    }
    // Temporal nouns: protect the independent word boundary, then reattach
    // a detached particle if Garu confirms that it is a particle.
    for(let i=0;i<words.length;i++){
      const w=words[i];if(!usable(w)||recovered.has(w.start))continue;
      const spaced=temporalBoundary(w.text);if(!spaced)continue;
      const next=words[i+1];
      const nextIsParticle=next&&/^[ \t]+$/.test(text.slice(w.end,next.start))&&
        analyze(next.text).length>0&&analyze(next.text).every(t=>/^J/.test(t.pos));
      const from=text.slice(w.start,nextIsParticle?next.end:w.end),to=spaced+(nextIsParticle?next.text:'');
      hits.push(issue({id:'temporal_noun_spacing',from,to,start:w.start,level:'error',priority:PRIORITY.join,principle:'P3',
        reason:'기간을 나타내는 말과 앞뒤 시점을 나타내는 독립 명사는 띄어 쓰고, 조사는 바로 앞말에 붙여 씁니다.',
        source:'표준국어대사전 품사 · 한글 맞춤법 제2항·제41항'}));
      recovered.add(w.start);if(nextIsParticle)recovered.add(next.start);
    }
    // ---------- P0 ----------
    const flaggedNorm=new Set();
    for(const w of words){if(!usable(w)||recovered.has(w.start))continue;const h=normHit(w);if(h){hits.push(h);flaggedNorm.add(w.start);}}

    // ---------- P1: a dictionary headword is one word ----------
    for(let i=0;i<words.length;i++){
      const left=words[i];if(!usable(left)||/[0-9]/.test(left.text))continue;
      for(let n=2;n<=4&&i+n<=words.length;n++){
        const span=words.slice(i,i+n),last=span.at(-1);
        if(!span.every(usable)||span.slice(1).some((w,k)=>! /^[ \t]+$/.test(text.slice(span[k].end,w.start))))break;
        if(span.slice(1).some(w=>/[0-9]/.test(w.text)))break;
        const surface=span.map(w=>w.text).join('');if(surface.length>64)break;
        const original=span.map(tokensFor);
        const combined=analyze(surface),entry=lexicon.lookupSurface(surface,combined);
        if(!entry||entry.nonstandard||!['명사','동사','형용사','부사'].some(p=>entry.pos.has(p)))continue;
        const predicate=['동사','형용사'].some(p=>entry.pos.has(p));
        // The match must describe THIS text: joining may fuse stems, but it must not
        // re-read part of a word as a particle/ending (책 한 → 책하-ㄴ, 세 자루 → 세자-로).
        if(grammaticalTail(combined).length>grammaticalTail(original.flat()).length)continue;
        // The headword must actually span the gap, not just be the first word plus endings.
        if(entry.word.length<=span[0].text.length&&!predicate)continue;
        // The dictionary marks how a compound is built (살펴-보다, 큰-집, 엉망-진창).
        // A space on that mark means the text split this compound. Without the mark the
        // headword is an unrelated word that merely shares the spelling (방 안 ≠ 방안 '方案',
        // 세 권 ≠ 세권 '稅權'), unless the pieces are not words on their own (먹 었다, 어려 워서).
        const gaps=[];{let acc=0;for(const w of span.slice(0,-1)){acc+=w.text.length;gaps.push(acc);}}
        // 대답할 수 없었다: '수' is the noun modified by '대답할'. Reading 수없다 (a verb) would
        // leave the modifier with no noun to modify — that sense cannot be meant here.
        const prevWord=words[i-1];
        // Likewise 아무 말 없이: 관형사 '아무' modifies '말'; the adverb 말없이 leaves it nothing to modify.
        const nounReading=['명사','대명사','수사'].some(p=>entry.pos.has(p));
        const modifierBefore=prevWord&&/^[ \t]+$/.test(text.slice(prevWord.end,left.start))&&/^(ETM|MM)$/.test(tokensFor(prevWord).at(-1)?.pos||'');
        if(!nounReading&&modifierBefore&&/^N/.test(original[0][0]?.pos||''))continue;
        const builtHere=entry.raw.some(raw=>{const marks=compoundMarks(raw);return gaps.every(g=>marks.has(g));});
        if(!builtHere&&!predicate&&span.every(w=>standard(w.text)))continue;
        // The halves may themselves be ordinary words in another construction.
        // These checks only LOWER the level; they never discard the dictionary verdict.
        const concerns=[];
        const before=original.slice(0,-1);
        if(original.some(ts=>ts.some(t=>/^(MM|NR)$/.test(t.pos))))concerns.push('관형사·수량 표현과 명사의 구성');
        else if(before.some(ts=>ts.some(t=>/^(ETM|ETN)$/.test(t.pos))))concerns.push('관형어와 명사의 구성');
        if(before.some(ts=>ts.some(t=>/^(MAG|MAJ)$/.test(t.pos))))concerns.push('부사와 용언의 구성');
        if(before.some(ts=>ts.some(t=>/^(NP|J.*)$/.test(t.pos))))concerns.push('대명사·조사가 붙은 앞말과 뒷말의 구성');
        const rightLexical=ts=>ts.some(t=>/^(VV|VA|VX)$/.test(t.pos));
        if(original.some(ts=>ts.some(t=>t.pos==='VX'))||(original.length===2&&original[0].some(t=>/^(VV|VA)$/.test(t.pos))&&rightLexical(original[1])))
          concerns.push('본용언과 보조 용언(또는 두 용언)의 구성');
        const level=concerns.length?'review':'error';
        const from=text.slice(left.start,last.end);
        const reason=`‘${entry.word}’은(는) 표준국어대사전에 한 단어로 올라 있으므로 붙여 씁니다.`+
          (concerns.length?` 다만 ${[...new Set(concerns)].join(', ')}일 수도 있으니, 사전 표제어의 뜻으로 쓰였는지 문맥을 확인하세요.`:'');
        hits.push(issue({id:'dict_compound',from,to:surface,start:left.start,level,priority:PRIORITY.join,principle:'P1',reason,source:'표준국어대사전 · 한글 맞춤법 제2항'}));
      }
    }

    // ---------- P2 / P3 / P4 per eojeol ----------
    const splitRule=(prev,t)=>{
      const P=prev.pos,T=t.pos;
      // 조사는 앞말에 붙지만, 조사가 붙은 어절과 다음 단어는 띄어 쓴다(학교에가다 → 학교에 가다).
      if(/^J/.test(P)&&/^(NNG|NNP|NNB|NP|NR|VV|VA|MAG|MM|MAJ|IC)$/.test(T))return {level:'error',why:'조사가 붙은 어절과 뒤의 단어는 띄어 씁니다(한글 맞춤법 제2항·제41항).'};
      if(P==='ETM'&&T==='NNB'&&lexicon.hasPOS(t.text,'의존 명사'))return {level:'error',why:'의존 명사는 관형어 뒤에서 띄어 씁니다(제42항).'};
      if(P==='ETM'&&/^(NNG|NNP)$/.test(T)&&lexicon.hasPOS(t.text,'명사','의존 명사'))return {level:'error',why:'관형어와 뒤의 명사는 별개의 단어로 띄어 씁니다(제2항).'};
      // '-아/어지다', '-아/어하다' are written attached in every case (한글 맞춤법 제47항 해설).
      if(P==='EC'&&T==='VX'&&/^[아어여]$/.test(prev.text)&&/^(지|하)$/.test(t.text))return null;
      if(P==='EC'&&T==='VX'&&lexicon.hasPOS(t.text+'다','보조 동사','보조 형용사'))return {level:'principle',why:'보조 용언은 띄어 쓰는 원칙 표기를 권장합니다(제47항). 붙여쓰기가 허용되는 구성도 있으므로 원문이 곧 오류라는 뜻은 아닙니다.'};
      if(P==='NNB'&&/^(VV|VA|VX)$/.test(T)&&lexicon.hasPOS(prev.text,'의존 명사'))return {level:'error',why:'의존 명사와 뒤의 용언은 별개의 단어로 띄어 씁니다(제2항·제42항).'};
      if(/^(NR|MM)$/.test(P)&&T==='NNB'&&lexicon.hasPOS(t.text,'의존 명사'))return {level:'principle',why:'수 관형사·수사 뒤의 단위 명사(의존 명사)는 띄어 씁니다(제43항). 순서를 나타내는 경우 등은 붙여 쓸 수 있습니다.'};
      if(P==='MM'&&/^(NNG|NNP)$/.test(T))return {level:'review',why:'관형사와 뒤의 명사는 별개의 단어로 띄어 씁니다(제2항).'};
      if(/^(NNG|NNP|NNB|XSN)$/.test(P)&&T==='NNB'&&lexicon.hasPOS(t.text,'의존 명사'))return {level:'review',why:'의존 명사는 앞말과 띄어 씁니다(제42항). 접미사로 쓰인 경우는 붙여 씁니다.'};
      if(P==='MAG'&&/^(VV|VA)$/.test(T))return {level:'review',why:'부사와 뒤의 용언은 별개의 단어로 띄어 씁니다(제2항).'};
      if(/^(NNG|NNB)$/.test(P)&&T==='NNG')return {level:'review',why:'사전에 한 단어로 없는 명사 결합은 각 단어를 띄어 쓰는 것이 원칙입니다(제2항). 전문 용어는 붙여 쓸 수 있습니다(제50항).'};
      // 소리 나다, 고장 나다: 사전에 한 단어(화나다, 생각나다)로 없으면 명사와 용언은 띄어 쓴다.
      if(P==='NNG'&&/^(VV|VA)$/.test(T))return {level:'error',why:'사전에 한 단어로 올라 있지 않으므로 명사와 뒤의 용언은 띄어 씁니다(제2항). 한 단어로 굳은 말(예: 화나다, 생각나다)은 사전에 따라 붙여 씁니다.'};
      return null;
    };
    for(let i=0;i<words.length;i++){
      const w=words[i];if(!usable(w)||w.text.length>64)continue;
      const core=hangul(w),lead=w.text.length-core.length;
      // Compare local and sentence analyses. A long clause may cause Garu to
      // change a dependent-noun reading; keep the locally well-formed ETM+NNB
      // reading as a second boundary hypothesis, rather than discarding it.
      const contextTokens=tokensFor(w),localTokens=analyze(core);
      const hasDependentBoundary=seq=>seq.some((t,k)=>k>0&&t.pos==='NNB'&&seq[k-1].pos==='ETM'&&lexicon.hasPOS(t.text,'의존 명사'));
      const ts=!hasDependentBoundary(contextTokens)&&hasDependentBoundary(localTokens)?localTokens:contextTokens;
      const registered=flaggedNorm.has(w.start)?null:lexicon.lookupSurface(core,analyze(core));
      let split=false;
      if(!registered&&!flaggedNorm.has(w.start)){
        const cuts=new Map();let siotHit=null;
        for(let k=1;k<ts.length;k++){
          const t=ts[k],prev=ts[k-1];let rule=splitRule(prev,t);
          if(!rule)continue;
          if(/^(NN|XSN)/.test(prev.pos)&&(prev.pos==='NNP'||t.pos==='NNP')&&/^(NNG|NNP)$/.test(t.pos))continue; // proper-noun compounds may be joined (제49항)
          const cut=boundary(core,ts,k);if(cut===null)continue;
          const leftPart=core.slice(0,cut),rightPart=core.slice(cut);
          if(/^(NNG)$/.test(prev.pos)&&t.pos==='NNG'){
            const siot=addSiot(leftPart);
            const joinedStem=siot&&siot+t.text;
            if(joinedStem&&lexicon.has(joinedStem)&&!lexicon.has(leftPart+t.text)){
              siotHit={to:w.text.slice(0,lead)+siot+rightPart,word:joinedStem};
              break;
            }
          }
          // Both halves must be dictionary words (with their own particles/endings).
          const rightOK=standard(rightPart)||(t.pos==='NNB'&&lexicon.hasPOS(t.text,'의존 명사'))||(t.pos==='VX'&&lexicon.hasPOS(t.text+'다','보조 동사','보조 형용사'));
          const leftOK=/^(ETM|EC|NNP)$/.test(prev.pos)||standard(leftPart)||(prev.pos==='NNB'&&lexicon.hasPOS(prev.text,'의존 명사'))||(/^(NR|MM)$/.test(prev.pos)&&numeral(leftPart));
          if(!rightOK||!leftOK)continue;
          if(prev.pos==='ETM'){
            const tail=lookup(rightPart);
            if(tail&&['보조 동사','보조 형용사'].some(p=>tail.pos.has(p)))rule={level:'principle',why:'보조 용언 구성으로 분석됩니다. 띄어 쓰는 원칙 표기를 권장하며 허용 표기 여부와 문맥은 별도 확인이 필요합니다(제47항).'};
          }
          const prevRule=cuts.get(cut);
          if(!prevRule||SEVERITY[rule.level]<SEVERITY[prevRule.level])cuts.set(cut,rule);
        }
        if(siotHit){
          hits.push(issue({id:'siot_compound',from:w.text,to:siotHit.to,start:w.start,level:'error',priority:PRIORITY.join,principle:'P1',
            reason:`‘${siotHit.word}’은(는) 사이시옷을 받치어 적는 한 단어로 표준국어대사전에 올라 있습니다(한글 맞춤법 제30항).`,source:'표준국어대사전 · 한글 맞춤법 제30항'}));
          split=true;
        }else if(cuts.size){
          const rules=[...cuts.values()];
          const level=rules.reduce((a,r)=>SEVERITY[r.level]<SEVERITY[a]?r.level:a,'principle');
          const to=w.text.slice(0,lead)+[...core].map((c,k)=>(cuts.has(k)?' ':'')+c).join('');
          hits.push(issue({id:'morph_spacing',from:w.text,to,start:w.start,level,priority:PRIORITY.split,principle:'P3',
            reason:[...new Set(rules.map(r=>r.why))].join(' '),source:'Garu 품사 분석 · 표준국어대사전 · 한글 맞춤법'}));
          split=true;
        }
        // Independent boundary verification for contracted dependent nouns.
        // Garu can parse "비싼걸" as 비싸/VA + ㄴ/ETM + 거/NNB + ㄹ/JKO
        // in its sentence context, while analysing "걸" alone as a verb.
        // Check the full-sentence morphemes and the grammatical left side;
        // do NOT maintain a replacement list of complete erroneous strings.
        if(!split && ts.some(t=>t.pos==='ETM')){
          const proposals=[];
          for(let k=1;k<ts.length;k++){
            const t=ts[k],prior=ts[k-1];
            if(prior?.pos!=='ETM'||t?.pos!=='NNB'||!lexicon.hasPOS(t.text,'의존 명사'))continue;
            const suffix=ts.slice(k+1);
            if(suffix.length>1||suffix.some(x=>!/^J/.test(x.pos)))continue;
            let surfaceTail=t.text;
            if(suffix.length){
              const particle=suffix[0].text;
              const jamo=JAMO_FINAL[particle];
              const syl=SYL(surfaceTail.at(-1));
              if(jamo!==undefined&&syl&&!syl.f)surfaceTail=surfaceTail.slice(0,-1)+MAKE(syl.i,syl.v,jamo);
              else surfaceTail+=particle;
            }
            if(!core.endsWith(surfaceTail)||core.length<=surfaceTail.length)continue;
            const cut=core.length-surfaceTail.length;
            const left=core.slice(0,cut),lhs=analyze(left);
            if(lhs.at(-1)?.pos!=='ETM')continue;
            if(!lhs.some(x=>/^(VV|VA)$/.test(x.pos)))continue;
            // Reject sentence analyses that do not agree with the noun+particle reading.
            if(t.text==='거'&&suffix.length===1&&suffix[0].text==='ㄹ'&&surfaceTail!=='걸')continue;
            proposals.push({cut,tail:surfaceTail});
          }
          if(proposals.length===1){
            const {cut}=proposals[0];
            hits.push(issue({id:'dependent_noun_contraction',from:w.text,
              to:w.text.slice(0,lead+cut)+' '+w.text.slice(lead+cut),start:w.start,
              level:'error',priority:PRIORITY.split,principle:'P3',
              reason:'관형형 뒤에 이어지는 의존 명사는 띄어 씁니다. 축약된 조사 형태도 문장 속 형태소 분석과 대조해 확인했습니다(한글 맞춤법 제42항).',
              source:'Garu 문맥 형태소 분석 · 표준국어대사전 의존 명사 정보 · 한글 맞춤법 제42항'}));
            split=true;
          }
        }
        if(!split){
          const counter=lexicon.findCounterSplit(core);
          if(counter&&!standard(core)){
            hits.push(issue({id:'counter_spacing',from:w.text,to:w.text.slice(0,lead)+counter.join(' '),start:w.start,level:'principle',priority:PRIORITY.split,principle:'P3',
              reason:'수량 표현과 단위 명사로 분석 가능한 결합입니다. 단위를 나타내는 명사는 앞말과 띄어 쓰는 것이 원칙입니다(한글 맞춤법 제43항).',
              source:'표준국어대사전 품사 · 한글 맞춤법 제43항'}));
            split=true;
          }
        }
      }
      // P4: reference spelling candidates for unknown nominal surfaces only.
      if(!registered&&!split&&!flaggedNorm.has(w.start)&&!lead&&w.text.length>=3&&w.text.length<=16){
        const wordTokens=analyze(w.text);
        const hasVerb=wordTokens.some(t=>/^(VV|VA|VX|VCP|VCN|XSV|XSA)$/.test(t.pos));
        const isName=wordTokens.some(t=>t.pos==='NNP');
        const unknownMorpheme=wordTokens.some(t=>/^(NNG|NNB|MAG|MM|XR|NA|NF|NV)$/.test(t.pos)&&!lexicon.isHeadword(t.text))||wordTokens.some(t=>/^(NA|NF|NV)$/.test(t.pos));
        if(!hasVerb&&!isName&&unknownMorpheme){
          const proposals=lexicon.suggestWithParticles(w.text,5);
          if(proposals.length){
            const options=proposals.map(p=>p.word);
            hits.push(issue({id:'lexical_candidate',from:w.text,to:options[0],start:w.start,level:'review',priority:PRIORITY.candidate,principle:'P4',
              reason:`현재 어절에서 사전 기반의 유사 표기 후보를 찾았습니다: ${options.join(', ')}. 원문이 고유 명사·신어·올바른 합성어일 수 있으므로 교정 전에 문맥과 규범을 확인하세요.`,
              source:'표준국어대사전 전체 표제어 · 철자 후보 탐색'}));
          }
        }
      }
      // P2: a detached particle attaches to the preceding word.
      const next=words[i+1];if(!next||!usable(next)||/[0-9]/.test(next.text)||! /^[ \t]+$/.test(text.slice(w.end,next.start)))continue;
      const a=ts,b=tokensFor(next);if(!nominal(a.at(-1))||!/^(J|VCP$|XSN$)/.test(b[0]?.pos||''))continue;
      const joined=analyze(w.text+next.text);
      // Same morphemes before and after joining (tags may differ, e.g. 뿐 NNB/JX).
      const texts=ts=>ts.map(t=>t.text).join('|');
      if(texts([...a,...b])!==texts(joined))continue;
      hits.push(issue({id:'particle_spacing',from:text.slice(w.start,next.end),to:w.text+next.text,start:w.start,level:b[0].pos==='XSN'?'review':'error',priority:PRIORITY.particle,principle:'P2',
        reason:b[0].pos==='XSN'?'접미사로 분석되며 결합 전후 형태소가 일치합니다. 접미사는 앞말에 붙여 씁니다.':'조사(서술격 조사 포함)로 분석되며 결합 전후 형태소가 일치합니다. 조사는 앞말에 붙여 씁니다(제41항). 동음이의어 여부는 문맥을 확인하세요.',source:'한글 맞춤법 제41항'}));
    }
    return selectNonOverlapping([...hits,...checkMiraeExamples(text)]);
  }
  return {check,analyze};
}
