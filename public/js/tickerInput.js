import { api } from './api.js';

// 6자리 숫자만 입력하면 국내 코스피 종목으로 보고 .KS를 자동으로 붙인다.
// (코스닥이면 사용자가 직접 .KQ로 고쳐야 함 — 접미사 없이는 구분할 방법이 없음)
export function normalizeTicker(raw) {
  const value = raw.trim();
  if (/^\d{6}$/.test(value)) return `${value}.KS`;
  return value;
}

// 티커 입력창 옆에 실시간으로 "종목명 (현재가)" 또는 "조회 실패"를 보여준다.
// input, statusEl: DOM 요소. onResolved(ticker): 정규화된 티커로 유효성 확인 후 콜백(선택).
export function wireTickerValidation(inputEl, statusEl, onResolved) {
  let latestRequestId = 0;

  async function check() {
    const raw = inputEl.value.trim();
    if (!raw) {
      statusEl.textContent = '';
      return;
    }
    const normalized = normalizeTicker(raw);
    if (normalized !== raw) inputEl.value = normalized;

    const requestId = ++latestRequestId;
    statusEl.textContent = '조회 중...';
    statusEl.className = 'text-xs text-slate-400';

    try {
      const quote = await api.getPrice(normalized);
      if (requestId !== latestRequestId) return; // 더 최신 입력이 있으면 이 결과는 버림
      statusEl.textContent = `✓ ${formatQuotePreview(quote)}`;
      statusEl.className = 'text-xs text-emerald-600';
      onResolved?.(normalized);
    } catch (err) {
      if (requestId !== latestRequestId) return;
      statusEl.textContent = `✗ 조회 실패: 티커를 확인해주세요`;
      statusEl.className = 'text-xs text-red-500';
    }
  }

  inputEl.addEventListener('blur', check);
}

function formatQuotePreview(quote) {
  const price = new Intl.NumberFormat('ko-KR').format(quote.price);
  return `${price} ${quote.currency}`;
}
