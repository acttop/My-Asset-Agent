// 비공식 네이버 금융 엔드포인트. 한국 티커(.KS/.KQ)에 사용.
function toCode(ticker) {
  return ticker.split('.')[0];
}

export async function getQuote(ticker) {
  const code = toCode(ticker);
  const url = `https://polling.finance.naver.com/api/realtime/domestic/stock/${code}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://finance.naver.com/' },
  });
  if (!res.ok) throw new Error(`네이버 금융 요청 실패 (${ticker}): ${res.status}`);
  const json = await res.json();
  const data = json?.datas?.[0];
  if (!data || data.closePriceRaw == null) throw new Error(`네이버 금융 데이터 없음: ${ticker}`);
  return {
    price: Number(data.closePriceRaw),
    currency: 'KRW',
    asOf: data.localTradedAt ? new Date(data.localTradedAt).toISOString() : new Date().toISOString(),
  };
}

// 코스피/코스닥 등 지수. 종목과 엔드포인트가 달라 별도 함수로 둔다.
export async function getIndexQuote(code) {
  const url = `https://polling.finance.naver.com/api/realtime/domestic/index/${code}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://finance.naver.com/' },
  });
  if (!res.ok) throw new Error(`네이버 금융 지수 요청 실패 (${code}): ${res.status}`);
  const json = await res.json();
  const data = json?.datas?.[0];
  if (!data || data.closePriceRaw == null) throw new Error(`네이버 금융 지수 데이터 없음: ${code}`);
  return {
    price: Number(data.closePriceRaw),
    change: Number(data.compareToPreviousClosePriceRaw),
    changePercent: Number(data.fluctuationsRatioRaw) / 100,
    currency: 'KRW',
  };
}

const RANGE_TO_COUNT = { '6mo': 130, '1y': 260, '2y': 520, '5y': 1300, max: 3000 };

export async function getHistory(ticker, { range = '2y' } = {}) {
  const count = RANGE_TO_COUNT[range] || 520;
  const code = toCode(ticker);
  const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=day&count=${count}&requestType=0`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`네이버 금융 시세 요청 실패 (${ticker}): ${res.status}`);
  const xml = await res.text();
  const rows = [...xml.matchAll(/<item data="([^"]+)"/g)].map((m) => m[1]);
  return rows
    .map((row) => {
      const [date, , , , close] = row.split('|');
      return {
        date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
        close: Number(close),
      };
    })
    .filter((p) => Number.isFinite(p.close));
}

// 시간별(분봉) 시세. 엔드포인트가 여러 거래일치 분봉을 한번에 주므로 최근 거래일(마지막 400개, 국내 장은 하루 390분) 분량만 남긴다.
export async function getIntradayHistory(ticker) {
  const code = toCode(ticker);
  const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=minute&count=400&requestType=0`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`네이버 금융 분봉 요청 실패 (${ticker}): ${res.status}`);
  const xml = await res.text();
  const rows = [...xml.matchAll(/<item data="([^"]+)"/g)].map((m) => m[1]);
  const all = rows
    .map((row) => {
      const [stamp, , , , close] = row.split('|');
      const y = stamp.slice(0, 4);
      const mo = stamp.slice(4, 6);
      const d = stamp.slice(6, 8);
      const h = stamp.slice(8, 10);
      const mi = stamp.slice(10, 12);
      return { time: `${y}-${mo}-${d}T${h}:${mi}:00+09:00`, close: Number(close) };
    })
    .filter((p) => Number.isFinite(p.close));
  return all.slice(-400);
}
