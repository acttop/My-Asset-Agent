import { escapeHtml } from './format.js';

// 종목명 아래 티커를 작게 보여주는 두 줄 표시 형식 — 보유종목/리밸런싱/백테스팅 등
// 종목명이 나오는 모든 화면에서 공통으로 쓴다.
export function nameTickerCell(name, ticker) {
  return `
    <div>${escapeHtml(name ?? '-')}</div>
    ${ticker ? `<div class="text-xs text-slate-400">${escapeHtml(ticker)}</div>` : ''}
  `;
}

// 종목 목록 앞에 붙이는 색상 점 — 리밸런싱 목표 비중/백테스팅 포트폴리오 구성에서 공통으로 순환 사용한다.
export const DOT_COLORS = ['#f97316', '#10b981', '#22c55e', '#a855f7', '#ec4899', '#eab308', '#3b82f6', '#06b6d4'];
