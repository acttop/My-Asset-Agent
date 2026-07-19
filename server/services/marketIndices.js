import * as yahooProvider from '../priceProviders/yahooProvider.js';
import * as naverProvider from '../priceProviders/naverProvider.js';

// 대시보드 상단 시세바에 고정으로 보여줄 항목들. 일반 보유종목 티커 검색과는 별개의 고정 목록이다.
const ITEMS = [
  { label: '코스피', fetch: () => naverProvider.getIndexQuote('KOSPI'), priceFormat: 'index' },
  { label: '나스닥100', fetch: () => yahooProvider.getQuote('^NDX'), priceFormat: 'index' },
  { label: 'S&P500', fetch: () => yahooProvider.getQuote('^GSPC'), priceFormat: 'index' },
  { label: 'SCHD', fetch: () => yahooProvider.getQuote('SCHD'), priceFormat: 'currency' },
  { label: 'BTC', fetch: () => yahooProvider.getQuote('BTC-USD'), priceFormat: 'currency' },
  { label: '달러', fetch: () => yahooProvider.getQuote('KRW=X'), priceFormat: 'currency' },
];

export async function getMarketIndices() {
  const results = await Promise.all(
    ITEMS.map(async (item) => {
      try {
        const q = await item.fetch();
        return {
          label: item.label,
          price: q.price,
          change: q.change ?? null,
          changePercent: q.changePercent ?? null,
          currency: q.currency,
          priceFormat: item.priceFormat,
        };
      } catch (err) {
        return { label: item.label, error: err.message };
      }
    })
  );
  return results;
}
