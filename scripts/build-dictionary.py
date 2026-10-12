#!/usr/bin/env python3
"""Build a reproducible lexical index from ALL sheets in the official XLS ZIP.

Requires xlrd==2.0.2. Keeps ^ (phrase boundary), - (morph boundary) and POS.
No expression-specific correction list: normative information is taken only
from the dictionary itself.

Normative ("규범") information
------------------------------
In 표준국어대사전, a headword that is a non-standard word or a spelling that
does not follow the orthographic rules is recorded with a definition of the
form ``→ 표준어.`` (e.g. 몇-일 → 며칠, 컨텐츠 → 콘텐츠, 오랫-만 → 오랜만).
That arrow target is stored in the ``norm`` column. The explanatory note in
the ``한 걸음 더`` column is kept in ``normNotes`` when it states the rule.

A definition where only one sense is ``→ …`` is NOT treated as an error,
because the other senses are valid. Whether a *spelling* is wrong is decided
in the browser (lexicon.mjs): only when every 단어 homonym of that spelling is
an arrow entry.

The original archive is not redistributed.
"""
import argparse, collections, hashlib, json, re, zipfile
from pathlib import Path
import xlrd

p = argparse.ArgumentParser()
p.add_argument('archive', type=Path)
p.add_argument('--output', type=Path, default=Path('public/data/stdict-lexicon.json'))
a = p.parse_args()

units = []; poses = []; rows = []; files = []; counts = collections.Counter()
norm_notes = {}
norm_count = 0

def idx(table, value):
    if value not in table:
        table.append(value)
    return table.index(value)

ARROW = re.compile(r'^→\s*(?:<[^>]+>[^<]*</[^>]+>)?\s*([^.\n<]+?)_?\.(?:\s|$)')
# Categories that are not correction targets when EVERY sense carries them.
RESTRICTED_CATEGORY = re.compile('북한어|옛말|방언')

def norm_target(definition):
    """Return the standard form for a whole-entry ``→ X.`` definition."""
    d = definition.strip()
    if not d.startswith('→'):
        return ''
    m = ARROW.match(d)
    if not m:
        return ''
    target = m.group(1).strip()
    # 대머리01 → 대머리, 다예^철산 style spaces are already spaces here.
    target = re.sub(r'(?<=[가-힣])\d+', '', target).replace('-', '').replace('^', ' ')
    if not re.fullmatch(r'[가-힣 ]+', target):
        return ''
    return target

def restricted_category(category):
    senses = [c.strip() for c in re.split(r'「\d+」|\[[^\]]+\]|\n', category) if c.strip()]
    return bool(senses) and all(RESTRICTED_CATEGORY.search(s) for s in senses)

def clean_note(note):
    note = re.sub(r'</?IN>', '', note).strip().lstrip('·').strip()
    return note if re.search('규범|표준어|표기', note) else ''

with zipfile.ZipFile(a.archive) as z:
    for name in sorted(z.namelist()):
        if not name.lower().endswith('.xls'):
            continue
        book = xlrd.open_workbook(file_contents=z.read(name))
        for sheet in book.sheets():
            headers = sheet.row_values(0)
            required = ['어휘', '구성 단위', '품사', '활용', '범주', '뜻풀이', '한 걸음 더']
            if not all(x in headers for x in required):
                raise ValueError(f'Unexpected columns: {name}')
            cols = {x: headers.index(x) for x in required}; n = 0
            for i in range(1, sheet.nrows):
                r = sheet.row_values(i); word = str(r[cols['어휘']]).strip()
                if not word:
                    continue
                pos = sorted(set(re.findall('「([^」]+)」', str(r[cols['품사']]))))
                unit = str(r[cols['구성 단위']]); forms = str(r[cols['활용']]).strip()
                category = str(r[cols['범주']]); definition = str(r[cols['뜻풀이']])
                restricted = restricted_category(category)
                target = norm_target(definition)
                if target:
                    norm_count += 1
                    note = clean_note(str(r[cols['한 걸음 더']]))
                    if note:
                        norm_notes[word] = note
                rows.append([word, idx(units, unit), idx(poses, pos), forms, int(restricted), target])
                counts[unit] += 1; n += 1
            files.append({'file': name, 'sheet': sheet.name, 'rows': n})
        book.release_resources()

data = {'schemaVersion': 2, 'source': '국립국어원 표준국어대사전 전체 내려받기 2026-09-04',
        'sourceUrl': 'https://stdict.korean.go.kr/', 'license': 'CC BY-SA 2.0 KR',
        'licenseUrl': 'https://www.korean.go.kr/front/page/pageView.do?page_id=P000508',
        'archiveSha256': hashlib.sha256(a.archive.read_bytes()).hexdigest(),
        'rowCount': len(rows), 'unitCounts': dict(sorted(counts.items())), 'files': files,
        'columns': ['rawHeadword', 'unitIndex', 'posIndex', 'inflection', 'restricted', 'norm'],
        'normRows': norm_count, 'normNotes': norm_notes,
        'units': units, 'poses': poses, 'entries': rows}
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
print(json.dumps({'rows': len(rows), 'units': dict(counts), 'normRows': norm_count,
                  'normNotes': len(norm_notes),
                  'restricted': sum(r[4] for r in rows), 'bytes': a.output.stat().st_size}, ensure_ascii=False))
