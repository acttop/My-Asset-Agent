import { getQuote, getHistory } from '../data/priceCacheStore.js';
import * as priceProviders from '../priceProviders/index.js';
import { getCurrentFxRate } from './fx.js';
import { priceAsOf, monthEndDates, computeMonthlyReturns } from './growth.js';
import { computeXIRR } from './returns.js';

const PERIOD_MONTHS = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 };

// 수수료/세금/슬리피지는 단순화를 위해 제외한다.
// 평가/납입은 매월 이뤄지고, 리밸런싱은 rebalancePeriod 주기(개월수)마다 그 시점에 맞춰 실행된다.
export async function runBacktest({
  allocations,
  startDate,
  endDate,
  rebalancePeriod = 'quarterly',
  initialAmount = 10000000,
  monthlyContribution = 0,
  yearlyContribution = 0,
  reinvestDividends = true,
}) {
  const tickers = allocations.map((a) => a.ticker);
  const histories = {};
  const currencies = {};
  const dividendUnsupportedTickers = [];

  for (const ticker of tickers) {
    try {
      currencies[ticker] = (await getQuote(ticker)).currency;
    } catch {
      currencies[ticker] = 'KRW';
    }

    if (reinvestDividends) {
      try {
        histories[ticker] = await priceProviders.getAdjustedHistory(ticker, { range: 'max' });
        continue;
      } catch {
        dividendUnsupportedTickers.push(ticker); // 수정종가 미지원 소스 → 일반 종가로 폴백
      }
    }
    try {
      histories[ticker] = (await getHistory(ticker, { range: 'max' })).history;
    } catch {
      histories[ticker] = [];
    }
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const valuationDates = monthEndDates(start, end);
  const rebalanceEveryN = PERIOD_MONTHS[rebalancePeriod] || null;

  const shares = {};
  let totalContributed = initialAmount;
  const series = [];
  let peak = -Infinity;
  let maxDrawdown = 0;
  // XIRR용 현금흐름: 초기 투자금/월 납입은 유출(-), 최종 평가금액은 유입(+)으로 기록한다.
  const cashflows = [{ date: startDate, amount: -initialAmount }];

  const valueAt = async (prices) => {
    let value = 0;
    for (const ticker of tickers) {
      const price = prices[ticker];
      if (price == null) continue;
      const fx = await getCurrentFxRate(currencies[ticker]);
      value += (shares[ticker] || 0) * price * fx;
    }
    return value;
  };

  const buyByWeight = async (budgetKrw, prices) => {
    for (const a of allocations) {
      const price = prices[a.ticker];
      if (price == null) continue;
      const fx = await getCurrentFxRate(currencies[a.ticker]);
      shares[a.ticker] = (shares[a.ticker] || 0) + (budgetKrw * a.weight) / (price * fx);
    }
  };

  for (let i = 0; i < valuationDates.length; i++) {
    const dateStr = valuationDates[i].toISOString().slice(0, 10);
    const prices = {};
    for (const ticker of tickers) prices[ticker] = priceAsOf(histories[ticker], dateStr);

    if (i === 0) {
      await buyByWeight(initialAmount, prices);
    } else {
      // 정기 납입: 리밸런싱 주기와 무관하게 매월 목표 비중대로 추가 매수한다 (적립식).
      if (monthlyContribution > 0) {
        totalContributed += monthlyContribution;
        cashflows.push({ date: dateStr, amount: -monthlyContribution });
        await buyByWeight(monthlyContribution, prices);
      }
      // 연납: 시작월로부터 12개월마다(1년 도래 시점) 별도로 한 번 더 납입한다. 월납과 동시에 있을 수 있다.
      if (yearlyContribution > 0 && i % 12 === 0) {
        totalContributed += yearlyContribution;
        cashflows.push({ date: dateStr, amount: -yearlyContribution });
        await buyByWeight(yearlyContribution, prices);
      }
      // 리밸런싱: 지정 주기(개월)에 도달했을 때만 전체 평가금액을 목표 비중대로 재분배한다.
      if (rebalanceEveryN && i % rebalanceEveryN === 0) {
        const totalValue = await valueAt(prices);
        for (const a of allocations) {
          const price = prices[a.ticker];
          if (price == null) continue;
          const fx = await getCurrentFxRate(currencies[a.ticker]);
          shares[a.ticker] = (totalValue * a.weight) / (price * fx);
        }
      }
    }

    const value = await valueAt(prices);
    peak = Math.max(peak, value);
    const drawdown = peak > 0 ? (value - peak) / peak : 0;
    maxDrawdown = Math.min(maxDrawdown, drawdown);

    series.push({
      date: dateStr,
      value: Math.round(value),
      contributed: Math.round(totalContributed),
      drawdown,
    });
  }

  const last = series[series.length - 1];
  const totalReturn = totalContributed > 0 ? (last.value - totalContributed) / totalContributed : null;
  // 연평균수익률(CAGR)은 각 납입금이 투자된 시점을 반영한 XIRR(돈가중수익률)로 계산한다.
  // 단순히 (최종값/총납입금)^(1/연수)로 계산하면 모든 납입금이 처음에 한번에 들어갔다고
  // 가정하게 되어, 적립식 투자에서는 총수익률과 사실상 같은 값이 나오는 오류가 있었다.
  cashflows.push({ date: endDate, amount: last.value });
  const cagr = computeXIRR(cashflows);

  const monthlyReturns = computeMonthlyReturns(
    series.map((p) => ({ date: p.date, value: p.value, contributions: p.contributed }))
  );
  const validReturns = monthlyReturns.map((r) => r.returnRate).filter((r) => r != null);

  const mean = validReturns.length ? validReturns.reduce((s, r) => s + r, 0) / validReturns.length : null;
  const variance =
    mean != null && validReturns.length
      ? validReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / validReturns.length
      : null;
  const volatility = variance != null ? Math.sqrt(variance) * Math.sqrt(12) : null; // 연환산 변동성
  const sharpeRatio = volatility && cagr != null ? cagr / volatility : null; // 무위험수익률 0% 가정
  const calmarRatio = maxDrawdown !== 0 && cagr != null ? cagr / Math.abs(maxDrawdown) : null;
  const monthlyWinRate = validReturns.length ? validReturns.filter((r) => r > 0).length / validReturns.length : null;
  const bestMonth = validReturns.length ? Math.max(...validReturns) : null;
  const worstMonth = validReturns.length ? Math.min(...validReturns) : null;

  return {
    series,
    summary: {
      totalContributed,
      finalValue: last.value,
      totalReturn,
      cagr,
      maxDrawdown,
      volatility,
      sharpeRatio,
      calmarRatio,
      monthlyWinRate,
      bestMonth,
      worstMonth,
    },
    dividendUnsupportedTickers,
  };
}
