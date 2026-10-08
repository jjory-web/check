import {findCompoundSpacingCandidates} from './compound-spacing.mjs';
// Optional on-device dictionary index. No API key, no user manuscript uploaded.
// This is a lexical check, NOT proof that a sentence's spacing is correct.
export async function loadHeadwords(){
  const url = `${import.meta.env.BASE_URL}data/stdict-headwords.json`;
  const response = await fetch(url,{cache:'no-store'});
  if(!response.ok) return {loaded:false,count:0,reason:'사전 데이터 파일 없음'};
  const data=await response.json();
  if(!Array.isArray(data.headwords)) throw new Error('사전 데이터 형식 오류');
  const words=new Set(data.headwords);
  window.setDictionaryEngine?.({has:(word)=>words.has(word),findCompounds:(text)=>findCompoundSpacingCandidates(text,word=>words.has(word)),size:words.size});
  return {loaded:true,count:words.size};
}
