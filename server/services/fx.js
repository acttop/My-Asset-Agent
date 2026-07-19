import { getQuote } from '../data/priceCacheStore.js';

const fxCache = new Map();

// 통화별 현재 환율로 근사 환산한다 (과거 시점별 정확한 환율 재현은 범위 밖 — 알려진 단순화).
export async function getCurrentFxRate(currency) {
  if (!currency || currency === 'KRW') return 1;
  if (fxCache.has(currency)) return fxCache.get(currency);
  let rate = 1;
  try {
    const fx = await getQuote(`${currency}KRW=X`);
    rate = fx.price || 1;
  } catch {
    rate = 1;
  }
  fxCache.set(currency, rate);
  return rate;
}
