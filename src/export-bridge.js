// 'Word로 내보내기' 버튼: 편집 영역에 지금 있는 원고 텍스트만 .docx로 저장한다.
// 교정을 적용했다면 적용된 원고가, 아니면 입력한 원고가 그대로 저장된다.
import {manuscriptToDocx,docxFileName,DOCX_MIME} from './docx-export.mjs';
const button=document.getElementById('wordBtn');
const status=document.getElementById('exportStatus');
const editor=document.getElementById('editor');
button.addEventListener('click',()=>{
  const blob=new Blob([manuscriptToDocx(editor.value)],{type:DOCX_MIME});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=docxFileName();a.style.display='none';
  document.body.append(a);a.click();
  // 링크를 곧바로 지우면 일부 브라우저가 파일 이름을 잃는다.
  setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},1000);
  status.textContent='현재 원고를 Word 파일로 저장했습니다.';
});
