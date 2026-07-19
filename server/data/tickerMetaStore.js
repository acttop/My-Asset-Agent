import path from 'node:path';
import { config } from '../config.js';
import { readJson, writeJson } from './store.js';

const filePath = path.join(config.dataDir, 'ticker-meta.json');

export async function getTickerMeta() {
  return readJson(filePath, {});
}

// 종목명/티커 부분일치 검색 (자동완성용). 티커 우선 매치를 앞쪽에 정렬한다.
export async function searchTickers(query, limit = 20) {
  const meta = await getTickerMeta();
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const results = Object.entries(meta)
    .filter(([ticker, m]) => ticker.toLowerCase().includes(needle) || m.name.toLowerCase().includes(needle))
    .map(([ticker, m]) => ({ ticker, ...m }));

  results.sort((a, b) => {
    const aTickerMatch = a.ticker.toLowerCase().startsWith(needle) ? 0 : 1;
    const bTickerMatch = b.ticker.toLowerCase().startsWith(needle) ? 0 : 1;
    if (aTickerMatch !== bTickerMatch) return aTickerMatch - bTickerMatch;
    return a.name.localeCompare(b.name);
  });

  return results.slice(0, limit);
}

// 사전에 없는 티커를 사용자가 직접 입력해 추가할 때, 최소 정보로 등록해둔다.
export async function upsertTickerMeta(ticker, { name, assetType, region } = {}) {
  const meta = await getTickerMeta();
  if (!meta[ticker]) {
    meta[ticker] = { name: name || ticker, assetType: assetType || '주식', region: region || 'KR' };
    await writeJson(filePath, meta);
  }
  return meta[ticker];
}
