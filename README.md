# 집필자용 원고 1차 점검 v0.3 — Garu 연동 실험판

## 중요: 실행 방식
- HTML 더블클릭만으로는 Garu 모듈이 로드되지 않습니다. **GitHub Pages 배포 또는 로컬 Vite 실행**이 필요합니다.
- `npm install` → `npm run dev` 또는 GitHub Pages 배포(`main` 브랜치 push 후 Settings > Pages > Source: GitHub Actions).
- 배포 시 Vite가 `garu-ko`의 WASM/모델을 번들링해 브라우저에서 분석하며 원고 텍스트는 검사 API 서버로 전송하지 않습니다.
- 현재 작성 환경에서 npm 패키지 다운로드가 제한되어 **Garu 설치·브라우저 구동은 아직 검증하지 못했습니다**. GitHub Actions 빌드 로그와 실제 실행으로 확인이 필요합니다.

## 사용 기능
- 기존 편집 UI: 텍스트 편집/빨간 밑줄/검토 패널/글자 수/원고지 매수/목표 분량/전체 텍스트 복사/XLSX 내보내기.
- 규칙 관리 탭에는 **사내 규칙만** 노출, 초기 0개. 브라우저 localStorage 및 JSON 백업/복원.
- 기본 40개 표현 + 5개 제한된 패턴 검사는 이전 프로토타입에서 유지됨.
- 추가로 Garu 형태소 분석의 `VX`(보조 용언) 품사 태그가 확인되는 일부 결합 표현에 원칙 띄어쓰기 제안. 형태소 분석 결과는 정확한 맞춤법 교정 결과가 아니며 보조 용언 의미 판정도 완벽하지 않습니다.

## 알려진 제한
- **전체 국립국어원 규범이 구현된 검사기가 아닙니다.** 미검출·오검출이 있습니다. 집필자에게 정식 배포 전 검증 필수.
- Garu의 오프셋과 분석 토큰에 대한 브라우저 실제 검증이 필요합니다.
- 위 패턴들은 문맥에 민감합니다. 자동 수정하지 않고 제안을 확인한 다음 수동 적용하도록 설계했습니다.
- 기본 규칙의 표현별 문자열 탐지와 제한 패턴은 과거 코드의 한계를 그대로 갖습니다.
- 외부 API로 원고를 보내지 않지만, GitHub Pages 접근제어 및 내부 문서 보안 정책은 별도로 고려해야 합니다.
- 공유 사내 규칙 DB(Supabase)는 아직 연결하지 않았습니다.

## 주요 파일
- `index.html` 기존 화면과 검사 로직
- `src/garu-bridge.js` Garu 모듈 로드 및 검사기 연결
- `package.json`, `vite.config.js` 의존성 및 배포 설정
- `.github/workflows/deploy.yml` GitHub Actions 배포

## 출처
- https://github.com/ongjin/garu (MIT)
- https://www.korean.go.kr/kornorms/main/main.do
