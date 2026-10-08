// 사전 표제어를 활용하는 두 어절 결합 후보 검사.
// 등재 여부는 충분조건이 아니므로 언제나 '문맥 검토'로 표시합니다.
// 브라우저에서만 실행하며 텍스트를 외부로 전송하지 않습니다.
const ENDINGS = [
  ['보았습니다','보다'],['보았어요','보다'],['보았다','보다'],['보았고','보다'],
  ['봤습니다','보다'],['봤어요','보다'],['봤다','보다'],['보세요','보다'],
  ['보겠어요','보다'],['보겠다','보다'],['보는','보다'],['보면','보다'],['보자','보다'],['보다','보다'],
  ['갔습니다','가다'],['갔어요','가다'],['갔다','가다'],['갑니다','가다'],['가면','가다'],['가고','가다'],['가는','가다'],['가다','가다'],
  ['왔습니다','오다'],['왔어요','오다'],['왔다','오다'],['옵니다','오다'],['오는','오다'],['오면','오다'],['오다','오다'],
  ['줬습니다','주다'],['줬어요','주다'],['줬다','주다'],['주었다','주다'],['주세요','주다'],['준다','주다'],['주다','주다'],
  ['냈습니다','내다'],['냈어요','내다'],['냈다','내다'],['내었다','내다'],['낸다','내다'],['내다','내다'],
  ['뒀습니다','두다'],['뒀어요','두다'],['뒀다','두다'],['두었다','두다'],['두다','두다'],
];
const PARTS = [...ENDINGS].sort((a,b)=>b[0].length-a[0].length);
export function findCompoundSpacingCandidates(text, hasHeadword){
  if(typeof hasHeadword!=='function') return [];
  const result=[];
  // 한글 어절 2개가 공백으로 분리된 경우에만 조사. 줄바꿈을 넘어 검사하지 않음.
  const regex=/(?=([가-힣]{2,16})([ \t]+)([가-힣]{2,16})(?=$|[^가-힣]))/g;
  for(const m of text.matchAll(regex)){
    if(m.index>0 && /[가-힣]/.test(text[m.index-1]))continue;
    const left=m[1],right=m[3];
    if(/^(?:은|는|이|가|을|를|에서|에게|으로)$/.test(right))continue;
    const ending=PARTS.find(([surface])=>right===surface);
    if(!ending)continue;
    const lemma=left+ending[1];
    if(!hasHeadword(lemma))continue;
    result.push({id:'dict_compound',name:'사전 등재 한 단어 검토',from:left+m[2]+right,to:left+right,
      start:m.index,end:m.index+left.length+m[2].length+right.length,review:true,
      source:'표준국어대사전 표제어 참고',
      reason:`‘${lemma}’는 표준국어대사전에 한 단어로 등재되어 있습니다. 이 문맥에서 해당 단어의 활용형으로 쓰였다면 붙여 쓰세요. 별개의 본용언·보조 용언 구성일 수 있으므로 수정 전에 확인이 필요합니다.`});
  }
  return result;
}
