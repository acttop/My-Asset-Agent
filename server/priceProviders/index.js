import * as yahooProvider from './yahooProvider.js';
import * as naverProvider from './naverProvider.js';
import * as fundProvider from './fundProvider.js';

function resolveProvider(ticker) {
  if (fundProvider.isFundCode(ticker)) return fundProvider;
  return /\.(KS|KQ)$/i.test(ticker) ? naverProvider : yahooProvider;
}

export function sourceFor(ticker) {
  const provider = resolveProvider(ticker);
  if (provider === fundProvider) return 'fund';
  return provider === naverProvider ? 'naver' : 'yahoo';
}

export async function getQuote(ticker) {
  return resolveProvider(ticker).getQuote(ticker);
}

export async function getHistory(ticker, opts) {
  return resolveProvider(ticker).getHistory(ticker, opts);
}

// 배당 재투자 반영 수정종가. 네이버(한국 티커)는 미지원 — 호출부에서 폴백 처리한다.
export async function getAdjustedHistory(ticker, opts) {
  const provider = resolveProvider(ticker);
  if (!provider.getAdjustedHistory) {
    throw new Error(`${ticker}: 수정종가(배당 재투자) 데이터를 지원하지 않는 소스입니다`);
  }
  return provider.getAdjustedHistory(ticker, opts);
}

export async function getIntradayHistory(ticker, opts) {
  return resolveProvider(ticker).getIntradayHistory(ticker, opts);
}
