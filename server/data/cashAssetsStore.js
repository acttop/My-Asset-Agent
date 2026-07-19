import path from 'node:path';
import { config } from '../config.js';
import { createCollectionStore } from './collectionStore.js';

const store = createCollectionStore(path.join(config.dataDir, 'cash-assets.json'), { idPrefix: 'cash' });

export const listCashAssets = ({ accountId } = {}) =>
  store.list(accountId ? (c) => c.accountId === accountId : undefined);

export async function createCashAsset({ accountId, name, value, memo = '' }) {
  const now = new Date().toISOString();
  return store.insert({
    id: store.newId(),
    accountId,
    name,
    value: Number(value),
    memo,
    createdAt: now,
    updatedAt: now,
  });
}

export const updateCashAsset = (id, patch) => store.update(id, { ...patch, updatedAt: new Date().toISOString() });
export const deleteCashAsset = (id) => store.remove(id);
export const deleteCashAssetsByAccountId = (accountId) => store.removeWhere((c) => c.accountId === accountId);
