export function codePointOffsets(text){const result=[0];let n=0;for(const c of text){n+=c.length;result.push(n);}return result;}
export function analyzeUTF16(engine,text){
  const r=engine.analyze(text),offsets=codePointOffsets(text);
  if(!r||!Array.isArray(r.tokens))throw new Error('Garu 토큰 형식 오류');
  const tokens=r.tokens.map(t=>{
    if(!t.text||!t.pos||!Number.isInteger(t.start)||!Number.isInteger(t.end)||t.start<0||t.end<=t.start||t.end>=offsets.length)throw new Error('Garu 토큰 위치 오류');
    return {...t,start:offsets[t.start],end:offsets[t.end]};
  });return {...r,tokens};
}
export function verifyMorphology(engine){
  const input='😀 학생이 글을 읽었다.',r=analyzeUTF16(engine,input);
  if(!r.tokens.some(t=>t.text==='학생'&&t.pos==='NNG'&&input.slice(t.start,t.end)==='학생이')||!r.tokens.some(t=>t.pos==='JKO')||!r.tokens.some(t=>t.pos==='EF'))throw new Error('Garu 품사/위치 실측 실패');
  return {tokens:r.tokens.length,offsetUnit:'codePoint',convertedTo:'UTF-16'};
}
