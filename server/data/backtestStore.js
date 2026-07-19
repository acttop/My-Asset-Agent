import path from 'node:path';
import { config } from '../config.js';
import { createCollectionStore } from './collectionStore.js';

const store = createCollectionStore(path.join(config.dataDir, 'backtest-portfolios.json'), { idPrefix: 'bt' });

export const listPortfolios = () => store.list();

export async function createPortfolio({ name, allocations }) {
  return store.insert({
    id: store.newId(),
    name,
    allocations,
    createdAt: new Date().toISOString(),
  });
}

export const updatePortfolio = (id, { name, allocations }) =>
  store.update(id, { name, allocations, updatedAt: new Date().toISOString() });
export const deletePortfolio = (id) => store.remove(id);
