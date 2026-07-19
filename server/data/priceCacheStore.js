import path from 'node:path';
import { config } from '../config.js';
import { readJson, writeJson } from './store.js';
import * as priceProviders from '../priceProviders/index.js';

function cacheFilePath(ticker) {
  return path.join(config.priceCacheDir, `${ticker}.json`);
}

async function readCache(ticker) {
  return readJson(cacheFilePath(ticker), null);
}

async function writeCache(ticker, data) {
  await writeJson(cacheFilePath(ticker), data);
}

// 같은 티커에 대한 동시 요청이 각자 외부 API를 중복 호출하지 않도록, 진행 중인 조회를 공유한다.
const inFlightQuotes = new Map();

export async function getQuote(ticker, { force = false } = {}) {
  if (inFlightQuotes.has(ticker)) return inFlightQuotes.get(ticker);
  const promise = fetchQuote(ticker, force).finally(() => inFlightQuotes.delete(ticker));
  inFlightQuotes.set(ticker, promise);
  return promise;
}

async function fetchQuote(ticker, force) {
  const cached = await readCache(ticker);
  const fresh =
    cached?.quote?.asOf && Date.now() - new Date(cached.quote.asOf).getTime() < config.quoteTtlMs;

  if (!force && fresh) {
    return { ...cached.quote, stale: false };
  }

  try {
    const quote = await priceProviders.getQuote(ticker);
    const next = {
      ticker,
      currency: quote.currency,
      quote,
      history: cached?.history || [],
      lastFetched: new Date().toISOString(),
      source: priceProviders.sourceFor(ticker),
    };
    await writeCache(ticker, next);
    return { ...quote, stale: false };
  } catch (err) {
    if (cached?.quote) {
      return { ...cached.quote, stale: true, staleReason: err.message };
    }
    throw err;
  }
}

export async function getHistory(ticker, { range = '2y', force = false } = {}) {
  const cached = await readCache(ticker);
  const cachedHistory = cached?.history || [];
  const lastDate = cachedHistory.length ? cachedHistory[cachedHistory.length - 1].date : null;
  const fresh =
    lastDate &&
    Date.now() - new Date(cached.lastFetched).getTime() < config.historyTtlMs;

  if (!force && fresh) {
    return { history: cachedHistory, stale: false };
  }

  try {
    // 증분 갱신: 저장된 마지막 날짜 이후만 필요하지만, 무료 API는 세밀한 range 지정이
    // 어려워 range 전체를 다시 받아 날짜 기준으로 병합한다 (요청 자체는 여전히 1회).
    const fetched = await priceProviders.getHistory(ticker, { range });
    const merged = mergeHistory(cachedHistory, fetched);
    const next = {
      ticker,
      currency: cached?.currency || null,
      quote: cached?.quote || null,
      history: merged,
      lastFetched: new Date().toISOString(),
      source: priceProviders.sourceFor(ticker),
    };
    await writeCache(ticker, next);
    return { history: merged, stale: false };
  } catch (err) {
    if (cachedHistory.length) {
      return { history: cachedHistory, stale: true, staleReason: err.message };
    }
    throw err;
  }
}

function mergeHistory(existing, incoming) {
  const byDate = new Map(existing.map((p) => [p.date, p]));
  for (const p of incoming) byDate.set(p.date, p);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
