# 집필자용 원고 1차 점검 v0.7 — 사전·형태소 기반 띄어쓰기 엔진

기존 2단 UI와 시리즈 편집 규칙 관리 화면을 유지한 엔진 개선판입니다.
**완성된 범용 맞춤법 검사기가 아닙니다.** 문맥 판정, 일반 오탈자 및 외래어 교정 전반은 구현되지 않았습니다.

## 실행 및 테스트

Node.js 22 이상을 사용합니다.

```bash
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run dev
```

브라우저 테스트는 실제 WASM·모델·전체 사전 색인을 로드합니다. 테스트 실행 전에 반드시 빌드하세요.
기존 Chromium 실행 파일을 쓰려면 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`를 지정할 수 있습니다.
HTML 파일을 더블클릭하는 방식으로는 Worker와 WASM을 실행할 수 없습니다.

## 변경 내용

- 업로드한 XLS ZIP의 15개 파일·436,587행을 전부 변환합니다. 표제어, 동음이의어 번호, 구성 단위, 품사, 활용 정보, 제한 표지를 보존합니다.
- 어휘의 `-`는 단어 내부 경계로, `^`는 구의 공백으로 처리합니다. 구·속담·관용구를 무조건 붙여 쓰게 하지 않습니다.
- 검사 대상으로 쓰는 현대 한글 단어 색인은 중복 표제어 통합 후 283,354개입니다. 북한어·옛말·방언·비표준어 등 제한 항목은 교정 목표에서 제외합니다.
- 정해진 단어·활용형 목록을 순회하던 코드를 제거했습니다. 인접 2~4어절의 결합형을 전체 단어 색인 및 형태소 분석과 대조합니다.
- Garu의 본용언·보조 용언·조사·어미·관형사형·명사 분석을 활용합니다. 보조 용언은 ‘원칙 표기 권장’, 사전 결합 후보는 ‘문맥 확인’으로 제시합니다.
- Garu의 위치는 Unicode 코드 포인트 기준이므로 UTF-16으로 변환합니다. 형태소별 위치로 오해하지 않고, 분리 전후의 분석 일치 여부로 단어 내부 경계를 찾습니다.
- 무거운 분석은 Web Worker에서 실행합니다. 입력 지연 처리, 최신 원고 결과만 적용, 문단별 캐시를 적용했습니다.
- 엔진 실패를 검사 완료로 표시하지 않습니다. 사용자가 추가한 시리즈 규칙은 엔진 실패 시에도 작동합니다.

## 사전 재생성

현재 색인은 저장소에 포함되어 있으므로 일상 빌드에 Python은 필요하지 않습니다.
원본 ZIP을 변경했을 때만 다음 명령을 사용합니다.

```bash
python3 -m pip install xlrd==2.0.2
python3 scripts/build-dictionary.py /path/to/전체_엑셀.zip
npm run test:all
```

출처: 국립국어원 표준국어대사전 전체 내려받기(2026-09-04).
사전 파생 데이터는 원 데이터의 CC BY-SA 2.0 KR 표시를 유지합니다. 출처·변환 내용·원본 SHA-256은 JSON 메타데이터에 기록합니다.

## 배포

이 작업에서 운영 사이트를 변경하지 않았습니다.
수정본을 저장소에 반영한 뒤 `main`에 push하면 기존 GitHub Pages 배포 workflow가 실행됩니다.
수정된 workflow는 엔진 테스트 → 빌드 → 브라우저 테스트 통과 후 배포합니다.

ZIP으로 반영할 때는 내부 파일 구조를 그대로 유지해 저장소 루트에 덮어쓰고, 더 이상 사용하지 않는 다음 파일은 삭제합니다.

- `src/compound-spacing.mjs`
- `public/data/stdict-headwords.json`

전체 파일이 필요합니다. `index.html`만 교체해서는 작동하지 않습니다.

## 파일 안내

- `docs/engine-review.md`: 기존 문제점, 구현 범위, 실측 결과, 한계
- `docs/validation.txt`: 최종 자동 테스트 및 빌드 원문 로그
- `scripts/build-dictionary.py`: 재현 가능한 사전 변환기
- `src/lexicon.mjs`: 전체 사전과 활용형 색인
- `src/morphology.mjs`: 실제 Garu 검증, 위치 변환
- `src/proofreader.mjs`: 공통 검사 로직
- `src/engine-worker.js`, `src/garu-bridge.js`: 비동기 분석 및 기존 UI 연결
- `tests/engine.test.mjs`, `tests/browser.test.mjs`: 실모델 기반 회귀·통합 테스트

원고는 브라우저 내부에서 처리합니다. 서버로 검사 요청을 보내지 않습니다.
공유 규칙 DB(Supabase) 연결은 이번 작업에 포함하지 않았습니다.
