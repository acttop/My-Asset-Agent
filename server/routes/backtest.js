import { Router } from 'express';
import * as store from '../data/backtestStore.js';
import { runBacktest } from '../services/backtest.js';
import { asyncHandler } from './asyncHandler.js';

export const router = Router();

router.get(
  '/portfolios',
  asyncHandler(async (req, res) => {
    res.json(await store.listPortfolios());
  })
);

router.post(
  '/portfolios',
  asyncHandler(async (req, res) => {
    const { name, allocations } = req.body;
    if (!name || !Array.isArray(allocations) || allocations.length === 0) {
      return res.status(400).json({ error: 'name과 allocations는 필수입니다' });
    }
    const sum = allocations.reduce((s, a) => s + a.weight, 0);
    if (Math.abs(sum - 1) > 0.001) {
      return res.status(400).json({ error: '배분 비중의 합은 100%여야 합니다' });
    }
    res.status(201).json(await store.createPortfolio({ name, allocations }));
  })
);

router.put(
  '/portfolios/:id',
  asyncHandler(async (req, res) => {
    const { name, allocations } = req.body;
    if (!name || !Array.isArray(allocations) || allocations.length === 0) {
      return res.status(400).json({ error: 'name과 allocations는 필수입니다' });
    }
    const sum = allocations.reduce((s, a) => s + a.weight, 0);
    if (Math.abs(sum - 1) > 0.001) {
      return res.status(400).json({ error: '배분 비중의 합은 100%여야 합니다' });
    }
    const updated = await store.updatePortfolio(req.params.id, { name, allocations });
    if (!updated) return res.status(404).json({ error: '포트폴리오를 찾을 수 없습니다' });
    res.json(updated);
  })
);

router.delete(
  '/portfolios/:id',
  asyncHandler(async (req, res) => {
    const ok = await store.deletePortfolio(req.params.id);
    if (!ok) return res.status(404).json({ error: '포트폴리오를 찾을 수 없습니다' });
    res.status(204).end();
  })
);

router.post(
  '/run',
  asyncHandler(async (req, res) => {
    const {
      allocations,
      startDate,
      endDate,
      rebalancePeriod,
      initialAmount,
      monthlyContribution,
      yearlyContribution,
      reinvestDividends,
    } = req.body;
    if (!Array.isArray(allocations) || allocations.length === 0 || !startDate || !endDate) {
      return res.status(400).json({ error: 'allocations, startDate, endDate는 필수입니다' });
    }
    const result = await runBacktest({
      allocations,
      startDate,
      endDate,
      rebalancePeriod: rebalancePeriod || 'quarterly',
      initialAmount: initialAmount != null ? Number(initialAmount) : 10000000,
      monthlyContribution: monthlyContribution != null ? Number(monthlyContribution) : 0,
      yearlyContribution: yearlyContribution != null ? Number(yearlyContribution) : 0,
      reinvestDividends: reinvestDividends !== false,
    });
    res.json(result);
  })
);
