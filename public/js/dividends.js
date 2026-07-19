import { api } from './api.js';
import { formatCurrency, formatPercent, escapeHtml } from './format.js';
import { renderBarChart } from './charts.js';
import { sortRows, sortableTh, wireSortableHeaders } from './sortableTable.js';

let sortState = { key: null, dir: 'asc' };
let cachedByTicker = [];

export async function renderDividends(container) {
  container.innerHTML = `<p class="text-slate-500">불러오는 중...</p>`;
  try {
    const [summary, monthly] = await Promise.all([
      api.getDividendsSummary(),
      api.getDividendsMonthly(),
    ]);

    container.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card">
          <div class="text-sm text-slate-500">💰 누적 배당</div>
          <div class="text-2xl font-bold">${formatCurrency(summary.cumulativeDividends)}</div>
        </div>
        <div class="card">
          <div class="text-sm text-slate-500">당해년도 수령</div>
          <div class="text-2xl font-bold">${formatCurrency(summary.thisYearDividends)}</div>
        </div>
        <div class="card">
          <div class="text-sm text-slate-500">예상 연간 배당</div>
          <div class="text-2xl font-bold">${formatCurrency(summary.projectedAnnualDividend)}</div>
        </div>
        <div class="card">
          <div class="text-sm text-slate-500">시가배당률 / YoC</div>
          <div class="text-lg font-bold">${formatPercent(summary.dividendYield)} / ${formatPercent(summary.yoc)}</div>
        </div>
      </div>

      <div class="card mt-4">
        <div class="text-sm text-slate-500 mb-2">💰 ${monthly.year}년 월별 배당 수령 (세전)</div>
        <canvas id="chart-dividends-monthly"></canvas>
      </div>

      <div id="dividends-by-ticker"></div>
    `;
    cachedByTicker = summary.byTicker;
    renderByTickerSection(container);

    const hasAny = monthly.months.some((m) => m.actual > 0);
    if (hasAny) {
      renderBarChart('chart-dividends-monthly', {
        labels: monthly.months.map((m) => `${m.month}월`),
        datasets: [{ label: '실제 수령', data: monthly.months.map((m) => m.actual), backgroundColor: '#f59e0b' }],
        yFormat: 'currency',
      });
    } else {
      const el = document.getElementById('chart-dividends-monthly');
      if (el) {
        const p = document.createElement('p');
        p.className = 'text-slate-400 text-sm';
        p.textContent = '이벤트 이력 탭에서 배당을 기록하면 표시됩니다.';
        el.replaceWith(p);
      }
    }
  } catch (err) {
    container.innerHTML = `<p class="text-red-600">불러오기 실패: ${err.message}</p>`;
  }
}

const DIVIDEND_COLUMN_ACCESSORS = {
  name: (t) => t.name,
  dps: (t) => t.dividendPerShare,
  yield: (t) => t.dividendYield,
  yoc: (t) => t.yoc,
};

function renderByTickerSection(container) {
  const section = container.querySelector('#dividends-by-ticker');
  if (!section) return;
  const rows = cachedByTicker.filter((t) => t.dividendPerShare > 0);
  const sorted = sortRows(rows, sortState, DIVIDEND_COLUMN_ACCESSORS);
  section.innerHTML = renderByTicker(sorted);
  wireSortableHeaders(section, sortState, () => renderByTickerSection(container));
}

function renderByTicker(rows) {
  if (rows.length === 0) return '';
  return `
    <table class="data-table card mt-4">
      <thead><tr>
        ${sortableTh('종목', 'name', sortState)}
        ${sortableTh('주당배당(TTM)', 'dps', sortState)}
        ${sortableTh('시가배당률', 'yield', sortState)}
        ${sortableTh('YoC', 'yoc', sortState)}
      </tr></thead>
      <tbody>
        ${rows
          .map(
            (t) => `
          <tr>
            <td class="text-left">${escapeHtml(t.name)}</td>
            <td>${formatCurrency(t.dividendPerShare)}</td>
            <td>${formatPercent(t.dividendYield)}</td>
            <td>${formatPercent(t.yoc)}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;
}
