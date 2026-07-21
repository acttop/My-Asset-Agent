import { api } from './api.js';
import {
  formatCurrency,
  formatCompactWon,
  formatPercent,
  formatNumber,
  escapeHtml,
  signClass,
  formatSignedCompactWon,
  formatSignedPercent,
} from './format.js';
import { openAssetModal, openSellModal, openCashEditModal } from './assetModal.js';
import { setSearchFilter } from './events.js';
import { openPriceChartModal } from './priceChartModal.js';
import { renderAccountTabs, bindAccountTabs } from './accountTabs.js';
import { sortRows, sortableTh, wireSortableHeaders } from './sortableTable.js';

let selectedAccountId = null;
let sortState = { key: null, dir: 'asc' };
let cachedHoldings = [];
let cachedAccounts = [];
let cachedSummary = null;

export async function renderHoldings(container) {
  container.innerHTML = `<p class="text-slate-500">불러오는 중...</p>`;
  try {
    const accounts = await api.getAccounts();
    if (!accounts.some((a) => a.id === selectedAccountId)) selectedAccountId = null;

    container.innerHTML = `
      <div class="mb-4 flex justify-between items-center flex-wrap gap-2">
        ${renderAccountTabs(accounts, selectedAccountId)}
        <button id="open-asset-modal" class="btn btn-primary">＋ 자산 추가</button>
      </div>
      <div id="holdings-body"></div>
    `;

    bindAccountTabs(container, (accountId) => {
      selectedAccountId = accountId;
      renderHoldings(container);
    });
    container.querySelector('#open-asset-modal').addEventListener('click', () => {
      openAssetModal({ onSaved: () => renderHoldings(container) });
    });

    await renderBody(container, accounts);
  } catch (err) {
    container.innerHTML = `<p class="text-red-600">불러오기 실패: ${err.message}</p>`;
  }
}

async function renderBody(container, accounts) {
  const body = container.querySelector('#holdings-body');
  body.innerHTML = `<p class="text-slate-500">불러오는 중...</p>`;
  try {
    const [holdings, summary] = await Promise.all([
      api.getHoldings(selectedAccountId),
      api.getDashboardSummary(selectedAccountId),
    ]);
    cachedHoldings = holdings;
    cachedAccounts = accounts;
    cachedSummary = summary;
    renderBodyContent(body, container);
  } catch (err) {
    body.innerHTML = `<p class="text-red-600">불러오기 실패: ${err.message}</p>`;
  }
}

// 정렬 상태만 바뀌었을 때는 재조회 없이 캐시된 데이터로 다시 그린다.
function renderBodyContent(body, container) {
  const sorted = sortRows(cachedHoldings, sortState, getColumnAccessors(cachedAccounts));
  body.innerHTML =
    renderSummary(cachedSummary, cachedAccounts) +
    (cachedHoldings.length === 0 ? renderEmpty(cachedAccounts) : renderTable(sorted, cachedAccounts));
  wireRowActions(body, cachedAccounts, container);
  wireEmptyActions(body, container);
  wireSortableHeaders(body, sortState, () => renderBodyContent(body, container));
}

function getColumnAccessors(accounts) {
  const accountName = (id) => accounts.find((a) => a.id === id)?.name || id;
  return {
    name: (h) => h.name,
    account: (h) => accountName(h.accountId),
    quantity: (h) => (h.isCash ? null : h.quantity),
    price: (h) => h.currentPrice,
    value: (h) => h.marketValueKrw,
    profit: (h) => computeProfit(h).profitKrw,
    returnRate: (h) => computeProfit(h).returnRate,
    weight: (h) => h.weight,
  };
}

// 계좌 필터에 따라 "전체" 보기에서는 전체 종목 합산, 계좌 선택 시에는 그 계좌만의 금액/수익률을 보여준다.
function renderSummary(summary, accounts) {
  const account = selectedAccountId ? accounts.find((a) => a.id === selectedAccountId) : null;
  return `
    <div class="card mb-4 flex items-center gap-8">
      <div>
        <div class="text-xs text-slate-500">${account ? escapeHtml(account.name) : '전체'} 현재 금액</div>
        <div class="text-2xl font-bold">${formatCurrency(summary.totalAssets)}</div>
      </div>
      <div>
        <div class="text-xs text-slate-500">누적수익률</div>
        <div class="text-2xl font-bold ${signClass(summary.cumulativeReturnRate)}">${formatPercent(summary.cumulativeReturnRate)}</div>
      </div>
    </div>
  `;
}

function renderEmpty(accounts) {
  // "전체" 보기에서는 특정 계좌를 특정할 수 없어 삭제 버튼을 보여주지 않는다.
  const account = selectedAccountId ? accounts.find((a) => a.id === selectedAccountId) : null;
  return `
    <div class="card mt-4 text-center text-slate-500">
      📭 보유 종목이 없어요. 위 버튼으로 첫 종목을 추가해보세요.
      ${
        account
          ? `<div class="mt-3"><button id="delete-empty-account" class="btn btn-danger btn-sm">🗑️ '${escapeHtml(account.name)}' 계좌 삭제</button></div>`
          : ''
      }
    </div>
  `;
}

function renderTable(holdings, accounts) {
  const accountName = (id) => accounts.find((a) => a.id === id)?.name || id;
  return `
    <table class="data-table card">
      <thead>
        <tr>
          ${sortableTh('종목명', 'name', sortState)}
          ${sortableTh('계좌', 'account', sortState)}
          ${sortableTh('수량', 'quantity', sortState)}
          ${sortableTh('현재가', 'price', sortState)}
          ${sortableTh('평가금액', 'value', sortState)}
          ${sortableTh('평가손익', 'profit', sortState)}
          ${sortableTh('수익률', 'returnRate', sortState)}
          ${sortableTh('비중', 'weight', sortState)}
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${holdings
          .map((h) => {
            const priceCell = h.isCash
              ? '<span class="text-slate-400">현금 잔고</span>'
              : h.currentPrice != null
                ? new Intl.NumberFormat('ko-KR', { style: 'currency', currency: h.priceCurrency, maximumFractionDigits: 0 }).format(h.currentPrice)
                : '-';
            const { profitKrw, returnRate } = computeProfit(h);
            const safeName = escapeHtml(h.name);
            return `
          <tr data-id="${h.id}" data-name="${escapeHtml(h.name)}">
            <td class="text-left">
              <div>
                ${h.ticker ? `<button data-action="chart" class="text-left hover:underline">${safeName}</button>` : safeName}
                ${h.priceStale ? ' <span class="text-amber-500 text-xs">(지연)</span>' : ''}
              </div>
              ${h.ticker ? `<div class="text-xs text-slate-400">${escapeHtml(h.ticker)}</div>` : ''}
            </td>
            <td class="text-left"><span class="inline-block px-2 py-0.5 rounded-full bg-rose-50 text-rose-500 text-xs">${escapeHtml(accountName(h.accountId))}</span></td>
            <td>${h.isCash ? '-' : formatNumber(h.quantity, 4)}</td>
            <td>${priceCell}</td>
            <td>${h.marketValueKrw != null ? formatCompactWon(h.marketValueKrw) : '-'}</td>
            <td class="${signClass(profitKrw)}">${formatSignedCompactWon(profitKrw)}</td>
            <td class="${signClass(returnRate)}">${formatSignedPercent(returnRate)}</td>
            <td>${formatPercent(h.weight)}</td>
            <td class="whitespace-nowrap">
              ${
                h.isCash
                  ? `<button data-action="edit-cash" class="text-amber-500 text-xs mr-2" title="수정">✏️</button><button data-action="delete-cash" class="text-red-500 text-xs" title="삭제">🗑️</button>`
                  : `<button data-action="buy" class="text-red-500 text-xs mr-2" title="추가 매수">추매</button><button data-action="sell" class="text-blue-500 text-xs mr-2" title="매도 기록">매도</button><button data-action="edit-security" class="text-amber-500 text-xs mr-2" title="이벤트 이력에서 수정">✏️</button><button data-action="delete-security" class="text-red-500 text-xs" title="이벤트 이력에서 삭제">🗑️</button>`
              }
            </td>
          </tr>
        `;
          })
          .join('')}
      </tbody>
    </table>
  `;
}

function wireEmptyActions(body, container) {
  body.querySelector('#delete-empty-account')?.addEventListener('click', async () => {
    if (!confirm('이 계좌를 삭제할까요? 계좌의 입출금·거래 이력도 함께 삭제되며 되돌릴 수 없어요.')) return;
    try {
      await api.deleteAccount(selectedAccountId);
      selectedAccountId = null;
      renderHoldings(container);
    } catch (err) {
      alert('계좌를 삭제하지 못했어요: ' + err.message);
    }
  });
}

function wireRowActions(body, accounts, container) {
  body.querySelectorAll('tr[data-id]').forEach((row) => {
    const id = row.dataset.id;
    const btn = (action) => row.querySelector(`[data-action="${action}"]`);

    const name = row.dataset.name;

    btn('chart')?.addEventListener('click', () => {
      const ticker = id.split('|')[1];
      openPriceChartModal({ ticker, name });
    });

    btn('buy')?.addEventListener('click', () => {
      const [accountId, ticker] = id.split('|');
      const accountName = accounts.find((a) => a.id === accountId)?.name || accountId;
      openAssetModal({
        onSaved: () => renderHoldings(container),
        prefill: { assetType: '주식', ticker, name, accountId, accountName },
      });
    });

    btn('sell')?.addEventListener('click', () => {
      const [accountId, ticker] = id.split('|');
      const accountName = accounts.find((a) => a.id === accountId)?.name || accountId;
      openSellModal({
        accountId,
        accountName,
        ticker,
        name,
        onSaved: () => renderHoldings(container),
      });
    });

    // 보유종목은 여러 매수 이벤트가 합쳐진 값이라 이 화면에서 직접 고칠 수 없어,
    // 이벤트 이력 탭으로 이동해 개별 매수/매도 기록을 관리하도록 안내한다.
    btn('edit-security')?.addEventListener('click', () => goToEventsFiltered(id.split('|')[1]));
    btn('delete-security')?.addEventListener('click', () => goToEventsFiltered(id.split('|')[1]));

    btn('edit-cash')?.addEventListener('click', async () => {
      const cashAssets = await api.getCashAssets();
      const cashAsset = cashAssets.find((c) => c.id === id);
      if (cashAsset) openCashEditModal({ cashAsset, onSaved: () => renderHoldings(container) });
    });

    btn('delete-cash')?.addEventListener('click', async () => {
      if (!confirm('이 현금 자산을 삭제할까요?')) return;
      await api.deleteCashAsset(id);
      renderHoldings(container);
    });
  });
}

function goToEventsFiltered(ticker) {
  setSearchFilter(ticker);
  document.querySelector('[data-tab="events"]').click();
}

// 현재가 기준 평가손익/수익률을 계산한다. 매입원가·평가금액이 같은 통화(h.fxRate)로 환산되므로
// 원화 손익은 (평가금액-원가) * 환율, 수익률은 통화와 무관하게 (평가금액-원가)/원가로 구한다.
function computeProfit(h) {
  if (h.isCash || h.marketValueNative == null || h.totalCost == null) {
    return { profitKrw: null, returnRate: null };
  }
  const profitNative = h.marketValueNative - h.totalCost;
  const returnRate = h.totalCost > 0 ? profitNative / h.totalCost : null;
  return { profitKrw: profitNative * h.fxRate, returnRate };
}

