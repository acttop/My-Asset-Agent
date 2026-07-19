// Chart.js는 index.html에서 UMD 스크립트로 전역 `Chart`를 노출한다.
const activeCharts = new Map();

function destroy(canvasId) {
  activeCharts.get(canvasId)?.destroy();
}

export function renderLineChart(canvasId, { labels, datasets, yFormat = 'compact' }) {
  destroy(canvasId);
  const el = document.getElementById(canvasId);
  if (!el) return;
  const tickCallback =
    yFormat === 'percent'
      ? (v) => `${(v * 100).toFixed(0)}%`
      : yFormat === 'index'
        ? (v) => v.toFixed(0)
        : (v) => new Intl.NumberFormat('ko-KR', { notation: 'compact' }).format(v);
  const chart = new Chart(el, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: {
        y: { ticks: { callback: tickCallback } },
      },
    },
  });
  activeCharts.set(canvasId, chart);
  return chart;
}

const PALETTE = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#64748b'];

export function renderDoughnutChart(canvasId, { labels, data }) {
  destroy(canvasId);
  const el = document.getElementById(canvasId);
  if (!el) return;
  const chart = new Chart(el, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]) }],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'right' } },
    },
  });
  activeCharts.set(canvasId, chart);
  return chart;
}

export function renderBarChart(canvasId, { labels, datasets, yFormat = 'percent' }) {
  destroy(canvasId);
  const el = document.getElementById(canvasId);
  if (!el) return;
  const tickCallback =
    yFormat === 'percent'
      ? (v) => `${(v * 100).toFixed(0)}%`
      : (v) => new Intl.NumberFormat('ko-KR', { notation: 'compact' }).format(v);
  const chart = new Chart(el, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { display: datasets.length > 1 } },
      scales: {
        y: { ticks: { callback: tickCallback } },
      },
    },
  });
  activeCharts.set(canvasId, chart);
  return chart;
}
