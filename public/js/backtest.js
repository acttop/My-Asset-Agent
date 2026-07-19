import { api } from './api.js';
import {
  formatCurrency,
  formatPercent,
  escapeHtml,
  signClass,
  formatSignedPercent,
  formatSignedCurrency,
} from './format.js';
import { renderLineChart } from './charts.js';
import { DOT_COLORS } from './nameCell.js';
import { normalizeTicker } from './tickerInput.js';
import { wireThousandsInput, parseCommaNumber, formatForInput } from './numberInput.js';

const PRESETS = [
  { icon: '💼', name: 'S&P500', allocations: [{ ticker: 'SPY', weight: 1 }] },
  { icon: '🚀', name: '미국 성장형', allocations: [{ ticker: 'QQQ', weight: 0.6 }, { ticker: 'SPY', weight: 0.4 }] },
  { icon: '💸', name: '배당형', allocations: [{ ticker: 'SCHD', weight: 0.7 }, { ticker: 'VYM', weight: 0.3 }] },
  { icon: '🇰🇷', name: '한미 분산', allocations: [{ ticker: 'SPY', weight: 0.5 }, { ticker: '069500.KS', weight: 0.5 }] },
  {
    icon: '🛡️',
    name: '올웨더',
    allocations: [
      { ticker: 'SPY', weight: 0.3 },
      { ticker: 'TLT', weight: 0.4 },
      { ticker: 'IEF', weight: 0.15 },
      { ticker: 'GLD', weight: 0.075 },
      { ticker: 'DBC', weight: 0.075 },
    ],
  },
];

const BENCHMARKS = {
  none: null,
  sp500: { label: 'S&P500', ticker: 'SPY' },
  kospi: { label: '코스피(KODEX200)', ticker: '069500.KS' },
  nasdaq100: { label: '나스닥100', ticker: 'QQQ' },
  schd: { label: 'SCHD', ticker: 'SCHD' },
  gold: { label: '금(GLD)', ticker: 'GLD' },
  bond: { label: '미국채권(TLT)', ticker: 'TLT' },
};

const PERIOD_YEARS = [1, 3, 5, 10, 20];

const state = {
  rows: [
    { ticker: 'SPY', weight: 70, name: null },
    { ticker: 'SCHD', weight: 30, name: null },
  ],
  portfolioName: '',
  editingPortfolioId: null,
  initialAmount: 1000, // 만원
  monthlyContribution: 0, // 만원
  yearlyContribution: 0, // 만원
  periodYears: 1,
  rebalancePeriod: 'quarterly',
  reinvestDividends: true,
  benchmark: 'sp500',
  comparePortfolioId: '',
};

export async function renderBacktest(container) {
  container.innerHTML = `<p class="text-slate-500">불러오는 중...</p>`;
  try {
    const [portfolios, accounts, tickerMeta] = await Promise.all([
      api.getBacktestPortfolios(),
      api.getAccounts(),
      api.getTickerMeta().catch(() => ({})),
    ]);
    container.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
      <div class="card mb-4">
        <div class="text-sm text-slate-500 mb-1">🚀 추천 포트폴리오</div>
        <div class="text-xs text-slate-400 mb-3">처음이라면 프리셋으로 시작해보세요</div>
        <div class="flex flex-wrap gap-2">
          ${PRESETS.map((p, i) => `<button data-preset="${i}" class="bt-preset px-3 py-1.5 text-sm rounded border bg-white">${p.icon} ${p.name}</button>`).join('')}
        </div>
      </div>

      <div class="card mb-4">
        <div class="flex justify-between items-center mb-3">
          <div class="text-sm text-slate-500">📋 포트폴리오 구성 ${state.editingPortfolioId ? '<span class="text-blue-600 text-xs">(수정 중)</span>' : ''}</div>
          <button id="bt-reset" type="button" class="text-xs text-slate-400">전체 초기화</button>
        </div>

        <div class="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-slate-100">
          <select id="bt-import-account" class="border rounded px-2 py-1 text-sm">
            <option value="">전체 계좌</option>
            ${accounts.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('')}
          </select>
          <button id="bt-import-holdings" type="button" class="px-2 py-1 text-sm border rounded bg-emerald-50 text-emerald-700 border-emerald-200">📥 내 보유종목 불러오기</button>
          <span class="text-xs text-slate-400">현재 보유 비중을 그대로 불러와요. 현금성 자산은 제외돼요. (투자 자문이 아닌 참고용 정보예요)</span>
        </div>

        <div class="relative mb-3">
          <input id="bt-ticker-search" placeholder="종목명 또는 티커 검색 (예: 삼성전자, AAPL)" class="border rounded px-3 py-2 w-full" autocomplete="off" />
          <div id="bt-ticker-results" class="ticker-search-results hidden"></div>
        </div>

        <div class="card mb-3 border-amber-200 bg-amber-50">
          <div class="text-xs font-medium text-amber-700 mb-1.5">🇰🇷 국내 주식·ETF 티커 입력 방법</div>
          <ul class="text-xs text-amber-700 space-y-1">
            <li>HTS·MTS의 종목코드(6자리)에 거래소 코드를 붙여야 해요.</li>
            <li>코스피 주식: <code>005380.KS</code> → 현대자동차 · 코스닥: <code>247540.KQ</code> → 에코프로비엠</li>
            <li>국내 ETF: <code>069500.KS</code> → KODEX 200 · <code>133690.KS</code> → TIGER 나스닥100</li>
            <li>💡 국내 ETF도 코스피 상장이면 .KS, 코스닥이면 .KQ (대부분 .KS)</li>
            <li>💡 6자리 숫자만 입력 후 Enter → .KS 자동 변환</li>
            <li>🔍 원하는 종목이 검색되지 않으면 티커를 직접 입력해보세요 (예: 005380.KS, NVDA)</li>
          </ul>
        </div>

        <input id="bt-name" placeholder="포트폴리오 이름 (저장 시 필요)" value="${escapeHtml(state.portfolioName)}" class="border rounded px-2 py-1 mb-3 w-full sm:w-64" />

        <div id="bt-rows" class="space-y-2 mb-1"></div>
        <div id="bt-empty" class="text-center text-slate-400 text-sm py-4 hidden">종목을 추가하거나 위 프리셋을 선택해보세요</div>

        <div class="flex justify-between items-center text-sm mt-3 mb-1">
          <div class="text-slate-500">비중 합계</div>
          <div id="bt-sum-value" class="font-medium"></div>
        </div>
        <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div id="bt-sum-bar" class="h-full bg-blue-400" style="width:0%"></div>
        </div>
        <div id="bt-sum-hint" class="text-xs text-slate-400 mt-1"></div>
      </div>

      <div class="flex gap-2 mb-4">
        <button id="bt-save-portfolio" type="button" class="flex-1 border rounded px-3 py-2.5 text-sm bg-white">⬆ ${state.editingPortfolioId ? '변경사항 저장' : '포트폴리오 저장'}</button>
        <button id="bt-saved-toggle" type="button" class="flex-1 border rounded px-3 py-2.5 text-sm bg-white">☰ 저장 목록 ${portfolios.length}</button>
      </div>
      <div id="bt-saved-list" class="card mb-4 hidden">
        ${
          portfolios.length === 0
            ? `<div class="text-xs text-slate-400">저장된 포트폴리오가 없어요.</div>`
            : portfolios
                .map(
                  (p) => `
              <div class="flex items-center justify-between text-sm border-b border-slate-100 py-1.5 last:border-b-0 ${state.editingPortfolioId === p.id ? 'bg-blue-50 -mx-2 px-2 rounded' : ''}">
                <div class="min-w-0">
                  <span class="font-medium">${escapeHtml(p.name)}</span>
                  <span class="text-xs text-slate-400 ml-2">${p.allocations.map((a) => `${escapeHtml(a.ticker)} ${(a.weight * 100).toFixed(0)}%`).join(', ')}</span>
                </div>
                <div class="flex gap-2 shrink-0 ml-2">
                  <button data-load="${p.id}" class="bt-load-portfolio text-blue-600 text-xs">불러오기</button>
                  <button data-delete="${p.id}" class="bt-delete-portfolio text-red-500 text-xs">삭제</button>
                </div>
              </div>
            `
                )
                .join('')
        }
        ${state.editingPortfolioId ? `<button id="bt-new-portfolio" type="button" class="text-xs text-slate-500 mt-2">새로 만들기</button>` : ''}
      </div>
      </div>

      <div>
      <div class="card mb-4">
        <div class="text-sm text-slate-500 mb-3">⚙️ 투자 설정</div>

        <div class="mb-3">
          <label class="block text-xs text-slate-500 mb-1">초기 투자금</label>
          <div class="flex items-center gap-2 border rounded px-3 py-2 mb-2">
            <input id="bt-initial" type="text" inputmode="decimal" value="${formatForInput(state.initialAmount)}" class="flex-1 text-xl font-bold outline-none text-right" />
            <span class="text-slate-400 text-sm">만원</span>
          </div>
          <div class="flex gap-2">
            ${[500, 1000, 3000, 5000].map((v) => `<button data-amount="${v}" class="bt-amount-preset px-2 py-1 text-xs border rounded">${v}만</button>`).join('')}
          </div>
        </div>

        <div class="mb-3">
          <label class="block text-xs text-slate-500 mb-1">월 추가 납입 (없으면 0)</label>
          <div class="flex items-center gap-2 border rounded px-3 py-2">
            <input id="bt-monthly" type="text" inputmode="decimal" value="${formatForInput(state.monthlyContribution)}" class="flex-1 outline-none text-right" />
            <span class="text-slate-400 text-sm">만원/월</span>
          </div>
        </div>

        <div class="mb-3">
          <label class="block text-xs text-slate-500 mb-1">연 추가 납입 (없으면 0, 매년 1회)</label>
          <div class="flex items-center gap-2 border rounded px-3 py-2">
            <input id="bt-yearly" type="text" inputmode="decimal" value="${formatForInput(state.yearlyContribution)}" class="flex-1 outline-none text-right" />
            <span class="text-slate-400 text-sm">만원/년</span>
          </div>
          <div class="text-xs text-slate-400 mt-1">월 납입과 별개로, 투자 시작일 기준 매년 한 번씩 추가로 납입합니다 (보너스·연간 저축 등).</div>
        </div>

        <div class="mb-3">
          <label class="block text-xs text-slate-500 mb-1">투자 기간</label>
          <div class="flex gap-2 flex-wrap">
            ${PERIOD_YEARS.map((y) => `<button data-years="${y}" class="bt-period-btn px-3 py-1.5 text-sm rounded border ${state.periodYears === y ? 'bg-blue-600 text-white' : 'bg-white'}">${y}년</button>`).join('')}
          </div>
        </div>

        <div class="mb-3">
          <label class="block text-xs text-slate-500 mb-1">리밸런싱 주기</label>
          <div class="flex gap-2 flex-wrap">
            ${[['none', '없음'], ['monthly', '월'], ['quarterly', '분기'], ['semiannual', '반기'], ['yearly', '연']]
              .map(([v, l]) => `<button data-rebal="${v}" class="bt-rebal-btn px-3 py-1.5 text-sm rounded border ${state.rebalancePeriod === v ? 'bg-orange-500 text-white' : 'bg-white'}">${l}</button>`)
              .join('')}
          </div>
        </div>

        <div class="mb-3">
          <label class="block text-xs text-slate-500 mb-1">배당 재투자</label>
          <div class="flex gap-2">
            <button data-reinvest="true" class="bt-reinvest-btn px-3 py-1.5 text-sm rounded border ${state.reinvestDividends ? 'bg-orange-500 text-white' : 'bg-white'}">재투자 ON</button>
            <button data-reinvest="false" class="bt-reinvest-btn px-3 py-1.5 text-sm rounded border ${!state.reinvestDividends ? 'bg-orange-500 text-white' : 'bg-white'}">배당 수령 (OFF)</button>
          </div>
          <div class="text-xs text-slate-400 mt-1">OFF는 배당을 반영하지 않은 가격 수익률만 계산합니다. 국내(.KS/.KQ) 종목은 배당 재투자 데이터를 지원하지 않아 항상 가격 수익률로 계산돼요.</div>
        </div>

        <div class="mb-3">
          <label class="block text-xs text-slate-500 mb-1">비교 대상 (벤치마크)</label>
          <div class="flex flex-wrap gap-2">
            ${Object.entries(BENCHMARKS)
              .map(
                ([key, b]) =>
                  `<button data-benchmark="${key}" class="bt-benchmark-btn px-3 py-1.5 text-sm rounded border ${state.benchmark === key ? 'bg-orange-500 text-white' : 'bg-white'}">${key === 'none' ? '비교 안함' : b.label}</button>`
              )
              .join('')}
          </div>
        </div>

        <div class="mb-1">
          <label class="block text-xs text-slate-500 mb-1">내 포트폴리오와 비교</label>
          <select id="bt-compare-select" class="border rounded px-2 py-1">
            <option value="">저장된 포트폴리오와 비교 안함</option>
            ${portfolios.map((p) => `<option value="${p.id}" ${state.comparePortfolioId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      </div>
      </div>

      <button id="bt-run" type="button" class="bg-blue-600 text-white px-4 py-2.5 rounded font-medium mb-4 w-full">📊 백테스팅 시작</button>

      <div id="bt-result"></div>
    `;

    renderRows(container);
    wireEvents(container, portfolios, accounts, tickerMeta);
  } catch (err) {
    container.innerHTML = `<p class="text-red-600">불러오기 실패: ${err.message}</p>`;
  }
}

function renderRowItem(row, i, color) {
  const name = row.name || row.ticker || '(신규 종목)';
  const subtitleParts = [row.ticker, row.accountName].filter(Boolean);
  return `
    <div class="flex items-center gap-3 p-2.5 border rounded">
      <span class="inline-block w-2 h-2 rounded-full shrink-0" style="background:${color}"></span>
      <div class="flex-1 min-w-0">
        <div class="font-medium text-sm truncate">${escapeHtml(name)}</div>
        ${subtitleParts.length ? `<div class="text-xs text-slate-400 truncate">${escapeHtml(subtitleParts.join(' · '))}</div>` : ''}
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <input data-idx="${i}" data-field="weight" type="number" step="any" value="${row.weight}" class="border rounded px-2 py-1 w-16 text-right text-sm" />
        <span class="text-slate-400 text-xs">%</span>
      </div>
      <button data-idx="${i}" class="bt-remove-row w-6 h-6 rounded-full bg-slate-100 text-slate-400 text-xs hover:bg-slate-200 shrink-0">✕</button>
    </div>
  `;
}

function renderRows(container) {
  const listEl = container.querySelector('#bt-rows');
  listEl.innerHTML = state.rows.map((r, i) => renderRowItem(r, i, DOT_COLORS[i % DOT_COLORS.length])).join('');
  container.querySelector('#bt-empty')?.classList.toggle('hidden', state.rows.length > 0);
  updateSum(container);

  listEl.querySelectorAll('input[data-field="weight"]').forEach((inp) =>
    inp.addEventListener('input', (e) => {
      state.rows[Number(e.target.dataset.idx)].weight = Number(e.target.value);
      updateSum(container);
    })
  );
  listEl.querySelectorAll('.bt-remove-row').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      state.rows.splice(Number(e.target.dataset.idx), 1);
      renderRows(container);
    })
  );
}

function updateSum(container) {
  const sum = state.rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
  const ok = Math.abs(sum - 100) <= 0.1;

  const valueEl = container.querySelector('#bt-sum-value');
  if (valueEl) {
    valueEl.textContent = `${sum.toFixed(1)}%`;
    valueEl.className = `font-medium ${ok ? 'text-emerald-600' : 'text-slate-700'}`;
  }
  const barEl = container.querySelector('#bt-sum-bar');
  if (barEl) {
    barEl.style.width = `${Math.min(100, Math.max(0, sum))}%`;
    barEl.className = `h-full ${ok ? 'bg-emerald-500' : 'bg-blue-400'}`;
  }
  const hintEl = container.querySelector('#bt-sum-hint');
  if (hintEl) {
    hintEl.textContent = ok ? '' : `비중 합계가 정확히 100%여야 해요 (현재 ${sum.toFixed(1)}%)`;
  }
}

// 검색창에 키워드를 입력하면 종목명/티커로 찾아 목록을 보여주고, 클릭하면 포트폴리오 구성에 추가한다.
function wireTickerSearch(container) {
  const input = container.querySelector('#bt-ticker-search');
  const resultsEl = container.querySelector('#bt-ticker-results');
  let debounceTimer;

  function closeResults() {
    resultsEl.classList.add('hidden');
    resultsEl.innerHTML = '';
  }

  function addRow(ticker, name) {
    if (state.rows.some((r) => r.ticker === ticker)) {
      alert('이미 추가된 종목이에요.');
      return;
    }
    state.rows.push({ ticker, weight: 0, name: name || null });
    renderRows(container);
  }

  function renderResults(results) {
    if (results.length === 0) {
      resultsEl.innerHTML = `<div class="text-xs text-slate-400 p-2">검색 결과가 없어요. 티커를 직접 입력한 뒤 Enter를 눌러 추가해보세요.</div>`;
      resultsEl.classList.remove('hidden');
      return;
    }
    resultsEl.innerHTML = results
      .map(
        (r) => `
      <div class="ticker-search-item" data-ticker="${escapeHtml(r.ticker)}" data-name="${escapeHtml(r.name)}">
        <span>${escapeHtml(r.name)}</span>
        <span class="text-slate-400">${escapeHtml(r.ticker)}</span>
      </div>
    `
      )
      .join('');
    resultsEl.classList.remove('hidden');

    resultsEl.querySelectorAll('.ticker-search-item').forEach((item) => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); // blur보다 먼저 실행되도록
        addRow(item.dataset.ticker, item.dataset.name);
        input.value = '';
        closeResults();
      });
    });
  }

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (!q) {
      closeResults();
      return;
    }
    debounceTimer = setTimeout(async () => {
      const results = await api.searchTickers(q).catch(() => []);
      renderResults(results);
    }, 200);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const raw = input.value.trim();
    if (!raw) return;
    const ticker = normalizeTicker(raw);
    addRow(ticker, null);
    api.registerTicker(ticker, '주식', /\.(KS|KQ)$/i.test(ticker) ? 'KR' : 'US').catch(() => {});
    input.value = '';
    closeResults();
  });

  input.addEventListener('blur', () => {
    setTimeout(closeResults, 150); // 결과 클릭이 blur보다 먼저 처리되도록
  });
  input.addEventListener('focus', () => {
    if (resultsEl.children.length > 0) resultsEl.classList.remove('hidden');
  });
}

function wireEvents(container, portfolios, accounts, tickerMeta) {
  wireTickerSearch(container);

  container.querySelector('#bt-import-holdings').addEventListener('click', async () => {
    const accountId = container.querySelector('#bt-import-account').value;
    try {
      const holdings = await api.getHoldings(accountId || undefined);
      const securities = holdings.filter((h) => !h.isCash && h.ticker && h.marketValueKrw);
      if (securities.length === 0) {
        alert('불러올 보유 종목이 없어요. (현금성 자산은 백테스팅 대상에서 제외돼요)');
        return;
      }
      // 전체 계좌 선택 시 같은 종목이 여러 계좌에 나뉘어 있을 수 있어 티커 기준으로 합산한다.
      const byTicker = new Map();
      for (const h of securities) {
        const accName = accounts.find((a) => a.id === h.accountId)?.name || h.accountId;
        const prev = byTicker.get(h.ticker);
        if (prev) {
          prev.quantity += h.quantity;
          prev.marketValueKrw += h.marketValueKrw;
          if (!prev.accountNames.includes(accName)) prev.accountNames.push(accName);
        } else {
          byTicker.set(h.ticker, {
            name: h.name,
            quantity: h.quantity,
            currentPrice: h.currentPrice,
            priceCurrency: h.priceCurrency,
            marketValueKrw: h.marketValueKrw,
            accountNames: [accName],
          });
        }
      }
      const total = [...byTicker.values()].reduce((s, v) => s + v.marketValueKrw, 0);
      state.rows = [...byTicker.entries()].map(([ticker, h]) => ({
        ticker,
        weight: Math.round((h.marketValueKrw / total) * 1000) / 10,
        name: h.name,
        accountName: h.accountNames.join(', '),
        quantity: h.quantity,
        currentPrice: h.currentPrice,
        priceCurrency: h.priceCurrency,
        marketValueKrw: h.marketValueKrw,
      }));
      // 반올림 오차로 합계가 100%에서 벗어나면 마지막 종목에서 보정한다.
      const roundedSum = state.rows.reduce((s, r) => s + r.weight, 0);
      const drift = Math.round((100 - roundedSum) * 10) / 10;
      if (drift !== 0 && state.rows.length > 0) {
        state.rows[state.rows.length - 1].weight = Math.round((state.rows[state.rows.length - 1].weight + drift) * 10) / 10;
      }
      const accountName = accountId ? accounts.find((a) => a.id === accountId)?.name : '전체 계좌';
      state.portfolioName = `내 보유종목 (${accountName})`;
      state.editingPortfolioId = null;
      // 초기 투자금을 불러온 보유종목의 현재 평가금액 합계(만원)로 맞춘다.
      state.initialAmount = Math.round(total / 10000);
      renderBacktest(container);
    } catch (err) {
      alert('보유종목을 불러오지 못했어요: ' + err.message);
    }
  });

  container.querySelectorAll('.bt-preset').forEach((btn) =>
    btn.addEventListener('click', () => {
      const preset = PRESETS[Number(btn.dataset.preset)];
      state.rows = preset.allocations.map((a) => ({
        ticker: a.ticker,
        weight: a.weight * 100,
        name: tickerMeta[a.ticker]?.name || null,
      }));
      state.portfolioName = preset.name;
      state.editingPortfolioId = null;
      renderBacktest(container);
    })
  );

  container.querySelector('#bt-reset').addEventListener('click', () => {
    state.rows = [];
    state.portfolioName = '';
    state.editingPortfolioId = null;
    container.querySelector('#bt-name').value = '';
    renderRows(container);
  });

  container.querySelector('#bt-saved-toggle').addEventListener('click', () => {
    container.querySelector('#bt-saved-list').classList.toggle('hidden');
  });

  container.querySelectorAll('.bt-load-portfolio').forEach((btn) =>
    btn.addEventListener('click', () => {
      const p = portfolios.find((x) => x.id === btn.dataset.load);
      if (!p) return;
      state.editingPortfolioId = p.id;
      state.portfolioName = p.name;
      state.rows = p.allocations.map((a) => ({
        ticker: a.ticker,
        weight: a.weight * 100,
        name: tickerMeta[a.ticker]?.name || null,
      }));
      renderBacktest(container);
    })
  );

  container.querySelectorAll('.bt-delete-portfolio').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('이 포트폴리오를 삭제할까요?')) return;
      await api.deleteBacktestPortfolio(btn.dataset.delete);
      if (state.editingPortfolioId === btn.dataset.delete) state.editingPortfolioId = null;
      renderBacktest(container);
    })
  );

  container.querySelector('#bt-new-portfolio')?.addEventListener('click', () => {
    state.editingPortfolioId = null;
    state.portfolioName = '';
    state.rows = [];
    renderBacktest(container);
  });

  container.querySelector('#bt-name').addEventListener('input', (e) => {
    state.portfolioName = e.target.value;
  });

  container.querySelector('#bt-save-portfolio').addEventListener('click', async () => {
    const allocations = state.rows.filter((r) => r.ticker).map((r) => ({ ticker: r.ticker, weight: r.weight / 100 }));
    const sum = allocations.reduce((s, a) => s + a.weight, 0);
    if (!state.portfolioName || Math.abs(sum - 1) > 0.001) {
      alert('이름을 입력하고, 비중의 합이 100%가 되어야 저장할 수 있어요.');
      return;
    }
    try {
      if (state.editingPortfolioId) {
        await api.updateBacktestPortfolio(state.editingPortfolioId, { name: state.portfolioName, allocations });
      } else {
        await api.createBacktestPortfolio({ name: state.portfolioName, allocations });
      }
      renderBacktest(container);
    } catch (err) {
      alert(err.message);
    }
  });

  wireThousandsInput(container.querySelector('#bt-initial'));
  wireThousandsInput(container.querySelector('#bt-monthly'));
  wireThousandsInput(container.querySelector('#bt-yearly'));

  container.querySelector('#bt-initial').addEventListener('input', (e) => {
    state.initialAmount = parseCommaNumber(e.target.value);
  });
  container.querySelectorAll('.bt-amount-preset').forEach((btn) =>
    btn.addEventListener('click', () => {
      state.initialAmount = Number(btn.dataset.amount);
      const input = container.querySelector('#bt-initial');
      input.value = state.initialAmount;
      input.dispatchEvent(new Event('input')); // 콤마 서식 적용 + state 동기화
    })
  );
  container.querySelector('#bt-monthly').addEventListener('input', (e) => {
    state.monthlyContribution = parseCommaNumber(e.target.value);
  });
  container.querySelector('#bt-yearly').addEventListener('input', (e) => {
    state.yearlyContribution = parseCommaNumber(e.target.value);
  });

  container.querySelectorAll('.bt-period-btn').forEach((btn) =>
    btn.addEventListener('click', () => {
      state.periodYears = Number(btn.dataset.years);
      container.querySelectorAll('.bt-period-btn').forEach((b) => toggleActive(b, b === btn));
    })
  );
  container.querySelectorAll('.bt-rebal-btn').forEach((btn) =>
    btn.addEventListener('click', () => {
      state.rebalancePeriod = btn.dataset.rebal;
      container.querySelectorAll('.bt-rebal-btn').forEach((b) => toggleActive(b, b === btn, 'bg-orange-500'));
    })
  );
  container.querySelectorAll('.bt-reinvest-btn').forEach((btn) =>
    btn.addEventListener('click', () => {
      state.reinvestDividends = btn.dataset.reinvest === 'true';
      container.querySelectorAll('.bt-reinvest-btn').forEach((b) => toggleActive(b, b === btn, 'bg-orange-500'));
    })
  );
  container.querySelectorAll('.bt-benchmark-btn').forEach((btn) =>
    btn.addEventListener('click', () => {
      state.benchmark = btn.dataset.benchmark;
      container.querySelectorAll('.bt-benchmark-btn').forEach((b) => toggleActive(b, b === btn, 'bg-orange-500'));
    })
  );
  container.querySelector('#bt-compare-select').addEventListener('change', (e) => {
    state.comparePortfolioId = e.target.value;
  });

  container.querySelector('#bt-run').addEventListener('click', () => runBacktest(container, portfolios));
}

function toggleActive(btn, isActive, activeClass = 'bg-blue-600') {
  btn.classList.toggle(activeClass, isActive);
  btn.classList.toggle('text-white', isActive);
  btn.classList.toggle('bg-white', !isActive);
}

async function runBacktest(container, portfolios) {
  const allocations = state.rows.filter((r) => r.ticker).map((r) => ({ ticker: r.ticker, weight: r.weight / 100 }));
  const sum = allocations.reduce((s, a) => s + a.weight, 0);
  if (allocations.length === 0 || Math.abs(sum - 1) > 0.001) {
    alert('비중의 합이 100%가 되어야 실행할 수 있어요.');
    return;
  }

  const resultEl = container.querySelector('#bt-result');
  resultEl.innerHTML = `<p class="text-slate-500">시뮬레이션 실행 중... (과거 시세 조회에 시간이 걸릴 수 있어요)</p>`;

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(new Date().setFullYear(new Date().getFullYear() - state.periodYears))
    .toISOString()
    .slice(0, 10);

  const baseParams = {
    startDate,
    endDate,
    rebalancePeriod: state.rebalancePeriod,
    initialAmount: state.initialAmount * 10000,
    monthlyContribution: state.monthlyContribution * 10000,
    yearlyContribution: state.yearlyContribution * 10000,
    reinvestDividends: state.reinvestDividends,
  };

  const benchmark = BENCHMARKS[state.benchmark];
  const comparePortfolio = portfolios.find((p) => p.id === state.comparePortfolioId);

  try {
    const [main, benchmarkResult, compareResult] = await Promise.all([
      api.runBacktest({ ...baseParams, allocations }),
      benchmark
        ? api.runBacktest({ ...baseParams, allocations: [{ ticker: benchmark.ticker, weight: 1 }] }).catch(() => null)
        : Promise.resolve(null),
      comparePortfolio
        ? api.runBacktest({ ...baseParams, allocations: comparePortfolio.allocations }).catch(() => null)
        : Promise.resolve(null),
    ]);

    renderResult(resultEl, {
      main,
      benchmark: benchmarkResult ? { label: benchmark.label, result: benchmarkResult } : null,
      compare: compareResult ? { label: comparePortfolio.name, result: compareResult } : null,
    });
  } catch (err) {
    resultEl.innerHTML = `<p class="text-red-600">실행 실패: ${err.message}</p>`;
  }
}

function renderResult(el, { main, benchmark, compare }) {
  const { summary } = main;
  const gainAmount = summary.finalValue - summary.totalContributed;
  el.innerHTML = `
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
      <div class="card">
        <div class="text-xl font-bold">${formatCurrency(summary.finalValue)}</div>
        <div class="text-xs text-slate-500">원금 ${formatCurrency(summary.totalContributed)}</div>
      </div>
      <div class="card">
        <div class="text-xl font-bold ${signClass(summary.totalReturn)}">${formatSignedPercent(summary.totalReturn)}</div>
        <div class="text-xs ${signClass(gainAmount)}">${formatSignedCurrency(gainAmount)}</div>
      </div>
      <div class="card">
        <div class="text-xl font-bold ${signClass(summary.cagr)}">${formatSignedPercent(summary.cagr)}</div>
        <div class="text-xs text-slate-500">연평균 수익률</div>
      </div>
      <div class="card">
        <div class="text-xl font-bold text-blue-600">${formatPercent(summary.maxDrawdown)}</div>
        <div class="text-xs text-slate-500">최대 낙폭</div>
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
      <div class="card">
        <div class="text-sm text-slate-500">변동성 <span class="text-slate-300" title="월별 수익률의 표준편차를 연환산한 값. 등락의 크기를 나타냅니다.">?</span></div>
        <div class="text-lg font-bold mt-1">${formatPercent(summary.volatility)}</div>
        <div class="text-xs text-slate-400">연환산 변동성</div>
      </div>
      <div class="card">
        <div class="text-sm text-slate-500">샤프지수 <span class="text-slate-300" title="위험(변동성) 대비 수익의 비율. 높을수록 효율적인 투자입니다.">?</span></div>
        <div class="text-lg font-bold mt-1">${formatRatio(summary.sharpeRatio)}</div>
        <div class="text-xs text-slate-400">위험 대비 수익</div>
      </div>
      <div class="card">
        <div class="text-sm text-slate-500">칼마 비율 <span class="text-slate-300" title="연평균수익률 ÷ 최대낙폭. 낙폭 대비 수익 효율을 봅니다.">?</span></div>
        <div class="text-lg font-bold mt-1">${formatRatio(summary.calmarRatio)}</div>
        <div class="text-xs text-slate-400">수익 ÷ 최대손실</div>
      </div>
      <div class="card">
        <div class="text-sm text-slate-500">월 승률 <span class="text-slate-300" title="전체 개월 중 수익이 플러스였던 달의 비율">?</span></div>
        <div class="text-lg font-bold mt-1">${formatPercent(summary.monthlyWinRate)}</div>
        <div class="text-xs text-slate-400">최고 ${formatPercent(summary.bestMonth)} / 최악 ${formatPercent(summary.worstMonth)}</div>
      </div>
    </div>

    ${main.dividendUnsupportedTickers?.length ? `<div class="text-xs text-slate-400 mb-4">국내 종목(${main.dividendUnsupportedTickers.join(', ')})은 배당 재투자 데이터가 없어 가격 수익률로 계산됐어요.</div>` : ''}

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card">
        <div class="text-sm text-slate-500">📈 자산 성장 추이</div>
        <div class="text-xs text-slate-400 mb-2">초기 투자금 = 100 기준 월별 성장 (벤치마크 비교)</div>
        <canvas id="chart-backtest-growth"></canvas>
      </div>
      <div class="card">
        <div class="text-sm text-slate-500">📉 낙폭 추이 (Drawdown)</div>
        <div class="text-xs text-slate-400 mb-2">고점 대비 손실 구간 — 빨간 음영이 클수록 버티기 어려운 구간</div>
        <canvas id="chart-backtest-drawdown"></canvas>
      </div>
    </div>
  `;

  const growthDatasets = [
    { label: '내 포트폴리오', data: toIndex(main.series), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.1)', fill: true, tension: 0.2, pointRadius: 0 },
  ];
  if (benchmark) {
    growthDatasets.push({
      label: benchmark.label,
      data: toIndex(alignSeries(main.series, benchmark.result.series)),
      borderColor: '#f59e0b',
      borderDash: [4, 4],
      tension: 0.2,
      pointRadius: 0,
    });
  }
  if (compare) {
    growthDatasets.push({
      label: compare.label,
      data: toIndex(alignSeries(main.series, compare.result.series)),
      borderColor: '#10b981',
      tension: 0.2,
      pointRadius: 0,
    });
  }
  renderLineChart('chart-backtest-growth', {
    labels: main.series.map((p) => p.date),
    datasets: growthDatasets,
    yFormat: 'index',
  });

  renderLineChart('chart-backtest-drawdown', {
    labels: main.series.map((p) => p.date),
    datasets: [
      {
        label: '낙폭',
        data: main.series.map((p) => p.drawdown),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.15)',
        fill: true,
        tension: 0.2,
        pointRadius: 0,
      },
    ],
    yFormat: 'percent',
  });
}

// 시리즈를 첫 값=100 기준 지수로 변환한다 (금액 대신 등락률만 비교하기 위함).
function toIndex(series) {
  const values = Array.isArray(series) ? series.map((p) => (typeof p === 'number' || p == null ? p : p.value)) : [];
  const base = values.find((v) => v != null);
  if (!base) return values.map(() => null);
  return values.map((v) => (v == null ? null : (v / base) * 100));
}

// 두 시뮬레이션의 월별 체크포인트 날짜가 약간 어긋날 수 있어 날짜 기준으로 값만 맞춰 정렬한다.
function alignSeries(baseSeries, otherSeries) {
  const byDate = new Map(otherSeries.map((p) => [p.date, p.value]));
  return baseSeries.map((p) => byDate.get(p.date) ?? null);
}

function formatRatio(value) {
  if (value == null || Number.isNaN(value)) return '-';
  return value.toFixed(2);
}
