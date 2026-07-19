import { Router } from 'express';
import * as store from '../data/accountsStore.js';
import { listHoldings } from '../data/holdingsCache.js';
import { listCashAssets, deleteCashAssetsByAccountId } from '../data/cashAssetsStore.js';
import { deleteEventsByAccountId } from '../data/eventsStore.js';
import { deleteConfig as deleteRebalanceConfig } from '../data/rebalanceStore.js';
import { asyncHandler } from './asyncHandler.js';

export const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await store.listAccounts());
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.body?.name) return res.status(400).json({ error: 'name은 필수입니다' });
    // 같은 이름의 계좌가 이미 있으면 새로 만들지 않고 재사용한다 (모달에서 즉석 입력 시 중복 방지).
    res.status(201).json(await store.findOrCreateAccount(req.body.name, req.body));
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const updated = await store.updateAccount(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: '계좌를 찾을 수 없습니다' });
    res.json(updated);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const accountId = req.params.id;
    const [holdings, cashAssets] = await Promise.all([
      listHoldings({ accountId }),
      listCashAssets({ accountId }),
    ]);
    if (holdings.length > 0 || cashAssets.length > 0) {
      return res.status(400).json({ error: '보유 종목이나 현금 자산이 있는 계좌는 삭제할 수 없습니다' });
    }
    const ok = await store.deleteAccount(accountId);
    if (!ok) return res.status(404).json({ error: '계좌를 찾을 수 없습니다' });
    // 계좌가 비어있어도 과거 이벤트(입출금 등으로 잔액이 0이 된 경우) 기록은 남아있을 수 있어 함께 정리한다.
    await Promise.all([
      deleteEventsByAccountId(accountId),
      deleteCashAssetsByAccountId(accountId),
      deleteRebalanceConfig(accountId),
    ]);
    res.status(204).end();
  })
);
