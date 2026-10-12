// Whole-source index: retain phrases/affixes in data, but never flatten them into words.
//
// Three kinds of spelling are distinguished, using dictionary data only:
//   standard     – a headword with at least one ordinary definition
//   nonstandard  – every 단어 homonym of this spelling is defined as "→ 표준어"
//                  (e.g. 몇일 → 며칠, 컨텐츠 → 콘텐츠). A headword, but NOT correct.
//   unknown      – not a headword at all
const lexicalPOS = new Set(['명사','대명사','수사','동사','형용사','부사','감탄사','관형사','의존 명사','보조 동사','보조 형용사']);
const PREDICATE = /동사|형용사/;
export function normalizeHeadword(raw) { return raw.replace(/\(\d+\)$/,'').replace(/-/g,'').replace(/\^/g,' '); }
export class Lexicon {
  constructor(data) {
    if(![1,2].includes(data.schemaVersion) || !Array.isArray(data.entries) || data.rowCount!==data.entries.length) throw new Error('사전 색인 형식/행 수 오류');
    this.data=data;this.words=new Map();this.forms=new Map();
    const notes=data.normNotes||{};
    for(const [raw,ui,pi,inflection,restricted,normTarget=''] of data.entries){
      const word=normalizeHeadword(raw),pos=data.poses[pi];
      if(restricted || data.units[ui]!=='단어' || !/^[가-힣]+$/.test(word) || !pos.some(p=>lexicalPOS.has(p)))continue;
      let entry=this.words.get(word);
      if(!entry){entry={word,pos:new Set(),raw:[],forms:new Set(),standardSenses:0,normTargets:new Set(),normNote:''};this.words.set(word,entry);}
      pos.forEach(p=>entry.pos.add(p));entry.raw.push(raw);
      if(normTarget){entry.normTargets.add(normTarget);if(notes[raw]&&!entry.normNote)entry.normNote=notes[raw];}
      else entry.standardSenses++;
      if(pos.some(p=>PREDICATE.test(p))){
        const clean=inflection.replace(/\[[^\]]*\]/g,'');
        for(const form of clean.match(/[가-힣]+/g)||[]){
          entry.forms.add(form);
          if(!this.forms.has(form)) this.forms.set(form,new Set());
          this.forms.get(form).add(word);
        }
      }
    }
    let nonstandard=0;
    for(const entry of this.words.values()){
      // Only when NO homonym is a standard word is the spelling itself wrong
      // (대중 → 타이중 is one homonym; 대중 '大衆' keeps the spelling valid).
      entry.nonstandard=entry.standardSenses===0&&entry.normTargets.size>0;
      if(entry.nonstandard)nonstandard++;
    }
    this.size=this.words.size;
    this.nonstandardCount=nonstandard;
    // Length/initial-syllable index over STANDARD headwords only.
    this.candidateBuckets=new Map();
    for(const [word,entry] of this.words){
      if(entry.nonstandard||word.length<2||word.length>16)continue;
      const key=word.length+':'+word[0];
      if(!this.candidateBuckets.has(key))this.candidateBuckets.set(key,[]);
      this.candidateBuckets.get(key).push(word);
    }
  }
  // true only for a STANDARD headword. A nonstandard headword is not "correct".
  has(word){const e=this.words.get(word);return !!e&&!e.nonstandard;}
  isHeadword(word){return this.words.has(word);}
  // {word,target,note} when the dictionary says this spelling is nonstandard.
  norm(word){const e=this.words.get(word);return e?.nonstandard?{word,target:[...e.normTargets][0],targets:[...e.normTargets],note:e.normNote}:null;}
  // All candidates are drawn from the complete dictionary, not a list of errors.
  // Return candidates for attached Korean particles as well as bare headwords.
  suggestWithParticles(surface,limit=5){
    const suffixes=['으로부터','에게서','에서','으로','에게','까지','부터','이나','처럼','보다','에는','에도','만은','으로는','으로도','이랑','랑','하고','에서','으로','로','에게','를','을','은','는','이','가','에','의','도','만'];
    const results=[]; const seen=new Set();
    const variants=[{stem:surface,suffix:''}];
    for(const suffix of suffixes){
      if(surface.endsWith(suffix)&&surface.length-suffix.length>=2){
        variants.push({stem:surface.slice(0,-suffix.length),suffix});
      }
    }
    for(const {stem,suffix} of variants){
      if(this.has(stem))continue;
      for(const candidate of this.suggest(stem,8)){
        const combined=candidate+suffix;
        if(seen.has(combined))continue;
        const entry=this.words.get(candidate);
        // Edit distance on surface forms is meaningless for conjugating words
        // (오래되었다 → 오래되다 deletes a tense ending). Nominal candidates only.
        if(['동사','형용사','보조 동사','보조 형용사'].some(pos=>entry?.pos.has(pos)))continue;
        if(suffix&&!['명사','대명사','수사','의존 명사'].some(pos=>entry?.pos.has(pos)))continue;
        seen.add(combined);results.push({word:combined,base:candidate,suffix,source:'dictionary',review:true});
      }
    }
    return results.slice(0,limit);
  }
  // Quantity word + dependent noun/unit. Both halves are judged by dictionary
  // POS (수사·관형사 + 의존 명사), not by a list of numerals.
  findCounterSplit(surface){
    if(this.has(surface))return null; // a registered word (이것, 이번) is not a phrase
    for(let i=1;i<surface.length;i++){
      const left=surface.slice(0,i),right=surface.slice(i);
      if(!this.hasPOS(right,'의존 명사'))continue;
      if(/^[0-9]+$/.test(left))return [left,right];
      if(this.has(left)&&this.hasPOS(left,'수사','관형사'))return [left,right];
    }
    return null;
  }
  // Generate edit-distance-one candidates over the complete headword index.
  // Restrict suggestions to a uniquely best Korean syllable match.
  suggest(word,limit=3){
    if(this.has(word)||word.length<2||word.length>16)return [];
    const pool=[...(this.candidateBuckets.get(word.length+':'+word[0])||[]),
      ...(this.candidateBuckets.get((word.length+1)+':'+word[0])||[]),
      ...(this.candidateBuckets.get((word.length-1)+':'+word[0])||[])];
    const scored=[];
    const syllableCost=(a,b)=>{
      const x=a.charCodeAt(0)-44032,y=b.charCodeAt(0)-44032;
      if(x<0||y<0||x>=11172||y>=11172)return 4;
      return (Math.floor(x/588)!==Math.floor(y/588)?1:0)+
       (Math.floor(x/28)%21!==Math.floor(y/28)%21?1:0)+(x%28!==y%28?1:0);
    };
    for(const c of pool){
      let cost=Infinity;
      if(c.length===word.length){
        let n=0,d=0;for(let i=0;i<c.length;i++)if(c[i]!==word[i]){n++;d+=syllableCost(c[i],word[i]);if(n>1)break;}
        if(n===1)cost=d;
      }else if(Math.abs(c.length-word.length)===1){
        const shorter=c.length<word.length?c:word,longer=c.length>word.length?c:word;
        for(let i=1;i<longer.length-1;i++)if(longer.slice(0,i)+longer.slice(i+1)===shorter){cost=1.2;break;}
      }
      if(cost<=1.25)scored.push({word:c,cost});
    }
    scored.sort((a,b)=>a.cost-b.cost||a.word.localeCompare(b.word,'ko'));
    if(!scored.length)return [];
    const top=scored[0].cost;
    // A large tie is not a safe spelling recommendation.
    const best=scored.filter(x=>x.cost===top);
    return best.length<=limit?best.map(x=>x.word):[];
  }
  hasPOS(word,...poses){const e=this.words.get(word);return !!e&&poses.some(p=>e.pos.has(p));}
  // Resolve a surface eojeol to ONE dictionary headword (standard or nonstandard)
  // plus particles/endings. Garu resolves endings and irregular conjugation.
  lookupSurface(surface,tokens){
    const direct=this.words.get(surface);
    const inflected=this.forms.get(surface);
    const listed=direct||(inflected?.size===1?this.words.get([...inflected][0]):null);
    if(listed&&!listed.nonstandard)return listed;
    // A nonstandard spelling (안이 → 아니) can also be a standard word + particle
    // (안 + 이). If the analysis gives a standard reading, that reading wins.
    const analysed=this.lookupAnalysed(surface,tokens);
    if(analysed&&!analysed.nonstandard)return analysed;
    return listed||analysed;
  }
  lookupAnalysed(surface,tokens){
    if(!tokens?.length)return null;
    const tail=t=>/^(E|J)/.test(t.pos)||['VCP','VCN','XSN'].includes(t.pos); // XSN: 아이-들, 학생-님
    // Try the longest analysed head first: Garu may split a registered
    // compound (오래되다 → 오래/MAG + 되/VV), so the head may span tokens.
    for(let k=Math.min(tokens.length,4);k>=1;k--){
      const head=tokens.slice(0,k),rest=tokens.slice(k),last=head.at(-1);
      if(!rest.every(tail)||rest.filter(t=>t.pos==='EF').length>1)continue;
      if(head.some(t=>/^(J|EP|EF|ETM|ETN|S)/.test(t.pos)))continue;
      if(head.slice(0,-1).some(t=>/^E/.test(t.pos)&&t.pos!=='EC'))continue;
      const text=head.map(t=>t.text).join('');
      let lemma=null;
      if(/^(VV|VA|VX|XSV|XSA)$/.test(last.pos))lemma=text+'다';
      else if(/^(NNG|NNP|NP|NR|MAG|NNB|XSN|MM|MAJ|IC)$/.test(last.pos))lemma=text;
      if(!lemma)continue;
      const e=this.words.get(lemma);
      if(!e)continue;
      const predicate=lemma.endsWith('다')&&/^(VV|VA|VX|XSV|XSA)$/.test(last.pos);
      // An ending needs a predicate: after a noun/modifier it must follow 이다 (VCP/VCN).
      // (웬지 is not 웬 + ending -지.)
      if(!predicate){const copula=rest.findIndex(t=>['VCP','VCN'].includes(t.pos));
        if(rest.some((t,j)=>/^E/.test(t.pos)&&(copula<0||j<copula)))continue;}
      if(predicate){
        if(!['동사','형용사','보조 동사','보조 형용사'].some(p=>e.pos.has(p)))continue;
        // Reject lexical guesses that change the uninflected stem prefix (다먹→따먹).
        // The last stem syllable may contract or alternate.
        if(lemma.length>2&&!surface.startsWith(lemma.slice(0,-2)))continue;
      }else if(!surface.startsWith(lemma))continue; // noun + particles keeps the noun's spelling
      return e;
    }
    // Garu may not recognise a registered compound (작은집에서 → 작/VA 은/ETM 집 …).
    // Fall back to: nominal headword + the particles Garu found at the end.
    let k=tokens.length;while(k>0&&/^J/.test(tokens[k-1].pos))k--;
    const particles=tokens.slice(k).map(t=>t.text).join('');
    if(k<tokens.length&&surface.endsWith(particles)){
      const e=this.words.get(surface.slice(0,surface.length-particles.length));
      // Only a compound the dictionary records as built from parts (작은-집), so that
      // an unrelated simple word of the same spelling (갈수 '渴水' in 갈-ㄹ 수) is not used.
      if(e&&e.raw.some(r=>/[-^]/.test(r))&&['명사','대명사','수사','의존 명사'].some(p=>e.pos.has(p)))return e;
    }
    return null;
  }
}
