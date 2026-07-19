// 현재 보유 비중과 목표 비중을 비교해 괴리율/필요 매매액을 계산한다.
// valuedAssets는 종목뿐 아니라 현금성 자산(isCash)도 포함할 수 있다 — targets에 현금 항목(isCash)이 있으면
// 계좌의 현금성 자산 합계와 비교한다.
export function computeRebalanceStatus(valuedAssets, targets, thresholdPct) {
  const accountTotal = valuedAssets.reduce((sum, h) => sum + (h.marketValueKrw || 0), 0);
  const holdingByTicker = new Map(valuedAssets.filter((h) => !h.isCash).map((h) => [h.ticker, h]));
  const cashTotal = valuedAssets.filter((h) => h.isCash).reduce((sum, h) => sum + (h.marketValueKrw || 0), 0);

  const rows = targets.map((t) => {
    const isCash = !!t.isCash;
    const holding = isCash ? null : holdingByTicker.get(t.ticker);
    const currentValue = isCash ? cashTotal : holding?.marketValueKrw || 0;
    const currentWeight = accountTotal > 0 ? currentValue / accountTotal : 0;
    const deviation = currentWeight - t.targetWeight;
    const targetValue = accountTotal * t.targetWeight;
    const action = targetValue - currentValue; // 양수=매수 필요, 음수=매도 필요

    return {
      ticker: isCash ? null : t.ticker,
      isCash,
      name: isCash ? '현금·예수금' : holding?.name || t.ticker,
      targetWeight: t.targetWeight,
      currentWeight,
      deviation,
      needsAction: Math.abs(deviation) * 100 > thresholdPct,
      targetValue: Math.round(targetValue),
      currentValue: Math.round(currentValue),
      action: Math.round(action),
    };
  });

  return { accountTotal: Math.round(accountTotal), rows };
}

export function validateTargetWeights(targets) {
  const sum = targets.reduce((s, t) => s + t.targetWeight, 0);
  return Math.abs(sum - 1) < 0.001;
}
