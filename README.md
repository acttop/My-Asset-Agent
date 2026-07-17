# 내 자산관리

로그인/클라우드 없이 로컬에서만 동작하는 개인용 자산관리 앱입니다. 주식·코인·ETF 보유종목, 배당, 자산배분, 리밸런싱, 백테스팅을 관리합니다.

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속.

- `npm run dev` — 파일 변경 시 자동 재시작 (개발용)
- `npm start` — 일반 실행
- `npm run backup` — `data/`의 현재 데이터를 `data/backups/<타임스탬프>/`로 백업

## 데이터

모든 데이터는 `data/` 디렉터리의 JSON 파일에 저장됩니다 (DB 없음, git 추적 제외).

- `events.json` — **유일한 원본 데이터**. 계좌/입금/출금/매수/매도/배당 이력. 직접 열어서 확인·백업 가능
- `holdings.json` — `events.json`으로부터 자동 재계산되는 파생 캐시 (직접 수정하지 마세요 — 다음 이벤트 변경 시 덮어써집니다)
- `accounts.json`, `rebalance-config.json`, `backtest-portfolios.json`, `ticker-meta.json` — 각각 계좌, 리밸런싱 목표, 백테스트 포트폴리오, 종목 메타정보
- `price-cache/<티커>.json` — 시세 캐시 (자동 생성/갱신)

데이터를 백업하려면 `npm run backup`을 실행하거나 `data/` 폴더 전체를 복사하세요.

## 시세 데이터 출처

- 한국 주식(`.KS`/`.KQ`): 네이버 금융 비공식 API
- 미국/해외 주식·ETF, 환율: Yahoo Finance 비공식 API

두 API 모두 비공식(비공개) 엔드포인트이므로 예고 없이 응답 형식이 바뀌거나 차단될 수 있습니다. 조회 실패 시 마지막으로 캐시된 값을 "지연" 표시와 함께 보여줍니다.

## 구조

```
server/    Express 서버 (routes/services/data/priceProviders)
public/    프런트엔드 (바닐라 JS + Tailwind CDN + Chart.js)
data/      사용자 데이터 (JSON, git 추적 제외)
scripts/   백업 스크립트
```

## 기능

- 대시보드: 총자산/순납입금/누적수익률/연평균수익률(XIRR), 자산배분(계좌·유형·종목별), 자산 성장 추이, 월별 수익률, 계좌별 수익률 비교
- 보유종목: 실시간(캐시) 시세 기반 평가금액/비중
- 이벤트 이력: 입금/출금/매수/매도/배당 기록, 유형 필터, 메모·티커 검색
- 배당: 누적/당해년도/예상 연간 배당, 시가배당률, YoC(투자배당률)
- 리밸런싱: 계좌별 목표 비중 설정, 괴리율 임계값, 필요 매매액 계산
- 백테스팅: 목표 배분으로 과거 구간 시뮬레이션 (정기 리밸런싱/납입 포함, 수수료·세금 제외)
