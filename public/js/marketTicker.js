import { api } from './api.js';

const DECIMALS = {
  코스피: 0,
  나스닥100: 0,
  'S&P500': 0,
  SCHD: 2,
  BTC: 0,
  달러: 0,
};

const SYMBOL = {
  SCHD: '$',
  BTC: '$',
  달러: '₩',
};

export async function renderMarketTicker(container) {
  container.innerHTML = `<div class="text-xs text-slate-400 px-1 py-2">시세 불러오는 중...</div>`;
  try {
    const items = await api.getMarketIndices();
    container.innerHTML = `
      <div class="flex items-center text-sm px-6 py-2.5 overflow-x-auto">
        <div class="grid flex-1 min-w-0" style="grid-template-columns: repeat(${items.length}, minmax(0, 1fr));">
          ${items.map(renderItem).join('')}
        </div>
        <span class="ml-4 text-xs text-slate-300 shrink-0">15분 지연</span>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="flex items-center justify-between px-1 py-2">
        <span class="text-xs text-red-500">시세를 불러오지 못했어요: ${err.message}</span>
        <button id="market-ticker-retry" class="text-xs text-blue-600 underline">다시 시도</button>
      </div>
    `;
    container.querySelector('#market-ticker-retry')?.addEventListener('click', () => renderMarketTicker(container));
  }
}

// 각 지표를 grid의 한 칸으로 렌더링한다 — 6칸이 화면 폭에 맞춰 고르게 퍼지고,
// 첫 칸을 제외하고 앞에 "|" 구분선을 붙여 기존 한 줄 티커 느낌을 유지한다.
function renderItem(item, index) {
  const separator = index > 0 ? '<span class="text-slate-200 mr-4">|</span>' : '';

  if (item.error || item.price == null) {
    return `<div class="whitespace-nowrap">${separator}<span class="text-slate-400">${item.label} -</span></div>`;
  }
  const digits = DECIMALS[item.label] ?? 2;
  const symbol = SYMBOL[item.label] || '';
  const priceText = `${symbol}${formatNumber(item.price, digits)}`;

  const up = (item.change ?? 0) >= 0;
  const cls = up ? 'text-red-500' : 'text-blue-500';
  const arrow = up ? '▲' : '▼';
  const changeText =
    item.change != null
      ? `${arrow}${formatNumber(Math.abs(item.change), digits)} (${(Math.abs(item.changePercent) * 100).toFixed(2)}%)`
      : '';

  return `<div class="whitespace-nowrap">${separator}<span class="text-slate-500">${item.label}</span> <span class="font-medium">${priceText}</span> <span class="${cls}">${changeText}</span></div>`;
}

function formatNumber(value, digits) {
  return new Intl.NumberFormat('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}
