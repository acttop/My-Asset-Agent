import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '..', 'data');
const backupsDir = path.join(dataDir, 'backups');

async function copyRecursive(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyRecursive(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetDir = path.join(backupsDir, timestamp);

  const entries = await fs.readdir(dataDir, { withFileTypes: true });
  await fs.mkdir(targetDir, { recursive: true });
  for (const entry of entries) {
    if (entry.name === 'backups') continue; // 백업 폴더 자체는 백업 대상에서 제외
    const srcPath = path.join(dataDir, entry.name);
    const destPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyRecursive(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }

  console.log(`백업 완료: ${targetDir}`);
}

main().catch((err) => {
  console.error('백업 실패:', err);
  process.exitCode = 1;
});
