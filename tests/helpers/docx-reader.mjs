// 테스트용 .docx 판독기: ZIP(STORED/DEFLATE) 해제 + CRC 확인 + 문단 텍스트 추출.
import {inflateRawSync,crc32} from 'node:zlib';
export function unzip(buffer){
  const b=Buffer.from(buffer),files=new Map();
  const eocd=b.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
  if(eocd<0)throw new Error('ZIP 끝 레코드 없음');
  let p=b.readUInt32LE(eocd+16);const count=b.readUInt16LE(eocd+10);
  for(let i=0;i<count;i++){
    if(b.readUInt32LE(p)!==0x02014b50)throw new Error('중앙 디렉터리 손상');
    const method=b.readUInt16LE(p+10),crc=b.readUInt32LE(p+16),size=b.readUInt32LE(p+20),nameLen=b.readUInt16LE(p+28),extra=b.readUInt16LE(p+30),comment=b.readUInt16LE(p+32),local=b.readUInt32LE(p+42);
    const name=b.subarray(p+46,p+46+nameLen).toString('utf8');
    const lName=b.readUInt16LE(local+26),lExtra=b.readUInt16LE(local+28),start=local+30+lName+lExtra;
    const raw=b.subarray(start,start+size),data=method===0?raw:inflateRawSync(raw);
    if(crc32(data)!==crc)throw new Error('CRC 불일치: '+name);
    files.set(name,data);p+=46+nameLen+extra+comment;
  }
  return files;
}
const unescape=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
// 본문 문단마다 텍스트(탭 포함)를 돌려준다.
export function docxParagraphs(buffer){
  const xml=unzip(buffer).get('word/document.xml').toString('utf8');
  const body=xml.slice(xml.indexOf('<w:body>'),xml.indexOf('<w:sectPr'));
  return [...body.matchAll(/<w:p\/>|<w:p>([\s\S]*?)<\/w:p>/g)].map(m=>[...(m[1]||'').matchAll(/<w:t[^>]*>([^<]*)<\/w:t>|<w:tab\/>/g)].map(t=>t[0]==='<w:tab/>'?'\t':unescape(t[1])).join(''));
}
