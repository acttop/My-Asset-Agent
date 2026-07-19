import express from 'express';
import { config } from './config.js';
import { basicAuth } from './basicAuth.js';
import { router as accountsRouter } from './routes/accounts.js';
import { router as eventsRouter } from './routes/events.js';
import { router as holdingsRouter } from './routes/holdings.js';
import { router as pricesRouter } from './routes/prices.js';
import { router as dashboardRouter } from './routes/dashboard.js';
import { router as returnsRouter } from './routes/returns.js';
import { router as dividendsRouter } from './routes/dividends.js';
import { router as rebalanceRouter } from './routes/rebalance.js';
import { router as backtestRouter } from './routes/backtest.js';
import { router as tickersRouter } from './routes/tickers.js';
import { router as cashAssetsRouter } from './routes/cashAssets.js';
import { router as marketRouter } from './routes/market.js';
import { router as backupRouter } from './routes/backup.js';

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' })); // ticker-meta.json 등 데이터 이전(import) 시 기본 100kb로는 부족
  app.use(basicAuth);
  app.use(express.static(config.publicDir));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/accounts', accountsRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/holdings', holdingsRouter);
  app.use('/api/prices', pricesRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/returns', returnsRouter);
  app.use('/api/dividends', dividendsRouter);
  app.use('/api/rebalance', rebalanceRouter);
  app.use('/api/backtest', backtestRouter);
  app.use('/api/tickers', tickersRouter);
  app.use('/api/cash-assets', cashAssetsRouter);
  app.use('/api/market', marketRouter);
  app.use('/api/backup', backupRouter);

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  });

  return app;
}
