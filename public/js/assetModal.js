import { api } from './api.js';
import { normalizeTicker } from './tickerInput.js';
import { escapeHtml } from './format.js';
import { wireThousandsInput, parseCommaNumber, formatForInput } from './numberInput.js';
import { wireOverlayDismiss } from './modalDismiss.js';
import { FUND_CODE_PATTERN, isFundTicker } from './fundTicker.js';

const ACCOUNT_PRESETS = ['ISA', 'IRP', '연금저축', 'DC'];
const ASSET_TABS = [
  ['주식', '📈 주식'],
  ['채권', '📜 채권'],
  ['펀드', '💰 펀드'],
  ['현금자산', '💵 현금 자산'],
];

let modalState = null;

// prefill: { assetType, ticker, name, accountId, accountName } — "추매"처럼 종목/계좌를 미리 채워서 열 때 사용.
export function openAssetModal({ onSaved, prefill } = {}) {
  const root = document.getElementById('modal-root');
  modalState = {
    assetType: prefill?.assetType || '주식',
    selectedTicker: prefill?.ticker ? { ticker: prefill.ticker, name: prefill.name } : null,
  };

  root.innerHTML = `
    <div class="modal-overlay" id="asset-modal-overlay">
      <div class="modal-card">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-bold">자산 추가</h2>
          <button id="asset-modal-close" class="text-slate-400 text-xl leading-none">&times;</button>
        </div>

        <div class="flex gap-2 mb-4">
          ${ASSET_TABS.map(([v, l]) => `<button type="button" data-type="${v}" class="asset-type-tab ${modalState.assetType === v ? 'active' : ''}">${l}</button>`).join('')}
        </div>

        <div id="asset-security-fields">
          <label class="block text-xs text-slate-500 mb-1">종목 검색</label>
          <div class="relative mb-1">
            <input id="asset-ticker-search" placeholder="종목명 또는 티커 검색..." class="input" autocomplete="off"
              value="${prefill?.name ? escapeHtml(`${prefill.name} (${prefill.ticker})`) : ''}" />
            <div id="asset-ticker-results" class="ticker-search-results hidden"></div>
          </div>
          <div id="asset-ticker-selected" class="text-xs mb-3 h-4"></div>

          <label class="block text-xs text-slate-500 mb-1" id="asset-quantity-label">수량</label>
          <input id="asset-quantity" type="text" inputmode="decimal" placeholder="0" class="input mb-3 text-right" />

          <label class="block text-xs text-slate-500 mb-1" id="asset-price-label">매수단가</label>
          <input id="asset-price" type="text" inputmode="decimal" placeholder="0" class="input mb-3 text-right" />
        </div>

        <div id="asset-cash-fields" class="hidden">
          <label class="block text-xs text-slate-500 mb-1">자산명</label>
          <input id="asset-cash-name" placeholder="예: 현금 잔고, ○○은행 정기예금" class="input mb-3" />

          <label class="block text-xs text-slate-500 mb-1">금액</label>
          <input id="asset-cash-value" type="text" inputmode="decimal" placeholder="0" class="input mb-3 text-right" />
        </div>

        <label class="block text-xs text-slate-500 mb-1" id="asset-date-label">매수일</label>
        <input id="asset-date" type="date" value="${new Date().toISOString().slice(0, 10)}" class="input mb-3" />

        <label class="block text-xs text-slate-500 mb-1">계좌</label>
        <div class="flex gap-2 mb-2">
          ${ACCOUNT_PRESETS.map((p) => `<button type="button" data-account="${p}" class="account-preset-btn">${p}</button>`).join('')}
        </div>
        <input id="asset-account-input" placeholder="직접 입력 (예: 토스계좌, 키움계좌)" class="input mb-1"
          value="${escapeHtml(prefill?.accountName || '')}" />
        <div class="text-xs text-slate-400 mb-3">💡 세제혜택 계좌는 위 버튼을, 일반계좌는 직접 입력하세요.</div>

        <label class="block text-xs text-slate-500 mb-1">메모 (선택)</label>
        <textarea id="asset-memo" class="input mb-4" rows="2"></textarea>

        <button id="asset-save" type="button" class="btn btn-primary btn-block">저장</button>
        <div id="asset-modal-error" class="text-xs text-red-500 mt-2"></div>
      </div>
    </div>
  `;

  wireModal(root, onSaved);
  wireThousandsInput(root.querySelector('#asset-quantity'));
  wireThousandsInput(root.querySelector('#asset-price'));
  wireThousandsInput(root.querySelector('#asset-cash-value'));
  applyAssetTypeVisibility(root);
  if (prefill?.ticker) prefillLivePrice(root, prefill.ticker);
}

function closeModal() {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
  modalState = null;
}

// 세 모달(자산/매도/현금수정)이 공유하는 닫기 배선.
function wireModalDismiss(root, overlayId, closeId) {
  wireOverlayDismiss(root, overlayId, closeId, closeModal);
}

function applyAssetTypeVisibility(root) {
  const isCash = modalState.assetType === '현금자산';
  const isFund = modalState.assetType === '펀드';
  root.querySelector('#asset-security-fields').classList.toggle('hidden', isCash);
  root.querySelector('#asset-cash-fields').classList.toggle('hidden', !isCash);
  root.querySelector('#asset-date-label').textContent = isCash ? '기준일' : '매수일';
  root.querySelector('#asset-quantity-label').textContent = isFund ? '좌수' : '수량';
  root.querySelector('#asset-price-label').textContent = isFund ? '기준가' : '매수단가';
}

function wireModal(root, onSaved) {
  wireModalDismiss(root, 'asset-modal-overlay', 'asset-modal-close');

  root.querySelectorAll('.asset-type-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      modalState.assetType = btn.dataset.type;
      root.querySelectorAll('.asset-type-tab').forEach((b) => b.classList.toggle('active', b === btn));
      applyAssetTypeVisibility(root);
    });
  });

  root.querySelectorAll('.account-preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.account-preset-btn').forEach((b) => b.classList.toggle('active', b === btn));
      root.querySelector('#asset-account-input').value = btn.dataset.account;
    });
  });
  root.querySelector('#asset-account-input').addEventListener('input', () => {
    root.querySelectorAll('.account-preset-btn').forEach((b) => b.classList.remove('active'));
  });

  wireTickerSearch(root);

  root.querySelector('#asset-save').addEventListener('click', () => save(root, onSaved));
}

async function prefillLivePrice(root, ticker) {
  const selectedEl = root.querySelector('#asset-ticker-selected');
  selectedEl.textContent = '시세 조회 중...';
  selectedEl.className = 'text-xs text-slate-400 mb-3 h-4';
  try {
    const quote = await api.getPrice(ticker);
    const priceInput = root.querySelector('#asset-price');
    priceInput.value = quote.price;
    priceInput.dispatchEvent(new Event('input')); // 콤마 서식 적용
    selectedEl.textContent = `✓ 현재가 ${new Intl.NumberFormat('ko-KR').format(quote.price)} ${quote.currency}`;
    selectedEl.className = 'text-xs text-emerald-600 mb-3 h-4';
  } catch {
    selectedEl.textContent = '시세를 불러오지 못했어요. 매수단가를 직접 입력해주세요.';
    selectedEl.className = 'text-xs text-amber-500 mb-3 h-4';
  }
}

function wireTickerSearch(root) {
  const input = root.querySelector('#asset-ticker-search');
  const resultsEl = root.querySelector('#asset-ticker-results');
  const selectedEl = root.querySelector('#asset-ticker-selected');
  let debounceTimer;

  input.addEventListener('input', () => {
    modalState.selectedTicker = null;
    selectedEl.textContent = '';
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (!q) {
      resultsEl.classList.add('hidden');
      return;
    }
    debounceTimer = setTimeout(async () => {
      const results = await api.searchTickers(q).catch(() => []);
      renderResults(results);
    }, 200);
  });

  input.addEventListener('blur', () => {
    setTimeout(() => resultsEl.classList.add('hidden'), 150); // 결과 클릭이 blur보다 먼저 처리되도록
  });
  input.addEventListener('focus', () => {
    if (resultsEl.children.length > 0) resultsEl.classList.remove('hidden');
  });

  function renderResults(results) {
    if (results.length === 0) {
      resultsEl.classList.add('hidden');
      resultsEl.innerHTML = '';
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
      item.addEventListener('mousedown', async (e) => {
        e.preventDefault(); // blur보다 먼저 실행되도록
        const ticker = item.dataset.ticker;
        const name = item.dataset.name;
        input.value = `${name} (${ticker})`;
        modalState.selectedTicker = { ticker, name };
        resultsEl.classList.add('hidden');
        await prefillLivePrice(root, ticker);
      });
    });
  }
}

async function save(root, onSaved) {
  const errorEl = root.querySelector('#asset-modal-error');
  errorEl.textContent = '';

  const accountName = root.querySelector('#asset-account-input').value.trim();
  const date = root.querySelector('#asset-date').value;
  if (!accountName) return void (errorEl.textContent = '계좌를 선택하거나 입력해주세요.');
  if (!date) return void (errorEl.textContent = '날짜를 입력해주세요.');

  try {
    const account = await api.createAccount({ name: accountName });

    if (modalState.assetType === '현금자산') {
      const name = root.querySelector('#asset-cash-name').value.trim();
      const value = parseCommaNumber(root.querySelector('#asset-cash-value').value);
      if (!name) return void (errorEl.textContent = '자산명을 입력해주세요.');
      if (!value || value <= 0) return void (errorEl.textContent = '금액을 입력해주세요.');
      await api.createCashAsset({
        accountId: account.id,
        name,
        value,
        memo: root.querySelector('#asset-memo').value.trim(),
      });
    } else {
      const quantity = parseCommaNumber(root.querySelector('#asset-quantity').value);
      const pricePerShare = parseCommaNumber(root.querySelector('#asset-price').value);
      let ticker = modalState.selectedTicker?.ticker;
      if (!ticker) {
        const raw = root.querySelector('#asset-ticker-search').value.trim();
        ticker = normalizeTicker(raw);
      }
      const isFund = modalState.assetType === '펀드';
      if (!ticker) return void (errorEl.textContent = '종목을 검색해서 선택하거나 티커를 입력해주세요.');
      if (!quantity || quantity <= 0) return void (errorEl.textContent = `${isFund ? '좌수' : '수량'}를 입력해주세요.`);
      if (!pricePerShare || pricePerShare <= 0) return void (errorEl.textContent = `${isFund ? '기준가' : '매수단가'}를 입력해주세요.`);

      if (!modalState.selectedTicker) {
        const isKr = /\.(KS|KQ)$/i.test(ticker) || FUND_CODE_PATTERN.test(ticker);
        await api.registerTicker(ticker, modalState.assetType, isKr ? 'KR' : 'US');
      }
      // 펀드 기준가는 관행상 "1,000좌당 가액"으로 고시되므로, 실제 금액은 좌수×기준가÷1000이다.
      const rawAmount = quantity * pricePerShare;
      await api.createEvent({
        type: 'buy',
        accountId: account.id,
        ticker,
        quantity,
        pricePerShare,
        amount: isFundTicker(ticker) ? rawAmount / 1000 : rawAmount,
        date,
        memo: root.querySelector('#asset-memo').value.trim(),
      });
    }

    closeModal();
    onSaved?.();
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

// "매도" 버튼용 — 특정 계좌/종목을 매도 이벤트로 기록하는 간단한 모달.
export function openSellModal({ accountId, accountName, ticker, name, onSaved }) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-overlay" id="sell-modal-overlay">
      <div class="modal-card">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-bold">매도 — ${escapeHtml(name)}</h2>
          <button id="sell-modal-close" class="text-slate-400 text-xl leading-none">&times;</button>
        </div>
        <div class="text-xs text-slate-400 mb-3">${escapeHtml(accountName)} · ${escapeHtml(ticker)}</div>

        <label class="block text-xs text-slate-500 mb-1">수량</label>
        <input id="sell-quantity" type="text" inputmode="decimal" placeholder="0" class="input mb-3 text-right" />

        <label class="block text-xs text-slate-500 mb-1">매도단가</label>
        <input id="sell-price" type="text" inputmode="decimal" placeholder="0" class="input mb-3 text-right" />

        <label class="block text-xs text-slate-500 mb-1">매도일</label>
        <input id="sell-date" type="date" value="${new Date().toISOString().slice(0, 10)}" class="input mb-4" />

        <button id="sell-save" type="button" class="btn btn-danger-solid btn-block">매도 기록</button>
        <div id="sell-modal-error" class="text-xs text-red-500 mt-2"></div>
      </div>
    </div>
  `;

  wireModalDismiss(root, 'sell-modal-overlay', 'sell-modal-close');
  wireThousandsInput(root.querySelector('#sell-quantity'));
  wireThousandsInput(root.querySelector('#sell-price'));

  api
    .getPrice(ticker)
    .then((q) => {
      const priceInput = root.querySelector('#sell-price');
      priceInput.value = q.price;
      priceInput.dispatchEvent(new Event('input')); // 콤마 서식 적용
    })
    .catch(() => {});

  root.querySelector('#sell-save').addEventListener('click', async () => {
    const errorEl = root.querySelector('#sell-modal-error');
    const quantity = parseCommaNumber(root.querySelector('#sell-quantity').value);
    const pricePerShare = parseCommaNumber(root.querySelector('#sell-price').value);
    const date = root.querySelector('#sell-date').value;
    if (!quantity || quantity <= 0) return void (errorEl.textContent = '수량을 입력해주세요.');
    if (!pricePerShare || pricePerShare <= 0) return void (errorEl.textContent = '매도단가를 입력해주세요.');
    if (!date) return void (errorEl.textContent = '날짜를 입력해주세요.');

    try {
      const rawAmount = quantity * pricePerShare;
      await api.createEvent({
        type: 'sell',
        accountId,
        ticker,
        quantity,
        pricePerShare,
        amount: isFundTicker(ticker) ? rawAmount / 1000 : rawAmount,
        date,
      });
      closeModal();
      onSaved?.();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

// "수정" 버튼용 — 현금 자산의 이름/금액을 고친다.
export function openCashEditModal({ cashAsset, onSaved }) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-overlay" id="cash-edit-overlay">
      <div class="modal-card">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-bold">현금 자산 수정</h2>
          <button id="cash-edit-close" class="text-slate-400 text-xl leading-none">&times;</button>
        </div>

        <label class="block text-xs text-slate-500 mb-1">자산명</label>
        <input id="cash-edit-name" value="${escapeHtml(cashAsset.name)}" class="input mb-3" />

        <label class="block text-xs text-slate-500 mb-1">금액</label>
        <input id="cash-edit-value" type="text" inputmode="decimal" value="${formatForInput(cashAsset.value)}" class="input mb-4 text-right" />

        <button id="cash-edit-save" type="button" class="btn btn-primary btn-block">저장</button>
        <div id="cash-edit-error" class="text-xs text-red-500 mt-2"></div>
      </div>
    </div>
  `;

  wireModalDismiss(root, 'cash-edit-overlay', 'cash-edit-close');
  wireThousandsInput(root.querySelector('#cash-edit-value'));

  root.querySelector('#cash-edit-save').addEventListener('click', async () => {
    const errorEl = root.querySelector('#cash-edit-error');
    const name = root.querySelector('#cash-edit-name').value.trim();
    const value = parseCommaNumber(root.querySelector('#cash-edit-value').value);
    if (!name) return void (errorEl.textContent = '자산명을 입력해주세요.');
    if (!value || value <= 0) return void (errorEl.textContent = '금액을 입력해주세요.');
    try {
      await api.updateCashAsset(cashAsset.id, { name, value });
      closeModal();
      onSaved?.();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}
