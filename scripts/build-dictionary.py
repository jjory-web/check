#!/usr/bin/env python3
"""Build a reproducible lexical index from ALL sheets in the official XLS ZIP.
Requires xlrd==2.0.2. Keep ^ (phrase boundary), - (morph boundary) and POS.
No expression-specific correction list. The original archive is not redistributed.
"""
import argparse, collections, hashlib, json, re, zipfile
from pathlib import Path
import xlrd
p=argparse.ArgumentParser();p.add_argument('archive',type=Path);p.add_argument('--output',type=Path,default=Path('public/data/stdict-lexicon.json'));a=p.parse_args()
units=[];poses=[];rows=[];files=[];counts=collections.Counter()
def idx(table,value):
    if value not in table: table.append(value)
    return table.index(value)
with zipfile.ZipFile(a.archive) as z:
    for name in sorted(z.namelist()):
        if not name.lower().endswith('.xls'): continue
        book=xlrd.open_workbook(file_contents=z.read(name))
        for sheet in book.sheets():
            headers=sheet.row_values(0)
            required=['어휘','구성 단위','품사','활용','범주','뜻풀이']
            if not all(x in headers for x in required): raise ValueError(f'Unexpected columns: {name}')
            cols={x:headers.index(x) for x in required};n=0
            for i in range(1,sheet.nrows):
                r=sheet.row_values(i);word=str(r[cols['어휘']]).strip()
                if not word: continue
                pos=sorted(set(re.findall('「([^」]+)」',str(r[cols['품사']]))))
                unit=str(r[cols['구성 단위']]);forms=str(r[cols['활용']]).strip()
                category=str(r[cols['범주']]);definition=str(r[cols['뜻풀이']])
                # Do not treat historical/regional/nonstandard entries as correction targets.
                restricted=bool(re.search('북한어|옛말|방언|비표준어',category) or re.search('의 (?:옛말|방언|북한어|잘못)',definition))
                rows.append([word,idx(units,unit),idx(poses,pos),forms,int(restricted)])
                counts[unit]+=1;n+=1
            files.append({'file':name,'sheet':sheet.name,'rows':n})
        book.release_resources()
data={'schemaVersion':1,'source':'국립국어원 표준국어대사전 전체 내려받기 2026-09-04',
      'sourceUrl':'https://stdict.korean.go.kr/','license':'CC BY-SA 2.0 KR',
      'licenseUrl':'https://www.korean.go.kr/front/page/pageView.do?page_id=P000508',
      'archiveSha256':hashlib.sha256(a.archive.read_bytes()).hexdigest(),
      'rowCount':len(rows),'unitCounts':dict(sorted(counts.items())),'files':files,
      'columns':['rawHeadword','unitIndex','posIndex','inflection','restricted'],
      'units':units,'poses':poses,'entries':rows}
a.output.parent.mkdir(parents=True,exist_ok=True)
a.output.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
print(json.dumps({'rows':len(rows),'units':dict(counts),'bytes':a.output.stat().st_size},ensure_ascii=False))
