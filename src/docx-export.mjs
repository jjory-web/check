// 원고 텍스트만 담은 Word(.docx) 파일 생성. 외부 의존성 없음(브라우저·Node 공용).
//
// 담는 것: 원고 텍스트 그대로. 줄 하나가 Word 문단 하나가 되며 빈 줄은 빈 문단으로 남는다.
// 담지 않는 것: 제목, 표지, 검사 결과, 수정 이력, 교정 사유, 오류 표시, 글자 수, 원고지 매수.
// 서식: 한국어 줄 바꿈(어절 단위)과 한글 글꼴이 자연스럽도록 문서 기본값만 지정한다.

const encoder = new TextEncoder();
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// XML 1.0에서 허용되지 않는 제어 문자는 제거하고, 특수 문자는 이스케이프한다.
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
const escapeXml = (s) => s.replace(INVALID_XML, '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function manuscriptParagraphs(text) {
  return String(text ?? '').split(/\r\n|\r|\n/);
}

function paragraphXml(line) {
  if (!line) return '<w:p/>';
  // 탭은 Word의 탭 요소로, 나머지는 공백을 그대로 보존한다.
  const runs = line.split('\t').map((part, i) =>
    (i ? '<w:tab/>' : '') + (part ? `<w:t xml:space="preserve">${escapeXml(part)}</w:t>` : '')).join('');
  return `<w:p><w:r>${runs}</w:r></w:p>`;
}

export function documentXml(text) {
  const body = manuscriptParagraphs(text).map(paragraphXml).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>` +
    '<w:pgMar w:top="1701" w:right="1440" w:bottom="1440" w:left="1440" w:header="851" w:footer="992" w:gutter="0"/></w:sectPr>' +
    '</w:body></w:document>';
}

const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:docDefaults><w:rPrDefault><w:rPr>' +
  '<w:rFonts w:ascii="맑은 고딕" w:eastAsia="맑은 고딕" w:hAnsi="맑은 고딕" w:cs="맑은 고딕"/>' +
  '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US" w:eastAsia="ko-KR" w:bidi="ar-SA"/>' +
  '</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:wordWrap w:val="0"/><w:spacing w:after="0"/></w:pPr></w:pPrDefault></w:docDefaults>' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
  '</w:styles>';

export function docxEntries(text) {
  return [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '</Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>'],
    ['word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>'],
    ['word/styles.xml', STYLES],
    ['word/document.xml', documentXml(text)],
  ];
}

// ---- 최소 ZIP(STORED, 무압축) 작성기 ----
let crcTable = null;
function crc32(bytes) {
  if (!crcTable) crcTable = Array.from({ length: 256 }, (_, n) => { for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
  let c = -1; for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0;
}
const u16 = (n) => [n & 255, (n >>> 8) & 255];
const u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
// 1980-01-01 00:00 (고정값: 같은 원고는 같은 파일이 된다)
const DOS_TIME = 0, DOS_DATE = (0 << 9) | (1 << 5) | 1;

export function zipStored(entries) {
  const parts = [], central = []; let offset = 0;
  for (const [filename, content] of entries) {
    const name = encoder.encode(filename), data = typeof content === 'string' ? encoder.encode(content) : content, crc = crc32(data);
    // 일반 목적 비트 11(0x0800): 파일 이름이 UTF-8
    const header = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(DOS_TIME), ...u16(DOS_DATE), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)];
    const local = new Uint8Array([...u32(0x04034b50), ...header, ...name]);
    parts.push(local, data);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...header, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name]));
    offset += local.length + data.length;
  }
  const centralSize = central.reduce((a, c) => a + c.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length), ...u32(centralSize), ...u32(offset), ...u16(0)]);
  const all = [...parts, ...central, end], out = new Uint8Array(all.reduce((a, c) => a + c.length, 0));
  let p = 0; for (const c of all) { out.set(c, p); p += c.length; }
  return out;
}

export function manuscriptToDocx(text) {
  return zipStored(docxEntries(text));
}

export function docxFileName(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `원고_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.docx`;
}
