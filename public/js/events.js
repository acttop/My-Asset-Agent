import { api } from './api.js';
import { formatCurrency, formatNumber, escapeHtml } from './format.js';
import { wireTickerValidation } from './tickerInput.js';
import { sortRows, sortableTh, wireSortableHeaders } from './sortableTable.js';
import { wireThousandsInput, parseCommaNumber } from './numberInput.js';

const TYPE_LABELS = {
  deposit: '💳 입금',
  withdraw: '↩️ 출금',
  dividend: '💵 배당',
  buy: '📈 매수',
  sell: '📉 매도',
};

const TYPE_PILL_CLASS = {
  deposit: 'pill-deposit',
  withdraw: 'pill-withdraw',
  dividend: 'pill-dividend',
  buy: 'pill-buy',
  sell: 'pill-sell',
};

// 유출(-)/유입(+) 방향: 매수·출금은 돈이 나가고, 매도·입금·배당은 돈이 들어온다.
const OUTFLOW_TYPES = new Set(['buy', 'withdraw']);

// 매수/매도는 수량×단가로, 나머지는 총액으로 입력받는다.
const QUANTITY_TYPES = new Set(['buy', 'sell']);

const filters = { type: '', q: '' };
let editingId = null;
let sortState = { key: null, dir: 'asc' };

// 다른 탭(보유종목 등)에서 특정 티커로 필터링된 상태로 이 탭을 열 때 사용.
export function setSearchFilter(q) {
  filters.type = '';
  filters.q = q;
}

export async function renderEvents(container) {
  container.innerHTML = `<p class="text-slate-500">불러오는 중...</p>`;
  try {
    const query = {};
    if (filters.type) query.type = filters.type;
    if (filters.q) query.q = filters.q;
    const [accounts, events, tickerMeta, holdings] = await Promise.all([
      api.getAccounts(),
      api.getEvents(query),
      api.getTickerMeta(),
      api.getHoldings(),
    ]);
    container.innerHTML = `
      ${renderAddForm(accounts)}
      ${renderFilters()}
      <div id="events-table-section"></div>
    `;
    renderTableSection(container, events, accounts, tickerMeta);
    wireFilters(container);
    wireAddForm(container, holdings);
  } catch (err) {
    container.innerHTML = `<p class="text-red-600">불러오기 실패: ${err.message}</p>`;
  }

  function renderTableSection(c, events, accounts, tickerMeta) {
    const section = c.querySelector('#events-table-section');
    const sorted = sortRows(events, sortState, getColumnAccessors(accounts, tickerMeta));
    section.innerHTML = events.length === 0 ? renderEmpty() : renderTable(sorted, accounts, tickerMeta);
    wireSortableHeaders(section, sortState, () => renderTableSection(c, events, accounts, tickerMeta));

    section.querySelectorAll('.edit-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ev = events.find((x) => x.id === btn.dataset.id);
        if (!ev) return;
        editingId = ev.id;
        await renderEvents(container); // 수정 모드로 다시 그림 (버튼 라벨이 "수정 완료"로 바뀜)
        const f = container.querySelector('#event-form');
        if (!f) return;
        f.type.value = ev.type;
        f.accountId.value = ev.accountId;
        f.ticker.value = ev.ticker || '';
        refreshTickerPills(f, ev.accountId, holdings);
        f.amount.value = ev.amount;
        f.amount.dispatchEvent(new Event('input')); // 콤마 서식 재적용
        f.quantity.value = ev.quantity ?? '';
        f.pricePerShare.value = ev.pricePerShare ?? '';
        f.pricePerShare.dispatchEvent(new Event('input'));
        f.date.value = ev.date;
        f.memo.value = ev.memo || '';
        updateFieldVisibility(f);
        f.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

    section.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api.deleteEvent(btn.dataset.id);
        renderEvents(container);
      });
    });
  }

  function wireFilters(c) {
    c.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        filters.type = btn.dataset.type;
        renderEvents(container);
      });
    });
    const searchInput = c.querySelector('#event-search');
    let debounceTimer;
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        filters.q = e.target.value.trim();
        renderEvents(container);
      }, 300);
    });
    c.querySelector('#event-search-clear')?.addEventListener('click', () => {
      filters.q = '';
      renderEvents(container);
    });
  }

  // 선택된 계좌가 보유 중인 종목을 드롭다운으로 골라 티커 입력을 채울 수 있게 한다.
  function refreshTickerPills(form, accountId, holdings) {
    const selectEl = form.querySelector('#event-ticker-select');
    if (!selectEl) return;
    const accountHoldings = holdings.filter((h) => h.accountId === accountId && !h.isCash && h.ticker);
    selectEl.innerHTML =
      `<option value="">${accountHoldings.length ? '— 보유종목에서 선택 —' : '이 계좌의 보유종목이 없어요'}</option>` +
      accountHoldings
        .map(
          (h) =>
            `<option value="${escapeHtml(h.ticker)}" data-currency="${escapeHtml(h.priceCurrency || 'KRW')}">${escapeHtml(h.name)}</option>`
        )
        .join('');
    selectEl.onchange = () => {
      const opt = selectEl.selectedOptions[0];
      if (!opt?.value) return;
      form.ticker.value = opt.value;
      form.currency.value = opt.dataset.currency || '';
      form.ticker.dispatchEvent(new Event('blur'));
      selectEl.value = ''; // 다시 선택할 수 있도록 안내 옵션으로 리셋
    };
  }

  function wireAddForm(c, holdings) {
    const form = c.querySelector('#event-form');
    const tickerInput = c.querySelector('#event-ticker');
    const tickerStatus = c.querySelector('#event-ticker-status');
    if (tickerInput && tickerStatus) wireTickerValidation(tickerInput, tickerStatus);

    if (form) {
      wireThousandsInput(form.querySelector('#event-amount'));
      wireThousandsInput(form.querySelector('#event-price'));
    }

    updateFieldVisibility(form);
    form?.type.addEventListener('change', () => updateFieldVisibility(form));

    if (form) {
      refreshTickerPills(form, form.accountId.value, holdings);
      form.accountId.addEventListener('change', () => refreshTickerPills(form, form.accountId.value, holdings));
    }

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const type = fd.get('type');
      const data = {
        type,
        accountId: fd.get('accountId'),
        ticker: fd.get('ticker')?.trim() || null,
        currency: fd.get('currency') || undefined,
        date: fd.get('date'),
        memo: fd.get('memo'),
      };
      if (QUANTITY_TYPES.has(type)) {
        const quantity = Number(fd.get('quantity'));
        const pricePerShare = parseCommaNumber(fd.get('pricePerShare'));
        data.quantity = quantity;
        data.pricePerShare = pricePerShare;
        data.amount = quantity * pricePerShare;
      } else {
        data.amount = parseCommaNumber(fd.get('amount'));
      }
      if (editingId) {
        await api.updateEvent(editingId, data);
        editingId = null;
      } else {
        await api.createEvent(data);
        // 검색/유형 필터가 남아있으면 방금 추가한 이벤트가 목록에 안 보여 "안 됐나?" 싶을 수 있어 초기화한다.
        filters.q = '';
        filters.type = '';
      }
      renderEvents(container);
    });

    c.querySelector('#event-form-cancel')?.addEventListener('click', () => {
      editingId = null;
      renderEvents(container);
    });
  }
}

function updateFieldVisibility(form) {
  const isQuantityType = QUANTITY_TYPES.has(form.type.value);
  form.querySelector('#field-amount').classList.toggle('hidden', isQuantityType);
  form.querySelector('#field-quantity-price').classList.toggle('hidden', !isQuantityType);
  form.querySelector('#field-amount input').required = !isQuantityType;
  form.querySelectorAll('#field-quantity-price input').forEach((el) => (el.required = isQuantityType));
}

function renderFilters() {
  const types = ['', 'deposit', 'withdraw', 'dividend', 'buy', 'sell'];
  return `
    <div class="flex flex-wrap gap-2 mb-3 items-center">
      ${types
        .map(
          (t) =>
            `<button data-type="${t}" class="filter-btn px-2 py-1 text-sm rounded border ${
              filters.type === t ? 'bg-blue-600 text-white' : 'bg-white'
            }">${t === '' ? '전체' : TYPE_LABELS[t]}</button>`
        )
        .join('')}
      <div class="flex items-center gap-1 ml-auto">
        <input id="event-search" placeholder="🔍 메모/티커 검색" value="${escapeHtml(filters.q)}" class="border rounded px-2 py-1 text-sm w-40" />
        <button id="event-search-clear" class="text-slate-400 text-sm px-1" title="검색어 지우기">✕</button>
      </div>
    </div>
  `;
}

function renderEmpty() {
  return `<div class="card text-center text-slate-500">💸 이벤트가 없어요.</div>`;
}

function renderMemoCell(e, tickerMeta) {
  if ((e.type === 'buy' || e.type === 'sell') && e.ticker) {
    const name = escapeHtml(tickerMeta[e.ticker]?.name || e.ticker);
    const qty = formatNumber(e.quantity, 4);
    const price = e.pricePerShare != null ? formatCurrency(e.pricePerShare, e.currency) : '-';
    return `${name} <span class="text-slate-400">· ${qty}주 × ${price}</span>`;
  }
  return escapeHtml(e.memo || e.ticker) || '-';
}

function renderAmountCell(e) {
  const outflow = OUTFLOW_TYPES.has(e.type);
  const sign = outflow ? '-' : '+';
  const cls = outflow ? 'text-red-500' : 'text-blue-500';
  return `<span class="${cls}">${sign}${formatCurrency(e.amount, e.currency)}</span>`;
}

function getColumnAccessors(accounts, tickerMeta) {
  const accountName = (id) => accounts.find((a) => a.id === id)?.name || id;
  return {
    type: (e) => TYPE_LABELS[e.type] || e.type,
    memo: (e) => tickerMeta[e.ticker]?.name || e.memo || e.ticker || '',
    account: (e) => accountName(e.accountId),
    amount: (e) => e.amount,
    date: (e) => e.date,
  };
}

function renderTable(events, accounts, tickerMeta) {
  const accountName = (id) => accounts.find((a) => a.id === id)?.name || id;
  return `
    <table class="data-table card">
      <thead><tr>
        ${sortableTh('종류', 'type', sortState)}
        ${sortableTh('메모/출처', 'memo', sortState)}
        ${sortableTh('계좌', 'account', sortState)}
        ${sortableTh('금액', 'amount', sortState)}
        ${sortableTh('일자', 'date', sortState)}
        <th></th>
      </tr></thead>
      <tbody>
        ${events
          .map(
            (e) => `
          <tr>
            <td class="text-left"><span class="pill ${TYPE_PILL_CLASS[e.type] || ''}">${TYPE_LABELS[e.type] || e.type}</span></td>
            <td class="text-left">${renderMemoCell(e, tickerMeta)}</td>
            <td class="text-left"><span class="pill pill-account">${escapeHtml(accountName(e.accountId))}</span></td>
            <td>${renderAmountCell(e)}</td>
            <td>${e.date}</td>
            <td class="whitespace-nowrap">
              <button data-id="${e.id}" class="edit-btn icon-btn" title="수정">✏️</button>
              <button data-id="${e.id}" class="delete-btn icon-btn" title="삭제">🗑️</button>
            </td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function renderAddForm(accounts) {
  if (accounts.length === 0) {
    return `<div class="card mb-4 text-slate-500">먼저 보유종목 탭에서 계좌를 추가해주세요.</div>`;
  }
  return `
    <form id="event-form" class="card flex flex-wrap gap-3 items-end mb-4">
      <div class="flex-1 min-w-[100px]">
        <label class="block text-xs text-slate-500">종류</label>
        <select name="type" class="border rounded px-2 py-1 w-full">
          ${Object.entries(TYPE_LABELS)
            .map(([v, l]) => `<option value="${v}">${l}</option>`)
            .join('')}
        </select>
        <div class="text-xs h-4"></div>
      </div>
      <div class="flex-1 min-w-[100px]">
        <label class="block text-xs text-slate-500">계좌</label>
        <select name="accountId" class="border rounded px-2 py-1 w-full">
          ${accounts.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('')}
        </select>
        <div class="text-xs h-4"></div>
      </div>
      <div class="flex-1 min-w-[160px]">
        <label class="block text-xs text-slate-500">티커(선택)</label>
        <select id="event-ticker-select" class="border rounded px-2 py-1 w-full mb-1 text-sm"></select>
        <input name="ticker" id="event-ticker" placeholder="티커 직접 입력" class="border rounded px-2 py-1 w-full" />
        <input type="hidden" name="currency" id="event-currency" />
        <div id="event-ticker-status" class="text-xs h-4"></div>
      </div>
      <div id="field-amount" class="flex-1 min-w-[130px]">
        <label class="block text-xs text-slate-500">금액</label>
        <input name="amount" id="event-amount" type="text" inputmode="decimal" placeholder="0" class="border rounded px-2 py-1 w-full text-right" />
        <div class="text-xs h-4"></div>
      </div>
      <div id="field-quantity-price" class="hidden flex-1 min-w-[220px]">
        <div class="flex gap-2">
          <div class="flex-1">
            <label class="block text-xs text-slate-500">수량</label>
            <input name="quantity" type="number" step="any" class="border rounded px-2 py-1 w-full" />
            <div class="text-xs h-4"></div>
          </div>
          <div class="flex-1">
            <label class="block text-xs text-slate-500">단가</label>
            <input name="pricePerShare" id="event-price" type="text" inputmode="decimal" placeholder="0" class="border rounded px-2 py-1 w-full text-right" />
            <div class="text-xs h-4"></div>
          </div>
        </div>
      </div>
      <div class="flex-1 min-w-[130px]">
        <label class="block text-xs text-slate-500">일자</label>
        <input name="date" type="date" class="border rounded px-2 py-1 w-full" required />
        <div class="text-xs h-4"></div>
      </div>
      <div class="flex-1 min-w-[110px]">
        <label class="block text-xs text-slate-500">메모</label>
        <input name="memo" class="border rounded px-2 py-1 w-full" />
        <div class="text-xs h-4"></div>
      </div>
      <div class="shrink-0">
        <button class="bg-blue-600 text-white px-3 py-1.5 rounded whitespace-nowrap">${editingId ? '수정 완료' : '＋ 추가'}</button>
        ${editingId ? `<button type="button" id="event-form-cancel" class="text-slate-400 text-sm px-2">취소</button>` : ''}
        <div class="text-xs h-4"></div>
      </div>
    </form>
  `;
}
