import {Lexicon} from './lexicon.mjs';
export async function loadHeadwords(url){
  const response=await fetch(url);
  if(!response.ok)throw new Error(`사전 파일 로드 실패 (${response.status})`);
  return new Lexicon(await response.json());
}
