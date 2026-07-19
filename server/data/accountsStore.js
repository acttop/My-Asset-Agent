import path from 'node:path';
import { config } from '../config.js';
import { createCollectionStore } from './collectionStore.js';

const store = createCollectionStore(path.join(config.dataDir, 'accounts.json'), { idPrefix: 'acc' });

export const listAccounts = () => store.list();

export async function createAccount(input) {
  return store.insert({
    id: store.newId(),
    name: input.name,
    broker: input.broker || '',
    type: input.type || '',
    currency: input.currency || 'KRW',
    createdAt: new Date().toISOString(),
  });
}

// 이름이 같은(공백 제거·대소문자 무시) 계좌가 있으면 재사용하고, 없으면 새로 만든다.
export async function findOrCreateAccount(name, extra = {}) {
  const trimmed = name.trim();
  const accounts = await listAccounts();
  const existing = accounts.find((a) => a.name.trim().toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing;
  return createAccount({ name: trimmed, ...extra });
}

export const updateAccount = (id, patch) => store.update(id, patch);
export const deleteAccount = (id) => store.remove(id);
