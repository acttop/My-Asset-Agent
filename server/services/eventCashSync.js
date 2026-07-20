import * as cashAssetsStore from '../data/cashAssetsStore.js';
import { getCurrentFxRate } from './fx.js';

// 매수는 계좌 현금을 줄이고, 매도는 늘린다. 그 외 유형은 현금성자산에 영향 없음(0).
// 이벤트 통화가 KRW가 아니면 환율로 환산한다.
async function cashDeltaKrw(event) {
  if (event.type !== 'buy' && event.type !== 'sell') return 0;
  const fxRate = await getCurrentFxRate(event.currency);
  const amountKrw = event.amount * fxRate;
  return event.type === 'buy' ? -amountKrw : amountKrw;
}

// 계좌의 첫 번째 현금성자산에 델타를 반영한다. 없으면 새로 만든다.
async function adjustCash(accountId, deltaKrw) {
  if (!deltaKrw) return;
  const cashAssets = await cashAssetsStore.listCashAssets({ accountId });
  const target = cashAssets[0];
  if (target) {
    await cashAssetsStore.updateCashAsset(target.id, { value: target.value + deltaKrw });
  } else {
    await cashAssetsStore.createCashAsset({ accountId, name: '현금성자산', value: deltaKrw });
  }
}

// 이벤트 생성 시 그 영향을 현금성자산에 반영한다.
export async function applyEventCashEffect(event) {
  await adjustCash(event.accountId, await cashDeltaKrw(event));
}

// 이벤트 수정 시 이전 영향을 되돌리고 새 영향을 반영한다 (계좌가 바뀐 경우도 포함).
export async function reapplyEventCashEffect(before, after) {
  await adjustCash(before.accountId, -(await cashDeltaKrw(before)));
  await adjustCash(after.accountId, await cashDeltaKrw(after));
}

// 이벤트 삭제 시 그 영향을 되돌린다.
export async function revertEventCashEffect(event) {
  await adjustCash(event.accountId, -(await cashDeltaKrw(event)));
}
