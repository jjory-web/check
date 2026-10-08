# v0.9.0-beta.1 — 팀 공유용 평가 빌드

- 기존 UI, 데이터, 배포 설정 유지
- Garu 초기화 실패 시 사전 기반 제한 검사 유지(v0.8에서 계승)
- 제한 모드의 사전 결합 후보 검사를 인접 2~3어절까지 확장
- 단순 사전 등재만으로 교정 확정하지 않고 검토 후보로 표기
- 구두점·줄바꿈을 가로질러 붙이지 않도록 제한
- 새 회귀 테스트 추가

## 검증 범위
`node --test tests/fallback.test.mjs tests/fallback-window.test.mjs`로 제한 모드 테스트 가능.
Garu 전체 분석 및 실제 브라우저 배포는 별도 검증 필요. 검사 결과는 편집자가 재확인해야 함.

## 배포
현재 `.github/workflows/deploy.yml`은 `main` 푸시만 GitHub Pages에 배포함. `v0.8-test` 브랜치에 업로드한 것만으로 공유 URL은 생성되지 않음.
테스트 브랜치에서 `npm ci && npm test && npm run build` 및 브라우저 확인 후 `main`에 병합 권장.
