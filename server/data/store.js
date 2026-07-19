import fs from 'node:fs/promises';
import path from 'node:path';

// 파일 경로별 write 직렬화 큐 (동시 write로 인한 race 방지)
const queues = new Map();

function enqueue(filePath, task) {
  const prev = queues.get(filePath) || Promise.resolve();
  const next = prev.then(task, task);
  queues.set(filePath, next);
  // next가 reject되면(쓰기 실패) 호출자는 자신의 try/catch로 정상적으로 잡지만,
  // 정리(cleanup)용으로 별도 체인을 하나 더 만들면 그 체인은 아무도 소비하지 않아
  // unhandledRejection으로 프로세스 전체가 죽는다. catch(()=>{})로 흡수해 방지한다.
  next.catch(() => {}).finally(() => {
    if (queues.get(filePath) === next) queues.delete(filePath);
  });
  return next;
}

export async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

export async function writeJson(filePath, data) {
  return enqueue(filePath, async () => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tmpPath, filePath);
  });
}

export async function ensureSeed(filePath, seedValue) {
  try {
    await fs.access(filePath);
  } catch {
    await writeJson(filePath, seedValue);
  }
}
