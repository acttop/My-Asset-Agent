import { api } from './api.js';
import { formatCurrency, formatNumber, escapeHtml } from './format.js';
import { normalizeTicker } from './tickerInput.js';
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

// 종목 검색창에 "종목명 (티커)"로 표시된 값에서 종목명만 뽑아낸다. 직접 타이핑만 한 경우엔 그 원문을 그대로 쓴다.
function getTickerDisplayName(form) {
  const raw = form.querySelector('#event-ticker-search').value.trim();
  const match = raw.match(/^(.*) \([^)]+\)$/);
  return match ? match[1] : raw;
}

// 매수/매도일 때 종목명·수량·매매단가로 메모를 자동으로 채운다 (예: "TIGER 200 · 15주 × ₩105,210").
function updateAutoMemo(form) {
  if (!QUANTITY_TYPES.has(form.type.value)) return;
  const name = getTickerDisplayName(form);
  const quantity = form.quantity.value;
  const price = parseCommaNumber(form.pricePerShare.value);
  if (!name || !quantity || !price) return;
  const currency = form.currency.value || 'KRW';
  form.memo.value = `${name} · ${formatNumber(Number(quantity), 4)}주 × ${formatCurrency(price, currency)}`;
}

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
        f.currency.value = ev.currency || '';
        f.querySelector('#event-ticker-search').value = ev.ticker
          ? `${tickerMeta[ev.ticker]?.name || ev.ticker} (${ev.ticker})`
          : '';
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

  // 종목 검색창 하나로 "계좌 보유종목 선택"과 "티커 직접 검색"을 겸한다.
  // 아무것도 입력하지 않은 상태로 포커스하면(또는 계좌를 바꾸면) 선택된 계좌의 보유종목을 목록으로 보여주고,
  // 무언가 입력하면 전체 티커 검색으로 전환한다. 고르면 "종목명 (티커)"로 표시되고 실제 값은 숨은 필드에 담긴다.
  function wireTickerSearch(form, holdings) {
    const input = form.querySelector('#event-ticker-search');
    const resultsEl = form.querySelector('#event-ticker-results');
    const statusEl = form.querySelector('#event-ticker-status');
    let debounceTimer;

    function accountHoldingResults() {
      return holdings
        .filter((h) => h.accountId === form.accountId.value && !h.isCash && h.ticker)
        .map((h) => ({ ticker: h.ticker, name: h.name, currency: h.priceCurrency || 'KRW' }));
    }

    function renderResults(results) {
      if (results.length === 0) {
        resultsEl.classList.add('hidden');
        resultsEl.innerHTML = '';
        return;
      }
      resultsEl.innerHTML = results
        .map(
          (r) => `
        <div class="ticker-search-item" data-ticker="${escapeHtml(r.ticker)}" data-name="${escapeHtml(r.name)}" data-currency="${escapeHtml(r.currency || '')}">
          <span>${escapeHtml(r.name)}</span>
          <span class="text-slate-400">${escapeHtml(r.ticker)}</span>
        </div>
      `
        )
        .join('');
      resultsEl.classList.remove('hidden');

      resultsEl.querySelectorAll('.ticker-search-item').forEach((item) => {
        item.addEventListener('mousedown', async (e) => {
          e.preventDefault(); // blur보다 먼저 실행되도록
          const ticker = item.dataset.ticker;
          const name = item.dataset.name;
          input.value = `${name} (${ticker})`;
          form.ticker.value = ticker;
          form.currency.value = item.dataset.currency || '';
          resultsEl.classList.add('hidden');
          updateAutoMemo(form);
          statusEl.textContent = '조회 중...';
          statusEl.className = 'text-xs text-slate-400';
          try {
            const quote = await api.getPrice(ticker);
            form.currency.value = quote.currency;
            statusEl.textContent = `✓ ${new Intl.NumberFormat('ko-KR').format(quote.price)} ${quote.currency}`;
            statusEl.className = 'text-xs text-emerald-600';
            updateAutoMemo(form);
          } catch {
            statusEl.textContent = '';
          }
        });
      });
    }

    input.addEventListener('focus', () => {
      if (!input.value.trim()) renderResults(accountHoldingResults());
    });

    input.addEventListener('input', () => {
      form.ticker.value = '';
      form.currency.value = '';
      statusEl.textContent = '';
      updateAutoMemo(form);
      clearTimeout(debounceTimer);
      const q = input.value.trim();
      if (!q) {
        renderResults(accountHoldingResults());
        return;
      }
      debounceTimer = setTimeout(async () => {
        const results = await api.searchTickers(q).catch(() => []);
        renderResults(results);
      }, 200);
    });

    input.addEventListener('blur', () => {
      setTimeout(() => resultsEl.classList.add('hidden'), 150);
    });

    form.accountId.addEventListener('change', () => {
      if (!input.value.trim()) renderResults(accountHoldingResults());
    });
  }

  function wireAddForm(c, holdings) {
    const form = c.querySelector('#event-form');

    if (form) {
      wireThousandsInput(form.querySelector('#event-amount'));
      wireThousandsInput(form.querySelector('#event-price'));
      wireTickerSearch(form, holdings);
      form.quantity.addEventListener('input', () => updateAutoMemo(form));
      form.pricePerShare.addEventListener('input', () => updateAutoMemo(form));
    }

    updateFieldVisibility(form);
    form?.type.addEventListener('change', () => {
      updateFieldVisibility(form);
      updateAutoMemo(form);
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const type = fd.get('type');
      // 검색 결과를 클릭해서 고르지 않고 직접 입력만 한 경우, 입력창의 원문을 티커로 취급한다.
      const ticker =
        fd.get('ticker')?.trim() || normalizeTicker(form.querySelector('#event-ticker-search').value.trim()) || null;
      const data = {
        type,
        accountId: fd.get('accountId'),
        ticker,
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
            `<button data-type="${t}" class="filter-btn btn btn-sm ${
              filters.type === t ? 'btn-primary' : 'btn-secondary'
            }">${t === '' ? '전체' : TYPE_LABELS[t]}</button>`
        )
        .join('')}
      <div class="flex items-center gap-1 ml-auto">
        <input id="event-search" placeholder="🔍 메모/티커 검색" value="${escapeHtml(filters.q)}" class="input w-40" />
        <button id="event-search-clear" class="icon-btn" title="검색어 지우기">✕</button>
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
        <select name="type" class="input">
          ${Object.entries(TYPE_LABELS)
            .map(([v, l]) => `<option value="${v}">${l}</option>`)
            .join('')}
        </select>
        <div class="text-xs h-4"></div>
      </div>
      <div class="flex-1 min-w-[100px]">
        <label class="block text-xs text-slate-500">계좌</label>
        <select name="accountId" class="input">
          ${accounts.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('')}
        </select>
        <div class="text-xs h-4"></div>
      </div>
      <div class="flex-1 min-w-[180px]">
        <label class="block text-xs text-slate-500">종목(선택)</label>
        <div class="relative">
          <input id="event-ticker-search" placeholder="종목명 또는 티커 검색..." class="input" autocomplete="off" />
          <div id="event-ticker-results" class="ticker-search-results hidden"></div>
        </div>
        <input type="hidden" name="ticker" id="event-ticker" />
        <input type="hidden" name="currency" id="event-currency" />
        <div id="event-ticker-status" class="text-xs h-4"></div>
      </div>
      <div id="field-amount" class="flex-1 min-w-[130px]">
        <label class="block text-xs text-slate-500">금액</label>
        <input name="amount" id="event-amount" type="text" inputmode="decimal" placeholder="0" class="input text-right" />
        <div class="text-xs h-4"></div>
      </div>
      <div id="field-quantity-price" class="hidden flex-1 min-w-[220px]">
        <div class="flex gap-2">
          <div class="flex-1">
            <label class="block text-xs text-slate-500">수량</label>
            <input name="quantity" type="number" step="any" class="input" />
            <div class="text-xs h-4"></div>
          </div>
          <div class="flex-1">
            <label class="block text-xs text-slate-500">단가</label>
            <input name="pricePerShare" id="event-price" type="text" inputmode="decimal" placeholder="0" class="input text-right" />
            <div class="text-xs h-4"></div>
          </div>
        </div>
      </div>
      <div class="flex-1 min-w-[130px]">
        <label class="block text-xs text-slate-500">일자</label>
        <input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" class="input" required />
        <div class="text-xs h-4"></div>
      </div>
      <div class="flex-1 min-w-[110px]">
        <label class="block text-xs text-slate-500">메모</label>
        <input name="memo" class="input" />
        <div class="text-xs h-4"></div>
      </div>
      <div class="shrink-0">
        <button class="btn btn-primary whitespace-nowrap">${editingId ? '수정 완료' : '＋ 추가'}</button>
        ${editingId ? `<button type="button" id="event-form-cancel" class="btn btn-ghost">취소</button>` : ''}
        <div class="text-xs h-4"></div>
      </div>
    </form>
  `;
}
