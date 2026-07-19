import { renderDashboard } from './dashboard.js';
import { renderHoldings } from './holdings.js';
import { renderEvents } from './events.js';
import { renderDividends } from './dividends.js';
import { renderRebalance } from './rebalance.js';
import { renderBacktest } from './backtest.js';
import { renderGuide } from './guide.js';

const views = {
  dashboard: { el: document.getElementById('view-dashboard'), render: renderDashboard },
  holdings: { el: document.getElementById('view-holdings'), render: renderHoldings },
  events: { el: document.getElementById('view-events'), render: renderEvents },
  dividends: { el: document.getElementById('view-dividends'), render: renderDividends },
  rebalance: { el: document.getElementById('view-rebalance'), render: renderRebalance },
  backtest: { el: document.getElementById('view-backtest'), render: renderBacktest },
  guide: { el: document.getElementById('view-guide'), render: renderGuide },
};

function showTab(name) {
  for (const [key, view] of Object.entries(views)) {
    view.el.classList.toggle('hidden', key !== name);
  }
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
  views[name].render(views[name].el);
}

document.getElementById('tab-nav').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (btn) showTab(btn.dataset.tab);
});

showTab('dashboard');
