import { getQuote } from '../data/priceCacheStore.js';
import { getCurrentFxRate } from './fx.js';
import { listHoldings } from '../data/holdingsCache.js';
import { listCashAssets } from '../data/cashAssetsStore.js';
import { isFundCode } from '../priceProviders/fundProvider.js';

// 종목별 시세 조회는 서로 독립적이므로 병렬로 처리한다 (보유종목이 많을수록 순차 처리 대비 체감 속도 차이가 큼).
export async function valueHoldings(holdings) {
  return Promise.all(
    holdings.map(async (h) => {
      let quote;
      try {
        quote = await getQuote(h.ticker);
      } catch (err) {
        quote = { price: null, currency: h.currency, stale: true, staleReason: err.message };
      }
      const price = quote.price;
      const priceCurrency = quote.currency || h.currency;
      // 펀드 기준가는 "1,000좌당 가액"으로 고시되는 관행이 있어, 실제 평가금액은 좌수×기준가÷1000이다.
      const marketValueNative =
        price != null ? (h.quantity * price) / (isFundCode(h.ticker) ? 1000 : 1) : null;
      const fxRate = await getCurrentFxRate(priceCurrency);
      const marketValueKrw = marketValueNative != null ? marketValueNative * fxRate : null;

      return {
        ...h,
        currentPrice: price,
        priceCurrency,
        priceAsOf: quote.asOf || null,
        priceStale: !!quote.stale,
        marketValueNative,
        marketValueKrw,
        fxRate,
      };
    })
  );
}

// 시세가 있는 보유종목 + 시세 없는 현금 자산을 하나의 배열로 합쳐 반환한다.
// (보유종목 테이블/총자산/자산배분 뷰가 공통으로 이 함수를 사용한다.)
export async function getAllValuedAssets({ accountId } = {}) {
  const holdings = await listHoldings({ accountId });
  const valued = await valueHoldings(holdings);
  const securityRows = valued.map((h) => ({ ...h, id: `${h.accountId}|${h.ticker}`, isCash: false }));

  const cashAssets = await listCashAssets({ accountId });
  const cashRows = cashAssets.map((c) => ({
    id: c.id,
    isCash: true,
    accountId: c.accountId,
    ticker: null,
    name: c.name,
    quantity: null,
    avgCostPerShare: null,
    totalCost: c.value,
    currency: 'KRW',
    currentPrice: null,
    priceCurrency: 'KRW',
    priceAsOf: c.updatedAt,
    priceStale: false,
    marketValueNative: c.value,
    marketValueKrw: c.value,
    fxRate: 1,
  }));

  return [...securityRows, ...cashRows];
}
