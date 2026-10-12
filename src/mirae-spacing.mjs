// 검수된 미래엔 사전 예시만 제한적으로 제안합니다. 문맥 판정과 자동 수정은 하지 않습니다.
// 웹 배포에는 사전 원문 데이터가 포함되지 않습니다.
export const MIRAE_REVIEW_CASES = [
  {from:'그 다음날',to:'그다음 날',reason:'특정일을 기준으로 한 그다음 날을 나타낼 때의 표기입니다. 문맥을 확인하세요.',heading:'날[日]'},
  {from:'한강가',to:'한강 가',reason:'강 이름을 나타내는 고유 명사 뒤의 ‘가’는 띄어 씁니다.',heading:'∨가'},
  {from:'과일가게',to:'과일 가게',reason:'사전에 한 단어로 등재되지 않은 일반적인 가게 이름은 띄어 씁니다.',heading:'가게'},
  {from:'꽃가게',to:'꽃 가게',reason:'일상생활에서 물건의 이름으로 지은 일반적인 가게 이름은 띄어 씁니다.',heading:'가게'},
  {from:'그릇가게',to:'그릇 가게',reason:'일상생활에서 물건의 이름으로 지은 일반적인 가게 이름은 띄어 씁니다.',heading:'가게'}
];
export function checkMiraeExamples(text){
  const hits=[];
  for (const r of MIRAE_REVIEW_CASES){
    let pos=0;
    while((pos=text.indexOf(r.from,pos))!==-1){
      const before=text[pos-1]||'',after=text[pos+r.from.length]||'';
      if(!/[가-힣A-Za-z0-9]/.test(before)&&!/[가-힣A-Za-z0-9]/.test(after))
        hits.push({id:'mirae_review',name:'미래엔 편집 기준',from:r.from,to:r.to,start:pos,end:pos+r.from.length,
          level:'review',kind:'review',review:true,label:'문맥 확인',priority:5,
          reason:r.reason+' 사전 항목: '+r.heading,source:'미래엔 띄어쓰기 사전 · 편집 사례'});
      pos+=r.from.length;
    }
  }
  return hits;
}
