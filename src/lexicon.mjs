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
  }
  has(word){return this.words.has(word);}
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
