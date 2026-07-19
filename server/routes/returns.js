import { Router } from 'express';
import { listEvents } from '../data/eventsStore.js';
import { listAccounts } from '../data/accountsStore.js';
import { listHoldings } from '../data/holdingsCache.js';
import { valueHoldings } from '../services/valuation.js';
import { computeGrowthSeries, computeMonthlyReturns } from '../services/growth.js';
import { computeNetContributions, computeCumulativeReturn } from '../services/returns.js';
import { asyncHandler } from './asyncHandler.js';

export const router = Router();

router.get(
  '/cumulative',
  asyncHandler(async (req, res) => {
    const events = await listEvents();
    const series = await computeGrowthSeries(events, {
      accountId: req.query.accountId,
      granularity: req.query.granularity,
    });
    const cumulative = series.map((p) => ({
      date: p.date,
      returnRate: p.contributions > 0 ? (p.value - p.contributions) / p.contributions : null,
    }));
    res.json(cumulative);
  })
);

router.get(
  '/monthly',
  asyncHandler(async (req, res) => {
    const events = await listEvents();
    const series = await computeGrowthSeries(events, { accountId: req.query.accountId });
    res.json(computeMonthlyReturns(series));
  })
);

router.get(
  '/by-account',
  asyncHandler(async (req, res) => {
    const [accounts, events] = await Promise.all([listAccounts(), listEvents()]);
    const results = [];
    for (const account of accounts) {
      const accountEvents = events.filter((e) => e.accountId === account.id);
      const holdings = await listHoldings({ accountId: account.id });
      const valued = await valueHoldings(holdings);
      const totalValue = valued.reduce((sum, h) => sum + (h.marketValueKrw || 0), 0);
      const netContributions = computeNetContributions(accountEvents);
      const { returnRate } = computeCumulativeReturn(totalValue, netContributions);
      results.push({ accountId: account.id, accountName: account.name, returnRate });
    }
    res.json(results);
  })
);
