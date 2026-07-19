import crypto from 'node:crypto';
import { readJson, writeJson } from './store.js';

// id를 가진 객체 배열(JSON 파일)에 대한 list/insert/update/remove 기본 동작을 제공한다.
// accounts/cashAssets/backtestPortfolios/events가 거의 동일한 CRUD 패턴을 반복하고 있어 공통화했다.
export function createCollectionStore(filePath, { idPrefix }) {
  async function list(filterFn) {
    const all = await readJson(filePath, []);
    return filterFn ? all.filter(filterFn) : all;
  }

  function newId() {
    return `${idPrefix}_${crypto.randomUUID()}`;
  }

  async function insert(record) {
    const all = await readJson(filePath, []);
    all.push(record);
    await writeJson(filePath, all);
    return record;
  }

  async function update(id, patch) {
    const all = await readJson(filePath, []);
    const idx = all.findIndex((item) => item.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...patch, id };
    await writeJson(filePath, all);
    return all[idx];
  }

  async function remove(id) {
    const all = await readJson(filePath, []);
    const next = all.filter((item) => item.id !== id);
    await writeJson(filePath, next);
    return next.length !== all.length;
  }

  // predicate에 해당하는 항목을 모두 지운다 (계좌 삭제 시 딸린 이벤트/현금자산 정리 등에 쓴다).
  async function removeWhere(predicate) {
    const all = await readJson(filePath, []);
    const next = all.filter((item) => !predicate(item));
    await writeJson(filePath, next);
    return all.length - next.length;
  }

  return { list, newId, insert, update, remove, removeWhere };
}
