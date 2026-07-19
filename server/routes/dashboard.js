import { Router } from 'express';
import { getAllValuedAssets } from '../services/valuation.js';
import { listEvents } from '../data/eventsStore.js';
import {
  computeNetContributions,
  computeCumulativeReturn,
  computeXIRR,
  buildCashflowsFromEvents,
} from '../services/returns.js';
import { computeGrowthSeries } from '../services/growth.js';
import { computeAllocation } from '../services/allocation.js';
import { listAccounts } from '../data/accountsStore.js';
import { asyncHandler } from './asyncHandler.js';

export const router = Router();

router.get(
  '/allocation',
  asyncHandler(async (req, res) => {
    const by = ['account', 'type', 'ticker'].includes(req.query.by) ? req.query.by : 'account';
    const [assets, accounts] = await Promise.all([
      getAllValuedAssets({ accountId: req.query.accountId }),
      listAccounts(),
    ]);
    res.json(await computeAllocation(assets, accounts, by));
  })
);

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const { accountId } = req.query;
    const [assets, allEvents] = await Promise.all([getAllValuedAssets({ accountId }), listEvents()]);
    const events = accountId ? allEvents.filter((e) => e.accountId === accountId) : allEvents;
    const totalAssets = assets.reduce((sum, h) => sum + (h.marketValueKrw || 0), 0);
    const netContributions = computeNetContributions(events);
    const { profit, returnRate } = computeCumulativeReturn(totalAssets, netContributions);
    const cashflows = buildCashflowsFromEvents(events, totalAssets);
    const annualizedReturnRate = computeXIRR(cashflows);
    res.json({
      totalAssets,
      netContributions,
      cumulativeProfit: profit,
      cumulativeReturnRate: returnRate,
      annualizedReturnRate,
      holdingsCount: assets.length,
    });
  })
);

router.get(
  '/growth',
  asyncHandler(async (req, res) => {
    const events = await listEvents();
    const series = await computeGrowthSeries(events, { accountId: req.query.accountId });
    res.json(series);
  })
);
