import { Router } from 'express';
import * as store from '../data/eventsStore.js';
import { asyncHandler } from './asyncHandler.js';

export const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    let events = await store.listEvents();
    const { type, accountId, q, from, to } = req.query;
    if (type) events = events.filter((e) => e.type === type);
    if (accountId) events = events.filter((e) => e.accountId === accountId);
    if (from) events = events.filter((e) => e.date >= from);
    if (to) events = events.filter((e) => e.date <= to);
    if (q) {
      const needle = q.toLowerCase();
      events = events.filter(
        (e) => (e.memo || '').toLowerCase().includes(needle) || (e.ticker || '').toLowerCase().includes(needle)
      );
    }
    events.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    res.json(events);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    res.status(201).json(await store.createEvent(req.body));
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const updated = await store.updateEvent(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: '이벤트를 찾을 수 없습니다' });
    res.json(updated);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const ok = await store.deleteEvent(req.params.id);
    if (!ok) return res.status(404).json({ error: '이벤트를 찾을 수 없습니다' });
    res.status(204).end();
  })
);
