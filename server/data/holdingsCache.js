import path from 'node:path';
import { config } from '../config.js';
import { writeJson } from './store.js';
import { listEvents } from './eventsStore.js';
import { deriveHoldings } from '../services/costBasis.js';
import { getTickerMeta } from './tickerMetaStore.js';

const filePath = path.join(config.dataDir, 'holdings.json');

// events.json이 source of truth이므로, 조회할 때마다 재계산하고
// holdings.json에는 사람이 열어볼 수 있도록 결과를 반영해둔다.
export async function listHoldings({ accountId } = {}) {
  const events = await listEvents();
  const holdings = deriveHoldings(events);
  const meta = await getTickerMeta();
  const enriched = holdings.map((h) => ({
    ...h,
    name: meta[h.ticker]?.name || h.ticker,
  }));
  await writeJson(filePath, enriched);
  return accountId ? enriched.filter((h) => h.accountId === accountId) : enriched;
}
