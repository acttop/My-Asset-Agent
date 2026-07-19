import { api } from './api.js';
import { renderLineChart } from './charts.js';
import { escapeHtml } from './format.js';
import { wireOverlayDismiss } from './modalDismiss.js';
import { isFundTicker } from './fundTicker.js';

let currentView = 'daily';

// externalLink: { url, label } — 있으면 모달 안에 "OO에서 더 보기" 외부 링크를 함께 보여준다.
export function openPriceChartModal({ ticker, name, externalLink }) {
  const root = document.getElementById('modal-root');
  currentView = 'daily';
  // 펀드는 하루 한 번 기준가만 발표되므로 분봉(시간별) 탭을 보여주지 않는다.
  const isFund = isFundTicker(ticker);
  root.innerHTML = `
    <div class="modal-overlay" id="price-chart-overlay">
      <div class="modal-card" style="max-width: 40rem;">
        <div class="flex justify-between items-center mb-3">
          <div>
            <h2 class="text-lg font-bold">${escapeHtml(name)}</h2>
            <div class="text-xs text-slate-400">${escapeHtml(ticker)}</div>
          </div>
          <button id="price-chart-close" class="text-slate-400 text-xl leading-none">&times;</button>
        </div>
        ${
          externalLink
            ? `<a href="${externalLink.url}" target="_blank" rel="noopener noreferrer" class="text-xs text-blue-600 underline inline-block mb-3">${escapeHtml(externalLink.label)}에서 더 보기 ↗</a>`
            : ''
        }
        <div class="flex gap-2 mb-3">
          ${
            isFund
              ? `<span class="px-3 py-1.5 text-sm rounded border bg-slate-50 text-slate-500">일자별 기준가</span>`
              : `<button data-view="daily" class="price-view-tab px-3 py-1.5 text-sm rounded border bg-blue-600 text-white">일자별</button>
          <button data-view="intraday" class="price-view-tab px-3 py-1.5 text-sm rounded border bg-white">시간별</button>`
          }
        </div>
        <div id="price-chart-body"><p class="text-slate-500">불러오는 중...</p></div>
      </div>
    </div>
  `;

  wireOverlayDismiss(root, 'price-chart-overlay', 'price-chart-close', closeModal);
  root.querySelectorAll('.price-view-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentView = btn.dataset.view;
      root.querySelectorAll('.price-view-tab').forEach((b) => {
        b.classList.toggle('bg-blue-600', b === btn);
        b.classList.toggle('text-white', b === btn);
        b.classList.toggle('bg-white', b !== btn);
      });
      loadChart(ticker);
    });
  });

  loadChart(ticker);
}

function closeModal() {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
}

async function loadChart(ticker) {
  const bodyEl = document.getElementById('price-chart-body');
  if (!bodyEl) return;
  bodyEl.innerHTML = `<p class="text-slate-500">불러오는 중...</p>`;
  try {
    if (currentView === 'daily') {
      const { history } = await api.getPriceHistory(ticker, '6mo');
      if (history.length === 0) {
        bodyEl.innerHTML = `<p class="text-slate-400">일자별 시세 데이터가 없어요.</p>`;
        return;
      }
      bodyEl.innerHTML = `<canvas id="price-chart-canvas" height="120"></canvas>`;
      renderLineChart('price-chart-canvas', {
        labels: history.map((p) => p.date),
        datasets: [
          {
            label: isFundTicker(ticker) ? '기준가' : '종가',
            data: history.map((p) => p.close),
            borderColor: '#2563eb',
            pointRadius: 0,
            tension: 0.2,
          },
        ],
      });
    } else {
      const { history } = await api.getIntradayHistory(ticker);
      if (history.length === 0) {
        bodyEl.innerHTML = `<p class="text-slate-400">시간별 시세 데이터가 없어요.</p>`;
        return;
      }
      bodyEl.innerHTML = `<canvas id="price-chart-canvas" height="120"></canvas>`;
      renderLineChart('price-chart-canvas', {
        labels: history.map((p) => formatTimeLabel(p.time)),
        datasets: [{ label: '체결가', data: history.map((p) => p.close), borderColor: '#f59e0b', pointRadius: 0, tension: 0.2 }],
      });
    }
  } catch (err) {
    bodyEl.innerHTML = `<p class="text-red-600">시세를 불러오지 못했어요: ${err.message}</p>`;
  }
}

function formatTimeLabel(iso) {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}
