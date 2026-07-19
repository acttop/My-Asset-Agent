import { Router } from 'express';
import { getAllValuedAssets } from '../services/valuation.js';
import { asyncHandler } from './asyncHandler.js';

export const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const assets = await getAllValuedAssets({ accountId: req.query.accountId });
    const total = assets.reduce((sum, h) => sum + (h.marketValueKrw || 0), 0);
    const withWeight = assets.map((h) => ({
      ...h,
      weight: total > 0 && h.marketValueKrw != null ? h.marketValueKrw / total : null,
    }));
    res.json(withWeight);
  })
);
