import { deriveHoldings } from './costBasis.js';
import { getHistory } from '../data/priceCacheStore.js';
import { getCurrentFxRate } from './fx.js';
import { isFundCode } from '../priceProviders/fundProvider.js';

// 특정 날짜(YYYY-MM-DD) 이하의 이벤트만으로 그 시점의 보유내역을 재구성한다.
function holdingsAsOf(events, dateStr) {
  return deriveHoldings(events.filter((e) => e.date <= dateStr));
}

// 과거 가격 시계열에서 해당 날짜 이하의 가장 최근 종가를 찾는다.
export function priceAsOf(history, dateStr) {
  let result = null;
  for (const p of history) {
    if (p.date > dateStr) break;
    result = p.close;
  }
  return result;
}

export function monthEndDates(startDate, endDate) {
  const dates = [];
  let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cursor <= endMonth) {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    dates.push(monthEnd > endDate ? endDate : monthEnd);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return dates;
}

// 이벤트 리플레이 + 과거 시세로 월말 기준 평가금액/누적납입금 시계열을 재구성한다.
export async function computeGrowthSeries(events, { accountId } = {}) {
  const scoped = accountId ? events.filter((e) => e.accountId === accountId) : events;
  const tradeEvents = scoped.filter((e) => (e.type === 'buy' || e.type === 'sell') && e.ticker);
  if (tradeEvents.length === 0) return [];

  const tickers = [...new Set(tradeEvents.map((e) => e.ticker))];
  const histories = {};
  for (const ticker of tickers) {
    try {
      const { history } = await getHistory(ticker, { range: 'max' });
      histories[ticker] = history;
    } catch {
      histories[ticker] = [];
    }
  }

  const firstDateStr = tradeEvents.reduce((min, e) => (e.date < min ? e.date : min), tradeEvents[0].date);
  const dates = monthEndDates(new Date(firstDateStr), new Date());

  const contribEvents = scoped
    .filter((e) => e.type === 'deposit' || e.type === 'withdraw')
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  const series = [];
  let cumulativeContributions = 0;
  let contribIdx = 0;

  for (const date of dates) {
    const dateStr = date.toISOString().slice(0, 10);
    const holdings = holdingsAsOf(scoped, dateStr);

    let value = 0;
    for (const h of holdings) {
      const price = priceAsOf(histories[h.ticker] || [], dateStr);
      if (price == null) continue;
      const fxRate = await getCurrentFxRate(h.currency);
      value += (h.quantity * price * fxRate) / (isFundCode(h.ticker) ? 1000 : 1);
    }

    while (contribIdx < contribEvents.length && contribEvents[contribIdx].date <= dateStr) {
      const e = contribEvents[contribIdx];
      cumulativeContributions += e.type === 'deposit' ? e.amount : -e.amount;
      contribIdx++;
    }

    series.push({
      date: dateStr,
      value: Math.round(value),
      contributions: Math.round(cumulativeContributions),
    });
  }
  return series;
}

// 월별 수익률 = (평가금액 변동 - 순유입) / (직전 평가금액 + 당월 순유입)
export function computeMonthlyReturns(series) {
  const result = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const curr = series[i];
    const contribDelta = curr.contributions - prev.contributions;
    const base = prev.value + Math.max(contribDelta, 0);
    const gain = curr.value - prev.value - contribDelta;
    result.push({ date: curr.date, returnRate: base > 0 ? gain / base : null });
  }
  return result;
}
