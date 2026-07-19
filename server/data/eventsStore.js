import path from 'node:path';
import { config } from '../config.js';
import { createCollectionStore } from './collectionStore.js';

const store = createCollectionStore(path.join(config.dataDir, 'events.json'), { idPrefix: 'evt' });
const VALID_TYPES = ['buy', 'sell', 'deposit', 'withdraw', 'dividend'];

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

export const listEvents = () => store.list();

export async function createEvent(input) {
  if (!VALID_TYPES.includes(input.type)) {
    throw badRequest(`잘못된 이벤트 유형: ${input.type}`);
  }
  if (!input.accountId) throw badRequest('accountId는 필수입니다');
  if (!input.date) throw badRequest('date는 필수입니다');
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw badRequest('amount는 0 이상의 숫자여야 합니다');
  }

  const now = new Date().toISOString();
  return store.insert({
    id: store.newId(),
    type: input.type,
    accountId: input.accountId,
    ticker: input.ticker || null,
    quantity: input.quantity != null ? Number(input.quantity) : null,
    pricePerShare: input.pricePerShare != null ? Number(input.pricePerShare) : null,
    amount,
    currency: input.currency || 'KRW',
    fee: input.fee != null ? Number(input.fee) : 0,
    date: input.date,
    memo: input.memo || '',
    source: input.source || 'manual',
    createdAt: now,
    updatedAt: now,
  });
}

export const updateEvent = (id, patch) => store.update(id, { ...patch, updatedAt: new Date().toISOString() });
export const deleteEvent = (id) => store.remove(id);
export const deleteEventsByAccountId = (accountId) => store.removeWhere((e) => e.accountId === accountId);
