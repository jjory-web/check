// Conservative dictionary-only checks when the morphological analyzer is unavailable.
// All compound and spelling suggestions require editorial review.
const buildIssue=(id,from,to,start,reason,priority=2)=>({id,name:'사전 기반 검토',from,to,start,end:start+from.length,kind:'review',review:true,reason,source:'표준국어대사전 · 제한 모드',priority});
const particles=['에서','에게','으로','까지','부터','처럼','보다','이랑','하고','으로는','으로도','로','를','을','은','는','이','가','에','의','도','만'];
const splits=(word)=>[{stem:word,suffix:''},...particles.filter(p=>word.endsWith(p)&&word.length>p.length+1).map(p=>({stem:word.slice(0,-p.length),suffix:p}))];
const isNominal=(entry)=>entry&&['명사','대명사','수사','부사'].some(p=>entry.pos.has(p));
export function createDictionaryFallback(lexicon){
  if(!lexicon)throw new Error('사전 데이터가 필요합니다.');
  function check(text){
    const words=[...text.matchAll(/[가-힣]+/g)].map(m=>({word:m[0],start:m.index,end:m.index+m[0].length}));
    const hits=[];
    const usable=w=> !/[\p{L}\p{N}_]/u.test(text[w.start-1]||'')&&!/[\p{L}\p{N}_]/u.test(text[w.end]||'');
    for(let i=0;i<words.length;i++){
      const w=words[i];if(!usable(w))continue;
      const counter=splits(w.word).map(({stem,suffix})=>({split:lexicon.findCounterSplit(stem),suffix})).find(x=>x.split);
      if(counter){hits.push(buildIssue('counter_spacing',w.word,counter.split.join(' ')+counter.suffix,w.start,'수량 표현 뒤의 단위 명사일 수 있습니다. 띄어쓰기를 확인하세요.',0));}
      // Without morphology, unknown surfaces are frequently valid conjugations.
      // Do not offer noisy spelling corrections in this limited mode.
      // Explore 2- and 3-word spans against the entire dictionary index.
      // Do not assume that the presence of a joined headword proves this
      // occurrence must be joined: only flag for editorial review.
      // Never join predicates or across punctuation/newlines.
      if(!isNominal(lexicon.words.get(w.word)))continue;
      for(let length=2;length<=3 && i+length<=words.length;length++){
        const span=words.slice(i,i+length);
        if(!span.every(usable))break;
        if(span.slice(1).some((item,j)=>!/^[ \t]+$/.test(text.slice(span[j].end,item.start))))break;
        if(span.slice(1,-1).some(item=>!isNominal(lexicon.words.get(item.word))))continue;
        const last=span.at(-1);
        const tail=splits(last.word).find(({stem})=>isNominal(lexicon.words.get(stem)) &&
          isNominal(lexicon.words.get(span.slice(0,-1).map(item=>item.word).join('')+stem)));
        if(!tail)continue;
        const compound=span.slice(0,-1).map(item=>item.word).join('')+tail.stem;
        const combined=compound+tail.suffix;
        hits.push(buildIssue('dictionary_compound',text.slice(w.start,last.end),combined,w.start,
          `‘${compound}’은 사전 등재어입니다. 이 문맥에서도 한 단어로 쓰였는지 확인하세요.`,1));
      }
    }
    hits.sort((a,b)=>a.start-b.start||a.priority-b.priority);
    const out=[];let end=-1;for(const h of hits)if(h.start>=end){out.push(h);end=h.end;}
    return out;
  }
  return {check};
}
