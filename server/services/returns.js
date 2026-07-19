// 순납입금 = 누적 입금 - 누적 출금 (매수/매도는 계좌 내 자금 이동이므로 원금에 영향 없음)
export function computeNetContributions(events) {
  let net = 0;
  for (const e of events) {
    if (e.type === 'deposit') net += e.amount;
    if (e.type === 'withdraw') net -= e.amount;
  }
  return net;
}

// 누적수익률 = (총평가금액 - 순납입금) / 순납입금
export function computeCumulativeReturn(totalValue, netContributions) {
  const profit = totalValue - netContributions;
  const returnRate = netContributions > 0 ? profit / netContributions : null;
  return { profit, returnRate };
}

const MS_PER_DAY = 86400000;

// 연환산이 의미를 갖기 위한 최소 투자기간과 표시 상한. 기간이 며칠뿐이면 작은 등락도
// 연환산 시 천문학적 수치로 폭발하므로(예: 3일간 +2% → 연 수백만%), null로 두고 UI에서 '-'로 보여준다.
const MIN_DAYS_FOR_ANNUALIZED = 90;
const MAX_SANE_RATE = 10; // 연 1000%

// XIRR: 날짜별 현금흐름(cashflows: [{date, amount}])으로 연환산 돈가중수익률을 구한다.
// 부호 규약: 투자자 관점에서 나가는 돈(입금)은 음수, 들어오는 돈(출금/배당/현재 평가금액)은 양수.
export function computeXIRR(cashflows) {
  const flows = cashflows
    .filter((c) => c.amount !== 0)
    .map((c) => ({ amount: c.amount, date: c.date instanceof Date ? c.date : new Date(c.date) }))
    .sort((a, b) => a.date - b.date);

  if (flows.length < 2) return null;
  const hasPositive = flows.some((f) => f.amount > 0);
  const hasNegative = flows.some((f) => f.amount < 0);
  if (!hasPositive || !hasNegative) return null; // 실근이 존재하지 않는 경우 (예: 전부 입금뿐)

  const spanDays = (flows[flows.length - 1].date - flows[0].date) / MS_PER_DAY;
  if (spanDays < MIN_DAYS_FOR_ANNUALIZED) return null;

  const t0 = flows[0].date;
  const years = flows.map((f) => (f.date - t0) / MS_PER_DAY / 365);

  const npv = (rate) => flows.reduce((sum, f, i) => sum + f.amount / (1 + rate) ** years[i], 0);
  const dnpv = (rate) =>
    flows.reduce((sum, f, i) => sum - (years[i] * f.amount) / (1 + rate) ** (years[i] + 1), 0);

  let rate = 0.1;
  for (let i = 0; i < 50; i++) {
    const value = npv(rate);
    const deriv = dnpv(rate);
    if (Math.abs(deriv) < 1e-10) break;
    const nextRate = rate - value / deriv;
    if (!Number.isFinite(nextRate)) break;
    if (Math.abs(nextRate - rate) < 1e-7) return sanitizeRate(nextRate);
    rate = Math.max(nextRate, -0.999999); // 발산 방지
  }

  return sanitizeRate(bisectionXIRR(npv)); // Newton-Raphson이 수렴하지 않은 경우 폴백
}

// 수렴은 했지만 표시할 수 없을 만큼 비정상적인 해(단기 급등의 연환산 등)는 버린다.
function sanitizeRate(rate) {
  if (rate == null || !Number.isFinite(rate)) return null;
  if (rate > MAX_SANE_RATE || rate <= -1) return null;
  return rate;
}

function bisectionXIRR(npv) {
  let lo = -0.999;
  let hi = 10; // 연 1000%까지 탐색
  let npvLo = npv(lo);
  const npvHi = npv(hi);
  if (Number.isNaN(npvLo) || Number.isNaN(npvHi) || npvLo * npvHi > 0) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const npvMid = npv(mid);
    if (Math.abs(npvMid) < 1e-6) return mid;
    if (npvLo * npvMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      npvLo = npvMid;
    }
  }
  return (lo + hi) / 2;
}

// events(입금/출금/배당) + 현재 총평가금액으로부터 XIRR용 현금흐름을 구성한다.
export function buildCashflowsFromEvents(events, currentTotalValue, asOfDate = new Date()) {
  const flows = [];
  for (const e of events) {
    if (e.type === 'deposit') flows.push({ date: e.date, amount: -e.amount });
    if (e.type === 'withdraw') flows.push({ date: e.date, amount: e.amount });
    if (e.type === 'dividend') flows.push({ date: e.date, amount: e.amount });
  }
  flows.push({ date: asOfDate, amount: currentTotalValue });
  return flows;
}
