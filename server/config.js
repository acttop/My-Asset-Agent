import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

export const config = {
  port: process.env.PORT || 3000,
  rootDir,
  dataDir: path.join(rootDir, 'data'),
  publicDir: path.join(rootDir, 'public'),
  priceCacheDir: path.join(rootDir, 'data', 'price-cache'),
  backupsDir: path.join(rootDir, 'data', 'backups'),
  quoteTtlMs: 15 * 60 * 1000, // 15분
  historyTtlMs: 12 * 60 * 60 * 1000, // 12시간 (일봉은 자주 안 바뀜)
  priceRequestSpacingMs: 300,
};
