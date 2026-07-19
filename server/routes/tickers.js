import { Router } from 'express';
import { searchTickers, upsertTickerMeta, getTickerMeta } from '../data/tickerMetaStore.js';
import { asyncHandler } from './asyncHandler.js';

export const router = Router();

router.get(
  '/meta',
  asyncHandler(async (req, res) => {
    res.json(await getTickerMeta());
  })
);

router.get(
  '/search',
  asyncHandler(async (req, res) => {
    res.json(await searchTickers(req.query.q || ''));
  })
);

// 사전에 없는 티커를 사용자가 직접 입력했을 때, 선택한 자산 유형으로 최소 등록해둔다.
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { ticker, assetType, region } = req.body;
    if (!ticker) return res.status(400).json({ error: 'ticker는 필수입니다' });
    res.json(await upsertTickerMeta(ticker, { assetType, region }));
  })
);
