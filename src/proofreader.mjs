import {analyzeUTF16} from './morphology.mjs';
const tag=t=> t.pos==='VX'?'V':/^(VV|VA)$/.test(t.pos)?'V':/^(EC|EF)$/.test(t.pos)?'E':t.pos;
const signature=ts=>ts.map(t=>t.text+'/'+tag(t)).join('|');
const nominal = t => /^(NNG|NNP|NP|NR|NNB|J.*)$/.test(t?.pos||'');
const issue=(id,from,to,start,kind,reason,source)=>({id,name:kind==='principle'?'원칙 표기 권장':'띄어쓰기 검토',from,to,start,end:start+from.length,kind,review:true,reason,source});
export function selectNonOverlapping(hits){
  hits.sort((a,b)=>a.start-b.start||(a.priority??1)-(b.priority??1)||(b.end-b.start)-(a.end-a.start));
  const result=[];let end=-1;
  for(const h of hits)if(h.start>=end){result.push(h);end=h.end;}return result;
}
export function createProofreader({lexicon,morphology}){
  if(!lexicon||!morphology)throw new Error('사전과 형태소 분석기가 모두 필요합니다.');
  const cache=new Map();
  const analyze=text=>{if(cache.has(text))return cache.get(text);const t=analyzeUTF16(morphology,text).tokens; if(cache.size>=4096)cache.clear();cache.set(text,t);return t;};
  // Locate an internal boundary by comparing analyses of both pieces; morpheme
  // token spans in Garu are EOJEOL spans and must not be used as morpheme spans.
  function boundary(surface,tokens,index){
    const a=signature(tokens.slice(0,index)),b=signature(tokens.slice(index));
    for(let p=1;p<surface.length;p++)if(signature(analyze(surface.slice(0,p)))===a && signature(analyze(surface.slice(p)))===b)return p;
    return null;
  }
  function check(text){
    if(!text.trim())return [];
    const full=[],hits=[];
    // Paragraph-local analysis bounds Garu's lattice and reuses unchanged paragraphs.
    // Very long paragraphs are divided only at whitespace, never inside a word.
    for(const line of text.matchAll(/[^\r\n]+/g)){
      let offset=0;
      while(offset<line[0].length){
        let end=Math.min(offset+1500,line[0].length);
        if(end<line[0].length){
          let cut=line[0].slice(offset,end).search(/\s+\S*$/);
          if(cut>0)end=offset+cut;
          else {const next=line[0].slice(end).search(/\s/);end=next<0?line[0].length:end+next;}
        }
        const part=line[0].slice(offset,end);
        if(part.trim()&&!(part.length>1500&&!/\s/.test(part)))for(const t of analyze(part))full.push({...t,start:t.start+line.index+offset,end:t.end+line.index+offset});
        offset=end;while(offset<line[0].length&&/\s/.test(line[0][offset]))offset++;
      }
    }
    const words=[...text.matchAll(/[가-힣]+/g)].map(m=>({text:m[0],start:m.index,end:m.index+m[0].length}));
    let cursor=0;
    const contexts=new Map();
    for(const w of words){
      while(cursor<full.length&&full[cursor].end<=w.start)cursor++;
      const ts=[];
      for(let k=cursor;k<full.length&&full[k].start<=w.start;k++)if(full[k].end>=w.end&&!/^S/.test(full[k].pos))ts.push(full[k]);
      contexts.set(w.start,ts);
    }
    const contextual=w=>contexts.get(w.start)||[];
    // No newlines, punctuation, embedded Latin/alphanumeric words, or identifiers.
    const usable=w=> !/[\p{L}\p{N}_]/u.test(text.slice(0,w.start).at(-1)||'')&&!/[\p{L}\p{N}_]/u.test(text[w.end]||'');
    const tokensFor=w=>{const c=contextual(w);return c.length?c:analyze(w.text);};
    // 2–4 eojeol windows share one lexical/morphological check, regardless of lemma.
    for(let i=0;i<words.length;i++){
      const left=words[i];if(!usable(left))continue;
      for(let n=2;n<=4&&i+n<=words.length;n++){
        const span=words.slice(i,i+n),last=span.at(-1);
        if(!span.every(usable)||span.slice(1).some((w,k)=>! /^[ \t]+$/.test(text.slice(span[k].end,w.start))))break;
        const surface=span.map(w=>w.text).join('');if(surface.length>64)break;
        const original=span.map(tokensFor);
        if(original.some(ts=>ts.some(t=>/^(MM|NR|SN)$/.test(t.pos))))continue;
        // Protect modifiers, pronouns, counts, and a word already ending in a particle.
        if(original.slice(0,-1).some(ts=>ts.some(t=>/^(ETM|ETN|MM|MAG|MAJ|NP|NR|SN|J.*)$/.test(t.pos))))continue;
        const combined=analyze(surface),entry=lexicon.lookupSurface(surface,combined);
        if(!entry||!['명사','동사','형용사','부사'].some(p=>entry.pos.has(p)))continue;
        if(entry.word.length<=span[0].text.length&&!['동사','형용사'].some(p=>entry.pos.has(p)))continue;
        const from=text.slice(left.start,last.end);
        hits.push(issue('dict_compound',from,surface,left.start,'review',`‘${entry.word}’의 사전 등재·품사와 결합형 분석을 확인했습니다. 해당 단어의 뜻으로 쓰였으면 붙여 쓰세요. 별개의 단어 구성일 가능성은 문맥에서 확인해야 합니다.`,'표준국어대사전 · 한글 맞춤법 제2항'));
      }
    }
    for(let i=0;i<words.length;i++){
      const w=words[i];if(!usable(w)||w.text.length>64)continue;
      const ts=tokensFor(w),registered=lexicon.lookupSurface(w.text,analyze(w.text));
      if(!registered){
        const cuts=new Set(),reasons=new Set();let principle=false;
        for(let k=1;k<ts.length;k++){
          const t=ts[k],prev=ts[k-1];let why=null;
          if(['NNB','NNG'].includes(t.pos)&&prev.pos==='ETM'&&lexicon.hasPOS(t.text,'의존 명사','명사'))why=t.pos==='NNB'?'의존 명사는 관형어 뒤에서 띄어 씁니다(제42항).':'관형어와 뒤의 명사는 별개의 단어로 띄어 씁니다(제2항).';
          else if(t.pos==='VX'&&prev.pos==='EC'&&lexicon.hasPOS(t.text+'다','보조 동사','보조 형용사')){why='보조 용언은 띄어 쓰는 원칙 표기를 권장합니다(제47항). 붙여쓰기가 허용되는 구성도 있으므로 원문이 곧 오류라는 뜻은 아닙니다.';principle=true;}
          else if(['VV','VA','VX'].includes(t.pos)&&['NNB'].includes(prev.pos)&&lexicon.hasPOS(prev.text,'의존 명사'))why='의존 명사와 뒤의 용언은 별개의 단어로 띄어 씁니다(제2항·제42항).';
          if(!why)continue;
          const cut=boundary(w.text,ts,k);if(cut!==null){
            const tail=lexicon.lookupSurface(w.text.slice(cut),analyze(w.text.slice(cut)));
            if(prev.pos==='ETM'&&tail&&['보조 동사','보조 형용사'].some(p=>tail.pos.has(p))){
              principle=true;why='보조 용언 구성으로 분석됩니다. 띄어 쓰는 원칙 표기를 권장하며 허용 표기 여부와 문맥은 별도 확인이 필요합니다(제47항).';
            }
            cuts.add(cut);reasons.add(why);
          }
        }
        if(cuts.size){const to=[...w.text].map((c,k)=>(cuts.has(k)?' ':'')+c).join('');hits.push(issue('morph_spacing',w.text,to,w.start,principle?'principle':'review',[...reasons].join(' '),'Garu 품사 분석 · 한글 맞춤법'));}
      }
      // Detached particles: require noun context AND agreement after joining.
      const next=words[i+1];if(!next||!usable(next)||! /^[ \t]+$/.test(text.slice(w.end,next.start)))continue;
      const a=ts,b=tokensFor(next);if(!nominal(a.at(-1))||!b[0]?.pos.startsWith('J'))continue;
      const joined=analyze(w.text+next.text);
      if(signature([...a,...b])!==signature(joined))continue;
      hits.push(issue('particle_spacing',text.slice(w.start,next.end),w.text+next.text,w.start,'review','조사로 분석되며 결합 전후 형태소가 일치합니다. 앞말에 붙여 쓰세요. 동음이의어 여부는 문맥을 확인하세요.','한글 맞춤법 제41항'));
    }
    return selectNonOverlapping(hits);
  }
  return {check,analyze};
}
