import path from 'node:path';
import { Router } from 'express';
import { config } from '../config.js';
import { writeJson } from '../data/store.js';
import { asyncHandler } from './asyncHandler.js';

export const router = Router();

// 클라우드 인스턴스를 처음 띄울 때, 로컬 PC의 실데이터를 1회 이전하는 용도.
// 앱 상단의 basicAuth 미들웨어(AUTH_USER/AUTH_PASS 설정 시)로 이미 보호된다.
const FILES = {
  accounts: 'accounts.json',
  events: 'events.json',
  cashAssets: 'cash-assets.json',
  holdings: 'holdings.json',
  rebalanceConfig: 'rebalance-config.json',
  backtestPortfolios: 'backtest-portfolios.json',
  tickerMeta: 'ticker-meta.json',
};

router.post(
  '/import',
  asyncHandler(async (req, res) => {
    const { data } = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'data 필드가 필요합니다' });
    }
    const imported = [];
    for (const [key, filename] of Object.entries(FILES)) {
      if (data[key] !== undefined) {
        await writeJson(path.join(config.dataDir, filename), data[key]);
        imported.push(key);
      }
    }
    res.json({ ok: true, imported });
  })
);
