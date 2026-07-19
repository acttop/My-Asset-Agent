import { Router } from 'express';
import { getQuote, getHistory } from '../data/priceCacheStore.js';
import * as priceProviders from '../priceProviders/index.js';
import { asyncHandler } from './asyncHandler.js';

export const router = Router();

router.get(
  '/:ticker/history',
  asyncHandler(async (req, res) => {
    const result = await getHistory(req.params.ticker, {
      range: req.query.range,
      force: req.query.force === 'true',
    });
    res.json(result);
  })
);

// 시간별(분봉) 시세 — 장중 변동 확인용이라 캐시하지 않고 매번 새로 조회한다.
router.get(
  '/:ticker/intraday',
  asyncHandler(async (req, res) => {
    const history = await priceProviders.getIntradayHistory(req.params.ticker);
    res.json({ history });
  })
);

router.get(
  '/:ticker',
  asyncHandler(async (req, res) => {
    const quote = await getQuote(req.params.ticker, { force: req.query.force === 'true' });
    res.json(quote);
  })
);
