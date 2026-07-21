import { api } from './api.js';
import { formatCurrency, formatPercent, signClass } from './format.js';
import { renderLineChart, renderBarChart, renderDoughnutChart } from './charts.js';
import { renderMarketTicker } from './marketTicker.js';
import { renderAccountTabs, bindAccountTabs } from './accountTabs.js';

const ALLOC_LABELS = { account: '계좌별', type: '유형별', ticker: '종목별' };
const GRANULARITY_LABELS = { day: '일', week: '주', month: '월' };
let selectedAccountId = null;
let cumulativeGranularity = 'month';

export async function renderDashboard(container) {
  container.innerHTML = `<p class="text-slate-500">불러오는 중...</p>`;
  try {
    const accounts = await api.getAccounts();
    if (!accounts.some((a) => a.id === selectedAccountId)) selectedAccountId = null;

    container.innerHTML = `
      <div id="market-ticker" class="bg-white border-y border-slate-200 mb-4" style="width: 100vw; margin-left: calc(50% - 50vw); margin-right: calc(50% - 50vw);"></div>
      <div class="mb-4">${renderAccountTabs(accounts, selectedAccountId)}</div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="card" id="dashboard-summary-card"><p class="text-slate-500">불러오는 중...</p></div>
        <div>
          <div class="card mb-4" id="dashboard-allocation-card"><p class="text-slate-500">불러오는 중...</p></div>
          <div class="card">
            <div class="text-sm text-slate-500 mb-2">📈 내 자산 성장 추이</div>
            <canvas id="chart-growth" height="90"></canvas>
          </div>
        </div>
      </div>

      <div class="card mt-4">
        <div class="flex items-center justify-between mb-3">
          <div class="text-sm text-slate-500">📊 수익률 차트</div>
          <div id="returns-chart-tabs"></div>
        </div>
        <div class="flex items-center justify-between mb-1">
          <div class="text-xs text-slate-400">📈 누적 수익률</div>
          <div id="cumulative-granularity-tabs" class="flex gap-1"></div>
        </div>
        <div id="chart-cumulative-wrap"><canvas id="chart-cumulative" height="60"></canvas></div>
        <div class="text-xs text-slate-400 mb-1 mt-5">📊 월별 수익률</div>
        <canvas id="chart-monthly" height="60"></canvas>
      </div>

      ${
        selectedAccountId
          ? ''
          : `<div class="card mt-4">
        <div class="text-sm text-slate-500 mb-2">📊 계좌별 누적 수익률 비교</div>
        <canvas id="chart-by-account"></canvas>
      </div>`
      }
    `;

    container.querySelector('#returns-chart-tabs').innerHTML = renderAccountTabs(accounts, selectedAccountId);

    bindAccountTabs(container, (accountId) => {
      selectedAccountId = accountId;
      renderDashboard(container);
    });

    await Promise.all([
      renderMarketTicker(container.querySelector('#market-ticker')),
      renderSummary(container),
      renderAllocation(container),
      renderGrowthChart(container),
      renderCumulativeChart(container),
      renderMonthlyChart(container),
      selectedAccountId ? Promise.resolve() : renderByAccountChart(container),
    ]);
  } catch (err) {
    container.innerHTML = `<p class="text-red-600">불러오기 실패: ${err.message}</p>`;
  }
}

async function renderSummary(container) {
  const cardEl = container.querySelector('#dashboard-summary-card');
  try {
    const [summary, dividends] = await Promise.all([
      api.getDashboardSummary(selectedAccountId),
      api.getDividendsSummary(selectedAccountId).catch(() => null),
    ]);
    cardEl.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <div class="text-sm text-slate-500">💼 총 자산</div>
          <div class="text-2xl font-bold">${formatCurrency(summary.totalAssets)}</div>
        </div>
        <div class="text-xs text-slate-400">${summary.holdingsCount}종목</div>
      </div>

      <div class="border-t border-slate-100 my-3"></div>

      <div class="text-sm text-slate-500 mb-2">📈 수익</div>
      <div class="grid grid-cols-2 gap-y-1.5 text-sm">
        <div class="text-slate-500">순납입금</div>
        <div class="text-right">${formatCurrency(summary.netContributions)}</div>
        <div class="text-slate-500">누적수익금</div>
        <div class="text-right ${signClass(summary.cumulativeProfit)}">${formatCurrency(summary.cumulativeProfit)}</div>
        <div class="text-slate-500">누적수익률</div>
        <div class="text-right ${signClass(summary.cumulativeReturnRate)}">${formatPercent(summary.cumulativeReturnRate)}</div>
        <div class="text-slate-500">연평균수익률</div>
        <div class="text-right ${signClass(summary.annualizedReturnRate)}">${summary.annualizedReturnRate == null ? '-' : formatPercent(summary.annualizedReturnRate)}</div>
      </div>

      <div class="border-t border-slate-100 my-3"></div>

      <div class="flex items-center justify-between mb-2">
        <div class="text-sm text-slate-500">💰 배당</div>
        <span class="pill pill-dividend">🤖 자동동기화</span>
      </div>
      <div class="grid grid-cols-2 gap-y-1.5 text-sm">
        <div class="text-slate-500">누적 배당</div>
        <div class="text-right">${formatCurrency(dividends?.cumulativeDividends)}</div>
        <div class="text-slate-500">당해년도 수령</div>
        <div class="text-right">${formatCurrency(dividends?.thisYearDividends)}</div>
        <div class="text-slate-500">예상 연간 배당</div>
        <div class="text-right">${formatCurrency(dividends?.projectedAnnualDividend)}</div>
        <div class="text-slate-500">시가배당률</div>
        <div class="text-right ${signClass(dividends?.dividendYield)}">${formatPercent(dividends?.dividendYield)}</div>
        <div class="text-slate-500">투자배당률(YoC)</div>
        <div class="text-right ${signClass(dividends?.yoc)}">${formatPercent(dividends?.yoc)}</div>
      </div>
    `;
  } catch (err) {
    cardEl.innerHTML = `
      <p class="text-red-600 mb-2">불러오기 실패: ${err.message}</p>
      <button class="dashboard-retry text-sm text-blue-600 underline">다시 시도</button>
    `;
    cardEl.querySelector('.dashboard-retry')?.addEventListener('click', () => renderSummary(container));
  }
}

async function renderAllocation(container) {
  const cardEl = container.querySelector('#dashboard-allocation-card');
  // 계좌 하나로 필터된 상태에서는 계좌별 배분이 100% 한 조각이라 의미가 없어 제외한다.
  const groupings = selectedAccountId ? ['type', 'ticker'] : ['account', 'type', 'ticker'];
  cardEl.innerHTML = `
    <div class="grid grid-cols-${groupings.length} gap-2">
      ${groupings
        .map(
          (g) => `
        <div>
          <div class="text-xs text-slate-500 text-center mb-1">${ALLOC_LABELS[g]}</div>
          <canvas id="chart-alloc-${g}" height="150"></canvas>
        </div>
      `
        )
        .join('')}
    </div>
  `;
  await Promise.all(
    groupings.map(async (g) => {
      const data = await api.getDashboardAllocation(g, selectedAccountId).catch(() => []);
      if (data.length > 0) {
        renderDoughnutChart(`chart-alloc-${g}`, { labels: data.map((a) => a.label), data: data.map((a) => a.value) });
      } else {
        setEmptyCanvas(`chart-alloc-${g}`, '데이터 없음');
      }
    })
  );
}

async function renderGrowthChart(container) {
  const growth = await api.getDashboardGrowth(selectedAccountId).catch(() => []);
  if (growth.length > 0) {
    renderLineChart('chart-growth', {
      labels: growth.map((p) => p.date),
      datasets: [
        { label: '평가금액', data: growth.map((p) => p.value), borderColor: '#2563eb', tension: 0.2 },
        { label: '납입금', data: growth.map((p) => p.contributions), borderColor: '#94a3b8', borderDash: [4, 4], tension: 0.2 },
      ],
    });
  } else {
    setEmptyCanvas('chart-growth', '보유 종목(매수 이벤트)을 추가하면 자동으로 표시됩니다.');
  }
}

function renderGranularityTabs(container) {
  const tabsEl = container.querySelector('#cumulative-granularity-tabs');
  tabsEl.innerHTML = Object.entries(GRANULARITY_LABELS)
    .map(
      ([key, label]) =>
        `<button data-granularity="${key}" class="granularity-tab btn btn-sm ${
          cumulativeGranularity === key ? 'btn-primary' : 'btn-secondary'
        }">${label}</button>`
    )
    .join('');
  tabsEl.querySelectorAll('.granularity-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      cumulativeGranularity = btn.dataset.granularity;
      renderCumulativeChart(container);
    });
  });
}

async function renderCumulativeChart(container) {
  renderGranularityTabs(container);
  const wrap = container.querySelector('#chart-cumulative-wrap');
  wrap.innerHTML = `<canvas id="chart-cumulative" height="60"></canvas>`;
  const cumulative = await api.getReturnsCumulative(selectedAccountId, cumulativeGranularity).catch(() => []);
  if (cumulative.length > 0) {
    renderLineChart('chart-cumulative', {
      labels: cumulative.map((p) => p.date),
      datasets: [{ label: '누적 수익률', data: cumulative.map((p) => p.returnRate), borderColor: '#2563eb', tension: 0.2 }],
      yFormat: 'percent',
    });
  } else {
    setEmptyCanvas('chart-cumulative', '보유 종목(매수 이벤트)을 추가하면 자동으로 표시됩니다.');
  }
}

async function renderMonthlyChart(container) {
  const monthly = await api.getReturnsMonthly(selectedAccountId).catch(() => []);
  if (monthly.length > 0) {
    renderBarChart('chart-monthly', {
      labels: monthly.map((p) => p.date.slice(0, 7)),
      datasets: [
        {
          label: '월별 수익률',
          data: monthly.map((p) => p.returnRate),
          backgroundColor: monthly.map((p) => (p.returnRate >= 0 ? '#ef4444' : '#3b82f6')),
        },
      ],
    });
  } else {
    setEmptyCanvas('chart-monthly', '데이터가 부족해요.');
  }
}

async function renderByAccountChart(container) {
  const byAccount = await api.getReturnsByAccount().catch(() => []);
  if (byAccount.length > 0) {
    renderBarChart('chart-by-account', {
      labels: byAccount.map((a) => a.accountName),
      datasets: [
        {
          label: '누적 수익률',
          data: byAccount.map((a) => a.returnRate ?? 0),
          backgroundColor: byAccount.map((a) => (a.returnRate >= 0 ? '#ef4444' : '#3b82f6')),
        },
      ],
    });
  } else {
    setEmptyCanvas('chart-by-account', '계좌를 추가하면 표시됩니다.');
  }
}

function setEmptyCanvas(canvasId, message) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  const p = document.createElement('p');
  p.className = 'text-slate-400 text-xs text-center';
  p.textContent = message;
  el.replaceWith(p);
}

