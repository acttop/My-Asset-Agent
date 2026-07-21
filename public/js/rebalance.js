import { api } from './api.js';
import { formatCurrency, formatPercent, formatNumber, formatCompactWon, escapeHtml } from './format.js';
import { nameTickerCell, DOT_COLORS } from './nameCell.js';
import { sortRows, sortableTh, wireSortableHeaders } from './sortableTable.js';

let selectedAccountId = null;
let targetRows = []; // 편집용: targetWeight는 0~100 스케일, isCash면 ticker 없이 현금 항목
let tickerMetaCache = {}; // 목표 비중 테이블에서 티커 옆에 종목명을 보여주기 위한 사전
let holdingValueByTicker = new Map(); // 목표 비중 테이블의 "현재 보유액" 열 계산용
let cashTotalValue = 0;

let holdingsSortState = { key: null, dir: 'asc' };
let statusSortState = { key: null, dir: 'asc' };
let targetSortState = { key: null, dir: 'asc' };
let cachedHoldingRows = [];
let cachedStatus = { accountTotal: 0, rows: [] };

const CASH_DOT_COLOR = '#94a3b8';

export async function renderRebalance(container) {
  container.innerHTML = `<p class="text-slate-500">불러오는 중...</p>`;
  try {
    const accounts = await api.getAccounts();
    if (accounts.length === 0) {
      container.innerHTML = `<div class="card text-slate-500">먼저 보유종목 탭에서 계좌를 추가해주세요.</div>`;
      return;
    }
    if (!selectedAccountId || !accounts.some((a) => a.id === selectedAccountId)) {
      selectedAccountId = accounts[0].id;
      targetRows = [];
    }
    container.innerHTML = `
      <div class="card mb-4">
        <label class="block text-xs text-slate-500 mb-1">🏦 계좌</label>
        <select id="rebal-account-select" class="input">
          ${accounts
            .map((a) => `<option value="${a.id}" ${a.id === selectedAccountId ? 'selected' : ''}>${escapeHtml(a.name)}</option>`)
            .join('')}
        </select>
      </div>
      <div id="rebal-body"></div>
    `;
    container.querySelector('#rebal-account-select').addEventListener('change', (e) => {
      selectedAccountId = e.target.value;
      targetRows = [];
      renderBody(container);
    });
    await renderBody(container);
  } catch (err) {
    container.innerHTML = `<p class="text-red-600">불러오기 실패: ${err.message}</p>`;
  }
}

async function renderBody(container) {
  const body = container.querySelector('#rebal-body');
  body.innerHTML = `<p class="text-slate-500">불러오는 중...</p>`;
  try {
    const [cfg, status, backtestPortfolios, holdings, tickerMeta] = await Promise.all([
      api.getRebalanceConfig(selectedAccountId),
      api.getRebalanceStatus(selectedAccountId),
      api.getBacktestPortfolios(),
      api.getHoldings(selectedAccountId),
      api.getTickerMeta(),
    ]);
    tickerMetaCache = tickerMeta;

    if (targetRows.length === 0 && cfg.targets?.length) {
      targetRows = cfg.targets.map((t) => ({
        ticker: t.isCash ? null : t.ticker,
        isCash: !!t.isCash,
        targetWeight: Math.round(t.targetWeight * 1000) / 10,
      }));
    }

    // 리밸런싱 현황(괴리율)은 저장된 목표가 있어야만 표시되므로, 계좌 선택만으로도
    // 지금 뭘 들고 있는지 바로 볼 수 있도록 보유종목을 별도로 보여준다.
    const securities = holdings.filter((h) => !h.isCash && h.ticker && h.marketValueKrw);
    const securitiesTotal = securities.reduce((s, h) => s + h.marketValueKrw, 0);
    const holdingRows = securities.map((h) => ({
      ...h,
      weight: securitiesTotal > 0 ? h.marketValueKrw / securitiesTotal : null,
    }));

    // 목표 비중 테이블의 "현재 보유액" 열 — 종목은 티커별 평가금액, 현금은 계좌 현금성 자산 합계.
    holdingValueByTicker = new Map(securities.map((h) => [h.ticker, h.marketValueKrw]));
    cashTotalValue = holdings.filter((h) => h.isCash).reduce((s, h) => s + (h.marketValueKrw || 0), 0);

    cachedHoldingRows = holdingRows;

    body.innerHTML = `
      <div class="card mb-4">
        <div class="text-sm text-slate-500 mb-2">📦 현재 보유종목</div>
        <div id="rebal-holdings-section"></div>
      </div>

      <div class="card mb-4">
        <div class="text-sm text-slate-500 mb-1">🔬 백테스팅 포트폴리오에서 불러오기</div>
        <div class="flex gap-2 items-center mb-4">
          <select id="rebal-bt-select" class="input flex-1">
            <option value="">-- 포트폴리오 선택 --</option>
            ${backtestPortfolios.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
          </select>
          <button id="rebal-bt-load" type="button" class="btn btn-secondary btn-sm">불러오기</button>
        </div>
        <div class="text-xs text-slate-400 mb-4">불러온 후 각 비중을 자유롭게 수정할 수 있습니다.</div>

        <div class="flex justify-between items-center mb-2">
          <div class="text-sm text-slate-500">목표 비중</div>
          <div class="text-sm" id="rebal-sum">합계: <span id="rebal-sum-value">0</span>%</div>
        </div>
        <div id="rebal-target-table-wrap"></div>
        <div class="flex gap-2 mt-2">
          <button id="rebal-add-row" type="button" class="flex-1 btn btn-secondary">＋ 종목 추가</button>
          <button id="rebal-add-cash-row" type="button" class="flex-1 btn btn-secondary">＋ 현금 추가</button>
        </div>

        <div class="flex items-center gap-3 mt-4 px-4 py-3 rounded-full bg-slate-50 text-sm overflow-x-auto">
          <div class="grid flex-1 min-w-0" style="grid-template-columns: repeat(4, minmax(0, 1fr));">
            <div class="whitespace-nowrap text-slate-500">⚙️ 리밸런싱 기준</div>
            <div class="whitespace-nowrap">
              <span class="text-slate-300 mr-3">|</span><span class="text-slate-500">괴리율 임계값</span>
              <input id="rebal-threshold" type="number" step="any" value="${cfg.thresholdPct ?? 5}" class="border rounded-lg px-2 py-1 w-14 text-center mx-1" />
              <span class="text-slate-400">%</span>
            </div>
            <div class="whitespace-nowrap">
              <span class="text-slate-300 mr-3">|</span><span class="text-slate-500">주기</span>
              <select id="rebal-period" class="border rounded-full px-3 py-1 bg-white ml-1">
                ${['none', 'monthly', 'quarterly', 'semiannual', 'yearly']
                  .map((p) => `<option value="${p}" ${cfg.period === p ? 'selected' : ''}>${periodLabel(p)}</option>`)
                  .join('')}
              </select>
            </div>
            <div class="whitespace-nowrap">
              <span class="text-slate-300 mr-3">|</span><span class="text-slate-500">마지막 리밸런싱</span>
              <span class="font-medium ml-1">${cfg.lastRebalancedAt || '기록 없음'}</span>
            </div>
          </div>
          <button id="rebal-mark-done" type="button" class="shrink-0 ml-3 px-4 py-1.5 text-sm border rounded-full bg-white whitespace-nowrap">오늘로 기록</button>
        </div>

        <div class="flex gap-2 mt-4">
          <button id="rebal-save" type="button" class="flex-1 btn btn-primary">저장하기</button>
          ${
            cfg.targets?.length
              ? `<button id="rebal-clear" type="button" class="btn btn-danger">적용 해제</button>`
              : ''
          }
        </div>
      </div>

      <div class="card">
        <div class="text-sm text-slate-500 mb-2">⚖️ 리밸런싱 현황</div>
        <div id="rebal-status-section"></div>
        <div class="text-xs text-slate-400 mt-2">기준 총자산: ${formatCurrency(status.accountTotal)}</div>
      </div>
    `;
    cachedStatus = status;

    renderHoldingsSection(body);
    renderStatusSection(body);
    renderTargetRows(body);
    wireEvents(body, container, backtestPortfolios);
  } catch (err) {
    body.innerHTML = `<p class="text-red-600">불러오기 실패: ${err.message}</p>`;
  }
}

function periodLabel(p) {
  return { none: '없음', monthly: '매월', quarterly: '분기', semiannual: '반기', yearly: '매년' }[p];
}

function resolveName(ticker) {
  return tickerMetaCache[ticker]?.name || null;
}

function renderNameCell(row) {
  if (row.isCash) {
    return `
      <div class="flex items-center gap-2">
        <span class="inline-block w-2 h-2 rounded-full shrink-0" style="background:${CASH_DOT_COLOR}"></span>
        <div>
          <div class="font-medium text-sm">현금·예수금</div>
          <div class="text-xs text-slate-400">현금·예수금</div>
        </div>
      </div>
    `;
  }
  const name = resolveName(row.ticker);
  const color = DOT_COLORS[row.colorIdx % DOT_COLORS.length];
  return `
    <div class="flex items-center gap-2">
      <span class="inline-block w-2 h-2 rounded-full shrink-0 mt-0.5" style="background:${color}"></span>
      <div>
        <div class="font-medium text-sm">${name ? escapeHtml(name) : '(신규 종목)'}</div>
        <input data-idx="${row.idx}" data-field="ticker" value="${escapeHtml(row.ticker || '')}" placeholder="티커 입력 (예: 005930.KS)"
          class="border-0 border-b border-dashed border-slate-300 px-0 py-0.5 text-xs text-slate-400 w-36 focus:outline-none focus:border-blue-400" />
      </div>
    </div>
  `;
}

function currentValueFor(row) {
  const value = row.isCash ? cashTotalValue : holdingValueByTicker.get(row.ticker);
  return value != null ? formatCompactWon(value) : '0원';
}

const TARGET_COLUMN_ACCESSORS = {
  name: (row) => (row.isCash ? '현금·예수금' : resolveName(row.ticker) || row.ticker || ''),
  category: (row) => (row.isCash ? '현금' : '주식'),
  weight: (row) => Number(row.targetWeight) || 0,
  currentValue: (row) => (row.isCash ? cashTotalValue : (holdingValueByTicker.get(row.ticker) ?? null)),
};

function renderTargetRows(body) {
  const wrap = body.querySelector('#rebal-target-table-wrap');

  // 색상 점은 정렬 결과와 무관하게, 원래 추가된 순서를 기준으로 한 번만 배정해 정렬해도 안 바뀐다.
  let colorCounter = 0;
  const withMeta = targetRows.map((row, originalIdx) => ({
    row,
    originalIdx,
    colorIdx: row.isCash ? 0 : colorCounter++,
  }));

  const sorted = sortRows(withMeta, targetSortState, {
    name: (m) => TARGET_COLUMN_ACCESSORS.name(m.row),
    category: (m) => TARGET_COLUMN_ACCESSORS.category(m.row),
    weight: (m) => TARGET_COLUMN_ACCESSORS.weight(m.row),
    currentValue: (m) => TARGET_COLUMN_ACCESSORS.currentValue(m.row),
  });

  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>
        ${sortableTh('종목', 'name', targetSortState)}
        ${sortableTh('구분', 'category', targetSortState)}
        ${sortableTh('목표 비중', 'weight', targetSortState)}
        ${sortableTh('현재 보유액', 'currentValue', targetSortState)}
        <th></th>
      </tr></thead>
      <tbody>
        ${sorted
          .map(({ row, originalIdx, colorIdx }) => {
            const indexedRow = { ...row, idx: originalIdx, colorIdx };
            return `
          <tr>
            <td class="text-left">${renderNameCell(indexedRow)}</td>
            <td>${
              row.isCash
                ? `<span class="text-xs text-slate-400">현금</span>`
                : `<span class="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs">주식</span>`
            }</td>
            <td>
              <div class="flex items-center justify-center gap-1">
                <input data-idx="${originalIdx}" data-field="weight" type="number" step="any" value="${row.targetWeight}" class="border rounded-lg px-2 py-1 w-16 text-right" />
                <span class="text-slate-400 text-xs">%</span>
              </div>
            </td>
            <td class="text-xs text-slate-500">${currentValueFor(row)}</td>
            <td><button data-idx="${originalIdx}" class="rebal-remove-row w-6 h-6 rounded-full bg-slate-100 text-slate-400 text-xs hover:bg-slate-200">✕</button></td>
          </tr>
        `;
          })
          .join('')}
      </tbody>
    </table>
  `;
  updateSum(body);
  wireSortableHeaders(wrap, targetSortState, () => renderTargetRows(body));

  wrap.querySelectorAll('input[data-field="ticker"]').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      const idx = Number(e.target.dataset.idx);
      targetRows[idx].ticker = e.target.value.trim();
      const nameEl = e.target.closest('div').querySelector('.font-medium');
      if (nameEl) nameEl.textContent = resolveName(targetRows[idx].ticker) || '(신규 종목)';
    });
  });
  wrap.querySelectorAll('input[data-field="weight"]').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      targetRows[Number(e.target.dataset.idx)].targetWeight = Number(e.target.value);
      updateSum(body);
    });
  });
  wrap.querySelectorAll('.rebal-remove-row').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      targetRows.splice(Number(e.target.dataset.idx), 1);
      renderTargetRows(body);
    });
  });
}

function updateSum(body) {
  const sum = targetRows.reduce((s, r) => s + (Number(r.targetWeight) || 0), 0);
  const valueEl = body.querySelector('#rebal-sum-value');
  if (valueEl) valueEl.textContent = sum.toFixed(1);
  const wrap = body.querySelector('#rebal-sum');
  if (wrap) {
    const ok = Math.abs(sum - 100) <= 0.1;
    wrap.classList.toggle('text-red-500', !ok);
    wrap.classList.toggle('text-emerald-600', ok);
  }
}

const HOLDINGS_COLUMN_ACCESSORS = {
  name: (h) => h.name,
  quantity: (h) => h.quantity,
  price: (h) => h.currentPrice,
  value: (h) => h.marketValueKrw,
  weight: (h) => h.weight,
};

function renderHoldingsSection(body) {
  const section = body.querySelector('#rebal-holdings-section');
  if (!section) return;
  if (cachedHoldingRows.length === 0) {
    section.innerHTML = `<div class="text-slate-400 text-sm">이 계좌에 보유 종목이 없어요.</div>`;
    return;
  }
  const sorted = sortRows(cachedHoldingRows, holdingsSortState, HOLDINGS_COLUMN_ACCESSORS);
  section.innerHTML = `
    <table class="data-table">
      <thead><tr>
        ${sortableTh('종목명', 'name', holdingsSortState)}
        ${sortableTh('수량', 'quantity', holdingsSortState)}
        ${sortableTh('현재가', 'price', holdingsSortState)}
        ${sortableTh('평가금액', 'value', holdingsSortState)}
        ${sortableTh('비중', 'weight', holdingsSortState)}
      </tr></thead>
      <tbody>
        ${sorted
          .map(
            (h) => `
          <tr>
            <td class="text-left">${nameTickerCell(h.name, h.ticker)}</td>
            <td>${formatNumber(h.quantity, 4)}</td>
            <td>${formatCurrency(h.currentPrice, h.priceCurrency || 'KRW')}</td>
            <td>${formatCompactWon(h.marketValueKrw)}</td>
            <td>${formatPercent(h.weight)}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;
  wireSortableHeaders(section, holdingsSortState, () => renderHoldingsSection(body));
}

const STATUS_COLUMN_ACCESSORS = {
  name: (r) => r.name,
  target: (r) => r.targetWeight,
  current: (r) => r.currentWeight,
  deviation: (r) => r.deviation,
  targetValue: (r) => r.targetValue,
  currentValue: (r) => r.currentValue,
  action: (r) => r.action,
};

function renderStatusSection(body) {
  const section = body.querySelector('#rebal-status-section');
  if (!section) return;
  if (!cachedStatus.rows || cachedStatus.rows.length === 0) {
    section.innerHTML = `<div class="text-slate-400 text-sm">목표 비중을 저장하면 표시됩니다.</div>`;
    return;
  }
  const sorted = sortRows(cachedStatus.rows, statusSortState, STATUS_COLUMN_ACCESSORS);
  section.innerHTML = renderStatusTable(sorted);
  wireSortableHeaders(section, statusSortState, () => renderStatusSection(body));
}

function renderStatusTable(rows) {
  return `
    <table class="data-table">
      <thead><tr>
        ${sortableTh('종목', 'name', statusSortState)}
        ${sortableTh('목표', 'target', statusSortState)}
        ${sortableTh('현재', 'current', statusSortState)}
        ${sortableTh('괴리율', 'deviation', statusSortState)}
        ${sortableTh('목표금액', 'targetValue', statusSortState)}
        ${sortableTh('현재금액', 'currentValue', statusSortState)}
        ${sortableTh('필요 액션', 'action', statusSortState)}
      </tr></thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr class="${r.needsAction ? 'bg-amber-50' : ''}">
            <td class="text-left">${nameTickerCell(r.name, r.name !== r.ticker ? r.ticker : null)}</td>
            <td>${formatPercent(r.targetWeight)}</td>
            <td>${formatPercent(r.currentWeight)}</td>
            <td class="${r.deviation >= 0 ? 'text-red-600' : 'text-blue-600'}">${formatPercent(r.deviation)}</td>
            <td>${formatCurrency(r.targetValue)}</td>
            <td>${formatCurrency(r.currentValue)}</td>
            <td class="${r.action >= 0 ? 'text-red-600' : 'text-blue-600'}">${r.action >= 0 ? '매수' : '매도'} ${formatCurrency(Math.abs(r.action))}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function wireEvents(body, container, backtestPortfolios) {
  body.querySelector('#rebal-add-row').addEventListener('click', () => {
    targetRows.push({ ticker: '', targetWeight: 0, isCash: false });
    renderTargetRows(body);
  });

  body.querySelector('#rebal-add-cash-row').addEventListener('click', () => {
    if (targetRows.some((r) => r.isCash)) {
      alert('현금 항목은 이미 추가되어 있어요.');
      return;
    }
    targetRows.push({ ticker: null, targetWeight: 0, isCash: true });
    renderTargetRows(body);
  });

  body.querySelector('#rebal-bt-load').addEventListener('click', () => {
    const id = body.querySelector('#rebal-bt-select').value;
    const portfolio = backtestPortfolios.find((p) => p.id === id);
    if (!portfolio) return;
    targetRows = portfolio.allocations.map((a) => ({
      ticker: a.ticker,
      targetWeight: Math.round(a.weight * 1000) / 10,
      isCash: false,
    }));
    renderTargetRows(body);
  });

  body.querySelector('#rebal-mark-done').addEventListener('click', async () => {
    await api.markRebalanceDone(selectedAccountId);
    renderBody(container);
  });

  body.querySelector('#rebal-clear')?.addEventListener('click', async () => {
    if (!confirm('저장된 목표 비중 설정을 삭제할까요?')) return;
    await api.deleteRebalanceConfig(selectedAccountId);
    targetRows = [];
    renderBody(container);
  });

  body.querySelector('#rebal-save').addEventListener('click', async () => {
    const targets = targetRows
      .filter((r) => r.isCash || r.ticker)
      .map((r) =>
        r.isCash
          ? { isCash: true, targetWeight: Number(r.targetWeight) / 100 }
          : { ticker: r.ticker, targetWeight: Number(r.targetWeight) / 100 }
      );
    const sum = targets.reduce((s, t) => s + t.targetWeight, 0);
    if (targets.length === 0 || Math.abs(sum - 1) > 0.001) {
      alert('목표 비중의 합이 100%가 되어야 저장할 수 있어요.');
      return;
    }
    const thresholdPct = Number(body.querySelector('#rebal-threshold').value);
    const period = body.querySelector('#rebal-period').value;
    const sourceBacktestPortfolioId = body.querySelector('#rebal-bt-select').value || null;
    try {
      await api.saveRebalanceConfig(selectedAccountId, {
        targets,
        thresholdPct,
        period,
        sourceBacktestPortfolioId,
      });
      renderBody(container);
    } catch (err) {
      alert(err.message);
    }
  });
}
