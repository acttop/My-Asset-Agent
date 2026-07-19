// 배당 이벤트로부터 배당 관련 지표를 계산한다.

export function computeCumulativeDividends(events, { accountId, ticker } = {}) {
  return events
    .filter((e) => e.type === 'dividend')
    .filter((e) => !accountId || e.accountId === accountId)
    .filter((e) => !ticker || e.ticker === ticker)
    .reduce((sum, e) => sum + e.amount, 0);
}

export function computeThisYearDividends(events, year = new Date().getFullYear()) {
  return events
    .filter((e) => e.type === 'dividend' && e.date.startsWith(String(year)))
    .reduce((sum, e) => sum + e.amount, 0);
}

// 최근 12개월간 배당 합계 (trailing 12 months)
export function computeTrailingDividends(events, { ticker, accountId, asOf = new Date() } = {}) {
  const cutoff = new Date(asOf);
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return events
    .filter((e) => e.type === 'dividend')
    .filter((e) => !accountId || e.accountId === accountId)
    .filter((e) => !ticker || e.ticker === ticker)
    .filter((e) => e.date >= cutoffStr)
    .reduce((sum, e) => sum + e.amount, 0);
}

// 종목별 trailing 12개월 배당 총액을 보유수량으로 나눠 주당배당(DPS)을 근사한다.
export function computeDividendPerShare(events, ticker, quantity) {
  if (!quantity) return 0;
  const trailing = computeTrailingDividends(events, { ticker });
  return trailing / quantity;
}

// 시가배당률 = 최근 12개월 주당배당 / 현재가
export function computeDividendYield(dividendPerShare, currentPrice) {
  if (!currentPrice) return null;
  return dividendPerShare / currentPrice;
}

// 투자배당률(YoC) = 최근 12개월 주당배당 / 평단가
export function computeYoC(dividendPerShare, avgCostPerShare) {
  if (!avgCostPerShare) return null;
  return dividendPerShare / avgCostPerShare;
}

// 예상 연간 배당: 비공식 시세 API가 배당 캘린더를 제공하지 않으므로, 사용자가 기록한
// trailing 12개월 배당 합계를 그대로 연간 추정치로 사용한다 (최소 1회 배당 기록 필요).
export function estimateAnnualDividend(events, { accountId } = {}) {
  return computeTrailingDividends(events, { accountId });
}
