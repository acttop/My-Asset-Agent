import { Router } from 'express';
import { getMarketIndices } from '../services/marketIndices.js';
import { asyncHandler } from './asyncHandler.js';

export const router = Router();

router.get(
  '/indices',
  asyncHandler(async (req, res) => {
    res.json(await getMarketIndices());
  })
);
