import { escapeHtml } from './format.js';

// 대시보드/보유종목 화면에서 동일하게 쓰이는 계좌 필터 탭 UI.
export function renderAccountTabs(accounts, selectedAccountId) {
  return `
    <div class="flex gap-2 flex-wrap">
      <button data-account-id="" class="account-filter-tab px-3 py-1.5 text-sm rounded-full ${
        selectedAccountId == null ? 'bg-blue-600 text-white' : 'bg-white border'
      }">전체</button>
      ${accounts
        .map(
          (a) =>
            `<button data-account-id="${a.id}" class="account-filter-tab px-3 py-1.5 text-sm rounded-full ${
              selectedAccountId === a.id ? 'bg-blue-600 text-white' : 'bg-white border'
            }">${escapeHtml(a.name)}</button>`
        )
        .join('')}
    </div>
  `;
}

export function bindAccountTabs(container, onSelect) {
  container.querySelectorAll('.account-filter-tab').forEach((btn) => {
    btn.addEventListener('click', () => onSelect(btn.dataset.accountId || null));
  });
}
