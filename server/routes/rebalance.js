import { Router } from 'express';
import * as store from '../data/rebalanceStore.js';
import { getAllValuedAssets } from '../services/valuation.js';
import { computeRebalanceStatus, validateTargetWeights } from '../services/rebalance.js';
import { asyncHandler } from './asyncHandler.js';

export const router = Router();

router.get(
  '/:accountId',
  asyncHandler(async (req, res) => {
    const cfg = await store.getConfig(req.params.accountId);
    res.json(cfg || { targets: [], thresholdPct: 5, period: 'none', lastRebalancedAt: null });
  })
);

router.put(
  '/:accountId',
  asyncHandler(async (req, res) => {
    const { targets, thresholdPct, period, sourceBacktestPortfolioId } = req.body;
    if (!Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ error: 'targets는 최소 1개 이상이어야 합니다' });
    }
    if (!validateTargetWeights(targets)) {
      return res.status(400).json({ error: '목표 비중의 합은 100%여야 합니다' });
    }
    const existing = await store.getConfig(req.params.accountId);
    const cfg = {
      targets,
      thresholdPct: thresholdPct != null ? Number(thresholdPct) : 5,
      period: period || 'none',
      lastRebalancedAt: existing?.lastRebalancedAt || null,
      sourceBacktestPortfolioId: sourceBacktestPortfolioId || null,
    };
    await store.setConfig(req.params.accountId, cfg);
    res.json(cfg);
  })
);

router.post(
  '/:accountId/mark-done',
  asyncHandler(async (req, res) => {
    const cfg = await store.getConfig(req.params.accountId);
    if (!cfg) return res.status(404).json({ error: '리밸런싱 설정이 없습니다' });
    cfg.lastRebalancedAt = new Date().toISOString().slice(0, 10);
    await store.setConfig(req.params.accountId, cfg);
    res.json(cfg);
  })
);

router.get(
  '/:accountId/status',
  asyncHandler(async (req, res) => {
    const cfg = await store.getConfig(req.params.accountId);
    if (!cfg || cfg.targets.length === 0) {
      return res.json({ accountTotal: 0, rows: [] });
    }
    const assets = await getAllValuedAssets({ accountId: req.params.accountId });
    res.json(computeRebalanceStatus(assets, cfg.targets, cfg.thresholdPct));
  })
);

router.delete(
  '/:accountId',
  asyncHandler(async (req, res) => {
    await store.deleteConfig(req.params.accountId);
    res.status(204).end();
  })
);
