import path from 'node:path';
import { config } from '../config.js';
import { readJson, writeJson } from './store.js';

const filePath = path.join(config.dataDir, 'rebalance-config.json');

export async function getAllConfigs() {
  return readJson(filePath, {});
}

export async function getConfig(accountId) {
  const all = await getAllConfigs();
  return all[accountId] || null;
}

export async function setConfig(accountId, cfg) {
  const all = await getAllConfigs();
  all[accountId] = cfg;
  await writeJson(filePath, all);
  return cfg;
}

export async function deleteConfig(accountId) {
  const all = await getAllConfigs();
  delete all[accountId];
  await writeJson(filePath, all);
}
