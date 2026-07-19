import { Router } from 'express';
import * as store from '../data/cashAssetsStore.js';
import { asyncHandler } from './asyncHandler.js';

export const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await store.listCashAssets({ accountId: req.query.accountId }));
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { accountId, name, value } = req.body;
    if (!accountId || !name || value == null) {
      return res.status(400).json({ error: 'accountId, name, value는 필수입니다' });
    }
    res.status(201).json(await store.createCashAsset(req.body));
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const updated = await store.updateCashAsset(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: '현금 자산을 찾을 수 없습니다' });
    res.json(updated);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const ok = await store.deleteCashAsset(req.params.id);
    if (!ok) return res.status(404).json({ error: '현금 자산을 찾을 수 없습니다' });
    res.status(204).end();
  })
);
