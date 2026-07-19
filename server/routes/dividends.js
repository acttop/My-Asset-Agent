import { Router } from 'express';
import { listEvents } from '../data/eventsStore.js';
import { listHoldings } from '../data/holdingsCache.js';
import { valueHoldings } from '../services/valuation.js';
import {
  computeCumulativeDividends,
  computeThisYearDividends,
  computeDividendPerShare,
  computeDividendYield,
  computeYoC,
  estimateAnnualDividend,
} from '../services/dividends.js';
import { asyncHandler } from './asyncHandler.js';

export const router = Router();

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const { accountId } = req.query;
    const allEvents = await listEvents();
    const events = accountId ? allEvents.filter((e) => e.accountId === accountId) : allEvents;
    const holdings = await listHoldings({ accountId });
    const valued = await valueHoldings(holdings);

    const cumulativeDividends = computeCumulativeDividends(events);
    const thisYearDividends = computeThisYearDividends(events);
    const projectedAnnualDividend = estimateAnnualDividend(events);

    let yieldNumerator = 0;
    let yocNumerator = 0;
    let totalValue = 0;
    let totalCost = 0;

    const byTicker = valued.map((h) => {
      const dps = computeDividendPerShare(events, h.ticker, h.quantity);
      const dividendYield = computeDividendYield(dps, h.currentPrice);
      const yoc = computeYoC(dps, h.avgCostPerShare);
      if (h.marketValueKrw) {
        yieldNumerator += (dividendYield || 0) * h.marketValueKrw;
        totalValue += h.marketValueKrw;
      }
      if (h.totalCost) {
        yocNumerator += (yoc || 0) * h.totalCost;
        totalCost += h.totalCost;
      }
      return { ticker: h.ticker, name: h.name, dividendPerShare: dps, dividendYield, yoc };
    });

    res.json({
      cumulativeDividends,
      thisYearDividends,
      projectedAnnualDividend,
      dividendYield: totalValue > 0 ? yieldNumerator / totalValue : null,
      yoc: totalCost > 0 ? yocNumerator / totalCost : null,
      byTicker,
    });
  })
);

router.get(
  '/monthly',
  asyncHandler(async (req, res) => {
    const { accountId } = req.query;
    const allEvents = await listEvents();
    const events = accountId ? allEvents.filter((e) => e.accountId === accountId) : allEvents;
    const year = Number(req.query.year) || new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, actual: 0 }));
    events
      .filter((e) => e.type === 'dividend' && e.date.startsWith(String(year)))
      .forEach((e) => {
        const m = Number(e.date.slice(5, 7));
        months[m - 1].actual += e.amount;
      });
    res.json({ year, months });
  })
);
