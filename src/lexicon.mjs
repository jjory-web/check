// Whole-source index: retain phrases/affixes in data, but never flatten them into words.
const lexicalPOS = new Set(['명사','대명사','수사','동사','형용사','부사','감탄사','관형사','의존 명사','보조 동사','보조 형용사']);
export function normalizeHeadword(raw) { return raw.replace(/\(\d+\)$/,'').replace(/-/g,'').replace(/\^/g,' '); }
export class Lexicon {
  constructor(data) {
    if(data.schemaVersion!==1 || !Array.isArray(data.entries) || data.rowCount!==data.entries.length) throw new Error('사전 색인 형식/행 수 오류');
    this.data=data;this.words=new Map();this.forms=new Map();
    for(const [raw,ui,pi,inflection,restricted] of data.entries){
      const word=normalizeHeadword(raw),pos=data.poses[pi];
      if(restricted || data.units[ui]!=='단어' || !/^[가-힣]+$/.test(word) || !pos.some(p=>lexicalPOS.has(p)))continue;
      let entry=this.words.get(word);
      if(!entry){entry={word,pos:new Set(),raw:[],forms:new Set()};this.words.set(word,entry);}
      pos.forEach(p=>entry.pos.add(p));entry.raw.push(raw);
      if(pos.some(p=>/동사|형용사/.test(p))){
        const clean=inflection.replace(/\[[^\]]*\]/g,'');
        for(const form of clean.match(/[가-힣]+/g)||[]){
          entry.forms.add(form);
          if(!this.forms.has(form)) this.forms.set(form,new Set());
          this.forms.get(form).add(word);
        }
      }
    }
    this.size=this.words.size;
    // Length/initial-syllable index over every usable dictionary headword.
    // This is NOT a list of hand-written misspellings.
    this.candidateBuckets=new Map();
    for(const word of this.words.keys()){
      if(word.length<2||word.length>16)continue;
      const key=word.length+':'+word[0];
      if(!this.candidateBuckets.has(key))this.candidateBuckets.set(key,[]);
      this.candidateBuckets.get(key).push(word);
    }
  }
  has(word){return this.words.has(word);}
  // All candidates are drawn from the complete dictionary, not a list of errors.
  // Return candidates for attached Korean particles as well as bare headwords.
  // "review" is mandatory because the source index does not contain definitions.
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
        if(suffix&&!['명사','대명사','수사','의존 명사'].some(pos=>entry?.pos.has(pos)))continue;
        seen.add(combined);results.push({word:combined,base:candidate,suffix,source:'dictionary',review:true});
      }
    }
    return results.slice(0,limit);
  }
  // Look for attached counters without maintaining a list of example phrases.
  // A valid quantity prefix plus a dictionary counter can require a space.
  findCounterSplit(surface){
    for(let i=1;i<surface.length;i++){
      const left=surface.slice(0,i),right=surface.slice(i);
      if((/^(몇|여러|모든|각|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)$/.test(left)||/^[0-9]+$/.test(left))&&this.hasPOS(right,'의존 명사'))return [left,right];
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
  // Garu resolves endings and irregular conjugation; do not append a fixed list of endings.
  lookupSurface(surface,tokens){
    const direct=this.words.get(surface);
    if(direct)return direct;
    const inflected=this.forms.get(surface);
    if(inflected?.size===1)return this.words.get([...inflected][0]);
    const first=tokens[0];if(!first)return null;
    let lemma=null,consumed=1;
    if(['VV','VA','VX'].includes(first.pos))lemma=first.text+'다';
    else if(['NNG','NNP','NP','NR','MAG','NNB'].includes(first.pos)){
      lemma=first.text;
      if(['XSV','XSA'].includes(tokens[1]?.pos)){lemma+=tokens[1].text+'다';consumed=2;}
    }
    if(!lemma||!this.has(lemma))return null;
    if(tokens.slice(consumed).some(t=>!(/^(E|J)/.test(t.pos)||['VCP','VCN'].includes(t.pos))))return null;
    const e=this.words.get(lemma);
    if(tokens.filter(t=>t.pos==='EF').length>1)return null;
    // Reject lexical guesses that change the uninflected stem prefix (다먹→따먹).
    // The last stem syllable may contract or alternate; stored irregular forms
    // also remain available above. Uncertain short stems are left to the analyzer.
    if(lemma.endsWith('다')&&lemma.length>2&&!surface.startsWith(lemma.slice(0,-2)))return null;
    if(['VV','VA','VX'].includes(first.pos)&&!['동사','형용사','보조 동사','보조 형용사'].some(p=>e.pos.has(p)))return null;
    // Noun + particles must preserve the noun's actual spelling, not just an analyzer guess.
    if(!lemma.endsWith('다')&&!surface.startsWith(lemma))return null;
    return e;
  }
}
