// events.json(매수/매도)로부터 계좌별·종목별 보유수량/평단가를 파생시킨다.
export function deriveHoldings(events) {
  const positions = new Map(); // key: accountId|ticker

  const tradeEvents = events
    .filter((e) => (e.type === 'buy' || e.type === 'sell') && e.ticker)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  for (const e of tradeEvents) {
    const key = `${e.accountId}|${e.ticker}`;
    const pos = positions.get(key) || {
      accountId: e.accountId,
      ticker: e.ticker,
      quantity: 0,
      totalCost: 0,
      currency: e.currency,
    };

    const qty = e.quantity != null ? e.quantity : e.pricePerShare ? e.amount / e.pricePerShare : 0;

    if (e.type === 'buy') {
      pos.quantity += qty;
      pos.totalCost += e.amount;
    } else {
      // 매도: 평단가를 유지한 채 수량/원가를 비례 차감
      const avgCost = pos.quantity > 0 ? pos.totalCost / pos.quantity : 0;
      pos.quantity -= qty;
      pos.totalCost -= avgCost * qty;
      if (pos.quantity < 0) pos.quantity = 0;
      if (pos.totalCost < 0) pos.totalCost = 0;
    }

    positions.set(key, pos);
  }

  return [...positions.values()]
    .filter((p) => p.quantity > 1e-9)
    .map((p) => ({
      accountId: p.accountId,
      ticker: p.ticker,
      quantity: round(p.quantity),
      avgCostPerShare: round(p.totalCost / p.quantity),
      totalCost: round(p.totalCost),
      currency: p.currency,
    }));
}

function round(n) {
  return Math.round(n * 1e6) / 1e6;
}
