// 펀드는 표준코드(12자리, K로 시작하는 영숫자)를 쓴다. "KR" 외에 "K5" 등으로 시작하는
// 코드(재간접형·사모 등)도 있어 K + 11자리로 판별한다.
// 서버 쪽 fundProvider.js의 CODE_PATTERN과 동일하게 맞춰야 한다.
export const FUND_CODE_PATTERN = /^K[0-9A-Z]{11}$/;

export function isFundTicker(ticker) {
  return FUND_CODE_PATTERN.test(ticker);
}
