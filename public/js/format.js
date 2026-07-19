// 계좌명/메모/포트폴리오명 등 사용자가 직접 입력한 텍스트를 HTML 템플릿에 그대로 넣으면
// <img onerror=...> 같은 값이 스크립트로 실행될 수 있어(XSS), innerHTML에 꽂기 전에 반드시 이스케이프한다.
export function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatCurrency(value, currency = 'KRW') {
  if (value == null || Number.isNaN(value)) return '-';
  try {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${formatNumber(value)} ${currency}`;
  }
}

export function formatPercent(value) {
  if (value == null || Number.isNaN(value)) return '-';
  return `${(value * 100).toFixed(2)}%`;
}

export function formatNumber(value, digits = 0) {
  if (value == null || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: digits }).format(value);
}

// 원화 금액을 만원/억원 단위로 축약 표시한다 (예: 78010000 -> "7,801만원", 284000000 -> "2.84억원").
export function formatCompactWon(value) {
  if (value == null || Number.isNaN(value)) return '-';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 100000000) return `${sign}${(abs / 100000000).toFixed(2)}억원`;
  if (abs >= 10000) return `${sign}${formatNumber(Math.round(abs / 10000))}만원`;
  return `${sign}${formatNumber(abs)}원`;
}

// 손익/수익률처럼 부호가 의미를 갖는 값에 공통으로 쓰는 색상 클래스 (양수=빨강, 음수=파랑).
export function signClass(value) {
  if (value == null) return '';
  return value >= 0 ? 'text-red-600' : 'text-blue-600';
}

export function formatSignedPercent(value) {
  if (value == null || Number.isNaN(value)) return '-';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatPercent(value)}`;
}

export function formatSignedCurrency(value) {
  if (value == null || Number.isNaN(value)) return '-';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatCurrency(value)}`;
}

export function formatSignedCompactWon(value) {
  if (value == null || Number.isNaN(value)) return '-';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatCompactWon(value)}`;
}
