const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `요청 실패: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getAccounts: () => request('/accounts'),
  createAccount: (data) => request('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id, data) => request(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccount: (id) => request(`/accounts/${id}`, { method: 'DELETE' }),

  getEvents: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/events${qs ? `?${qs}` : ''}`);
  },
  createEvent: (data) => request('/events', { method: 'POST', body: JSON.stringify(data) }),
  updateEvent: (id, data) => request(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEvent: (id) => request(`/events/${id}`, { method: 'DELETE' }),

  getHoldings: (accountId) => request(`/holdings${accountId ? `?accountId=${accountId}` : ''}`),
  getPrice: (ticker, force) =>
    request(`/prices/${encodeURIComponent(ticker)}${force ? '?force=true' : ''}`),
  getPriceHistory: (ticker, range) =>
    request(`/prices/${encodeURIComponent(ticker)}/history${range ? `?range=${range}` : ''}`),
  getIntradayHistory: (ticker) => request(`/prices/${encodeURIComponent(ticker)}/intraday`),
  getDashboardSummary: (accountId) =>
    request(`/dashboard/summary${accountId ? `?accountId=${accountId}` : ''}`),
  getDashboardGrowth: (accountId) =>
    request(`/dashboard/growth${accountId ? `?accountId=${accountId}` : ''}`),
  getDashboardAllocation: (by, accountId) =>
    request(`/dashboard/allocation?by=${by}${accountId ? `&accountId=${accountId}` : ''}`),
  getReturnsCumulative: (accountId) =>
    request(`/returns/cumulative${accountId ? `?accountId=${accountId}` : ''}`),
  getReturnsMonthly: (accountId) =>
    request(`/returns/monthly${accountId ? `?accountId=${accountId}` : ''}`),
  getReturnsByAccount: () => request('/returns/by-account'),

  getDividendsSummary: (accountId) =>
    request(`/dividends/summary${accountId ? `?accountId=${accountId}` : ''}`),
  getDividendsMonthly: (year, accountId) => {
    const params = new URLSearchParams();
    if (year) params.set('year', year);
    if (accountId) params.set('accountId', accountId);
    const qs = params.toString();
    return request(`/dividends/monthly${qs ? `?${qs}` : ''}`);
  },

  getRebalanceConfig: (accountId) => request(`/rebalance/${accountId}`),
  saveRebalanceConfig: (accountId, data) =>
    request(`/rebalance/${accountId}`, { method: 'PUT', body: JSON.stringify(data) }),
  markRebalanceDone: (accountId) => request(`/rebalance/${accountId}/mark-done`, { method: 'POST' }),
  getRebalanceStatus: (accountId) => request(`/rebalance/${accountId}/status`),
  deleteRebalanceConfig: (accountId) => request(`/rebalance/${accountId}`, { method: 'DELETE' }),

  getBacktestPortfolios: () => request('/backtest/portfolios'),
  createBacktestPortfolio: (data) =>
    request('/backtest/portfolios', { method: 'POST', body: JSON.stringify(data) }),
  updateBacktestPortfolio: (id, data) =>
    request(`/backtest/portfolios/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBacktestPortfolio: (id) => request(`/backtest/portfolios/${id}`, { method: 'DELETE' }),
  runBacktest: (data) => request('/backtest/run', { method: 'POST', body: JSON.stringify(data) }),

  getTickerMeta: () => request('/tickers/meta'),
  searchTickers: (q) => request(`/tickers/search?q=${encodeURIComponent(q)}`),
  registerTicker: (ticker, assetType, region) =>
    request('/tickers/register', { method: 'POST', body: JSON.stringify({ ticker, assetType, region }) }),

  getCashAssets: (accountId) => request(`/cash-assets${accountId ? `?accountId=${accountId}` : ''}`),
  createCashAsset: (data) => request('/cash-assets', { method: 'POST', body: JSON.stringify(data) }),
  updateCashAsset: (id, data) => request(`/cash-assets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCashAsset: (id) => request(`/cash-assets/${id}`, { method: 'DELETE' }),

  getMarketIndices: () => request('/market/indices'),
};
