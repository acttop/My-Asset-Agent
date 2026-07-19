import { getTickerMeta } from '../data/tickerMetaStore.js';

// 평가된 보유종목(marketValueKrw 포함)을 계좌별/유형별/종목별로 묶어 비중을 계산한다.
export async function computeAllocation(valuedHoldings, accounts, by) {
  const meta = by === 'type' ? await getTickerMeta() : null;
  const groups = new Map();

  for (const h of valuedHoldings) {
    if (h.marketValueKrw == null) continue;
    let key;
    let label;
    if (by === 'account') {
      key = h.accountId;
      label = accounts.find((a) => a.id === h.accountId)?.name || h.accountId;
    } else if (by === 'type') {
      key = h.isCash ? '현금성자산' : meta[h.ticker]?.assetType || '기타';
      label = key;
    } else {
      key = h.isCash ? h.id : h.ticker;
      label = h.name;
    }
    const prev = groups.get(key) || { label, value: 0 };
    prev.value += h.marketValueKrw;
    groups.set(key, prev);
  }

  const total = [...groups.values()].reduce((sum, g) => sum + g.value, 0);
  return [...groups.values()]
    .map((g) => ({
      label: g.label,
      value: Math.round(g.value),
      weight: total > 0 ? g.value / total : null,
    }))
    .sort((a, b) => b.value - a.value);
}
