// 비공식 펀드닥터(funddoctor.co.kr) 스크래핑. 국내 펀드 표준코드(12자리 영숫자)에 사용.
// "KR"로 시작하는 코드(예: KR5365AJ4390)와, 그 외 "K"로 시작하는 코드(예: K55365C43648,
// 재간접형·사모 등 상품유형에 따라 두 번째 글자가 R이 아닐 수 있음)를 모두 포함한다.
// 펀드는 하루 한 번(기준일) 기준가만 발표되므로 과거 시세/분봉 조회는 지원하지 않는다.
const CODE_PATTERN = /^K[0-9A-Z]{11}$/;

export function isFundCode(ticker) {
  return CODE_PATTERN.test(ticker);
}

export async function getQuote(ticker) {
  const url = `https://funddoctor.co.kr/afn/fund/fprofile2.jsp?fund_cd=${ticker}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`펀드 기준가 요청 실패 (${ticker}): ${res.status}`);
  const html = await res.text();

  const priceMatch = html.match(/기준가\(KRW\)<\/strong>\s*<div class="fund_price\s*(fund_up|fund_down)?">([\d,.]+)<\/div>/);
  if (!priceMatch) throw new Error(`펀드 기준가 데이터 없음: ${ticker}`);
  const price = Number(priceMatch[2].replace(/,/g, ''));

  const gapMatch = html.match(/class="fund_gaprate\s*(fund_up|fund_down)?">[\s\S]*?>([\d,.]+)<\/span><span>\(([\d.]+)%\)/);
  const gapSign = gapMatch?.[1] === 'fund_down' ? -1 : 1;
  const change = gapMatch ? gapSign * Number(gapMatch[2].replace(/,/g, '')) : null;
  const changePercent = gapMatch ? (gapSign * Number(gapMatch[3])) / 100 : null;

  const dateMatch = html.match(/기준일:\s*(\d{4})\.(\d{2})\.(\d{2})/);
  const asOf = dateMatch ? new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`).toISOString() : new Date().toISOString();

  return { price, currency: 'KRW', change, changePercent, asOf };
}

// FunETF(funetf.co.kr)의 공개 fundnav API. 로그인/세션·CSRF 없이 fundCd만으로 호출 가능하며,
// schNavTerm(조회 개월수)은 1/3/6/12/36/60만 유효(그 외 값은 무시되고 1개월로 폴백). 60(5년)이 상한.
const RANGE_TO_TERM = { '1mo': 1, '3mo': 3, '6mo': 6, '1y': 12, '2y': 36, '3y': 36, '5y': 60, max: 60 };

export async function getHistory(ticker, { range = '1y' } = {}) {
  const term = RANGE_TO_TERM[range] || 12;
  const gijunYmd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const url = `https://www.funetf.co.kr/api/public/product/view/fundnav?fundCd=${ticker}&schNavMode=T&schNavTerm=${term}&gijunYmd=${gijunYmd}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: `https://www.funetf.co.kr/product/fund/view/${ticker}` },
  });
  if (!res.ok) throw new Error(`펀드 기준가 추이 요청 실패 (${ticker}): ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error(`펀드 기준가 추이 데이터 없음: ${ticker}`);
  return rows
    .filter((r) => r.gijunYmd && r.gijunGa != null)
    .map((r) => ({
      date: `${r.gijunYmd.slice(0, 4)}-${r.gijunYmd.slice(4, 6)}-${r.gijunYmd.slice(6, 8)}`,
      close: Number(r.gijunGa),
    }));
}

export async function getIntradayHistory() {
  throw new Error('펀드는 분봉 시세 조회를 지원하지 않습니다');
}
