// 비공식 Yahoo Finance chart 엔드포인트. 미국/해외 티커 및 FX(예: KRW=X)에 사용.
const BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

export async function getQuote(ticker) {
  const data = await fetchChart(ticker, '5d', '1d');
  const meta = data.chart.result[0].meta;
  const price = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose;
  return {
    price,
    currency: meta.currency,
    asOf: new Date((meta.regularMarketTime || Date.now() / 1000) * 1000).toISOString(),
    change: prevClose != null ? price - prevClose : null,
    changePercent: prevClose ? (price - prevClose) / prevClose : null,
  };
}

export async function getHistory(ticker, { range = '1y' } = {}) {
  const data = await fetchChart(ticker, range, '1d');
  const result = data.chart.result[0];
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  return timestamps
    .map((t, i) => ({ date: new Date(t * 1000).toISOString().slice(0, 10), close: closes[i] }))
    .filter((p) => p.close != null);
}

// 배당 재투자를 반영한 수정종가(adjusted close). 백테스팅의 "배당 재투자 ON"에 사용.
export async function getAdjustedHistory(ticker, { range = '1y' } = {}) {
  const data = await fetchChart(ticker, range, '1d');
  const result = data.chart.result[0];
  const timestamps = result.timestamp || [];
  const adjCloses = result.indicators?.adjclose?.[0]?.adjclose;
  if (!adjCloses) throw new Error(`Yahoo Finance 수정종가 데이터 없음: ${ticker}`);
  return timestamps
    .map((t, i) => ({ date: new Date(t * 1000).toISOString().slice(0, 10), close: adjCloses[i] }))
    .filter((p) => p.close != null);
}

// 시간별(분봉) 시세. 장중 데이터라 range는 짧게(1d~5d), interval은 분 단위로 준다.
export async function getIntradayHistory(ticker, { range = '1d', interval = '5m' } = {}) {
  const data = await fetchChart(ticker, range, interval);
  const result = data.chart.result[0];
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  return timestamps
    .map((t, i) => ({ time: new Date(t * 1000).toISOString(), close: closes[i] }))
    .filter((p) => p.close != null);
}

async function fetchChart(ticker, range, interval) {
  const url = `${BASE}/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Yahoo Finance 요청 실패 (${ticker}): ${res.status}`);
  const json = await res.json();
  if (!json.chart?.result?.length) throw new Error(`Yahoo Finance 데이터 없음: ${ticker}`);
  return json;
}
