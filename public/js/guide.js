import { api } from './api.js';
import { escapeHtml } from './format.js';
import { openPriceChartModal } from './priceChartModal.js';

const SECTIONS = [
  ['usage', '📖 사용법'],
  ['indicators', '🌍 경제 지표'],
  ['glossary', '📚 용어사전'],
  ['news', '📰 경제뉴스'],
  ['ai-insight', '🤖 AI 인사이트'],
];

// 외부 사이트를 iframe으로 그대로 보여주는 서브탭들 — sectionKey별 소스 정보.
const EXTERNAL_EMBEDS = {
  news: {
    url: 'https://sector-king.com/',
    label: 'sector-king.com',
    title: '경제뉴스',
    description: '경제 뉴스를',
  },
  'ai-insight': {
    url: 'https://hyveo.github.io/daily-ai-insight/index.html',
    label: 'Daily AI Insight',
    title: 'AI 인사이트',
    description: 'AI 관련 일일 인사이트를',
  },
};

let activeSection = 'usage';
let glossaryQuery = '';

const USAGE_ITEMS = [
  {
    icon: '📊',
    title: '대시보드',
    body: [
      '전체 자산 현황을 한눈에 보는 화면이에요. 상단 시세 바에서 코스피·나스닥100·S&P500 등 주요 지수를 확인할 수 있어요.',
      '상단의 계좌 탭(전체/개별 계좌)을 눌러 특정 계좌만 필터링해서 볼 수 있어요.',
      '"누적수익률"은 지금까지 넣은 돈 대비 얼마나 불었는지, "연평균수익률"은 입출금 시점까지 고려한 연 환산 수익률이에요.',
    ],
  },
  {
    icon: '📈',
    title: '보유종목',
    body: [
      '"＋ 자산 추가" 버튼으로 주식/채권/ETF 또는 현금성 자산을 등록해요. 종목명이나 티커로 검색해서 선택하면 현재가가 자동으로 채워져요.',
      '이미 보유한 종목을 더 살 때는 "추매", 일부만 팔 때는 "매도" 버튼을 사용해요. 두 경우 모두 자동으로 평단가가 재계산돼요.',
      '✏️로 수량·단가를 직접 수정할 수 있고, 🗑️로 삭제(전량 매도 처리)할 수 있어요.',
    ],
  },
  {
    icon: '💰',
    title: '이벤트 이력',
    body: [
      '입금·출금·배당·매수·매도 등 모든 거래를 시간순으로 기록하고 확인하는 화면이에요. 실제로 앱의 모든 계산은 이 이벤트 기록을 바탕으로 이뤄져요.',
      '상단 필터로 종류/계좌/기간/검색어를 조합해서 원하는 기록만 찾아볼 수 있어요.',
      '보유종목이나 대시보드 수치가 이상해 보인다면, 먼저 이 화면에서 잘못 입력된 이벤트가 없는지 확인해보세요.',
    ],
  },
  {
    icon: '💸',
    title: '배당',
    body: [
      '지금까지 받은 배당 누적액과 올해 받은 배당액, 종목별 배당수익률·YoC를 확인할 수 있어요.',
      '배당을 받으면 이벤트 이력에서 "배당" 유형으로 직접 기록해줘야 이 화면에 반영돼요 (자동 조회는 지원하지 않아요).',
      '월별 배당 그래프로 배당이 특정 달에 몰려있는지, 고르게 분산돼 있는지 확인할 수 있어요.',
    ],
  },
  {
    icon: '🎯',
    title: '리밸런싱',
    body: [
      '계좌별로 "이 종목은 몇 %씩 갖고 있고 싶다"는 목표 비중을 설정해두면, 지금 비중과 얼마나 차이 나는지(괴리율) 계산해줘요.',
      '백테스팅 탭에서 만든 포트폴리오를 그대로 불러와서 목표 비중으로 쓸 수도 있어요.',
      '"필요 액션"에 나온 금액만큼 사고팔면 목표 비중에 맞춰지고, 실제로 조정을 마쳤다면 "오늘로 기록"을 눌러 마지막 리밸런싱 날짜를 남겨두세요.',
    ],
  },
  {
    icon: '🔬',
    title: '백테스팅',
    body: [
      '"만약 과거에 이 종목들을 이 비중으로 샀다면 지금 어땠을까?"를 시뮬레이션해보는 화면이에요.',
      '추천 포트폴리오를 눌러 빠르게 시작하거나, 티커와 비중을 직접 입력해 나만의 조합을 만들 수 있어요. 초기 투자금·매월 추가 납입·리밸런싱 주기까지 설정할 수 있어요.',
      '결과는 어디까지나 과거 데이터를 되짚어본 것으로, 미래 수익을 보장하지 않는다는 점을 꼭 기억하세요.',
    ],
  },
];

const INDICATOR_EXPLANATIONS = {
  코스피: '한국거래소 유가증권시장(코스피)에 상장된 대표 기업들의 주가를 종합한 지수예요. 한국 대형주 시장 전체의 분위기를 보여주는 대표 지표예요.',
  나스닥100: '미국 나스닥 시장에 상장된 비금융 대형주 100개로 구성된 지수예요. 애플·마이크로소프트 등 대형 기술주 비중이 높아 기술주 시장의 온도계로 많이 쓰여요.',
  'S&P500': '미국 대형 상장기업 500곳의 주가를 반영한 지수로, 미국 증시 전체를 대표하는 가장 널리 쓰이는 벤치마크예요.',
  SCHD: '미국의 배당 성장주 위주로 구성된 대표적인 배당 ETF예요. 배당을 꾸준히 늘려온 기업들에 분산 투자하는 상품이에요.',
  BTC: '비트코인 가격이에요. 국가나 중앙은행이 발행하지 않는 대표적인 암호화폐로, 주식·채권보다 가격 변동성이 큰 편이에요.',
  달러: '원/달러 환율이에요. 해외 자산을 원화로 환산할 때 기준이 되고, 환율이 오르면(원화 약세) 같은 달러 자산의 원화 평가액이 커져요.',
};

// 카드 클릭 시: chartTicker로 내부 가격 차트 모달을 열고, 모달 안에 externalUrl(관련 외부 페이지) 링크도 함께 보여준다.
// 코스피는 대시보드 시세바에서 네이버(KOSPI 코드)로 조회하지만, 가격 이력 조회는 Yahoo 라우팅만 지원돼 있어
// 여기서는 Yahoo가 인식하는 코스피 지수 심볼(^KS11)을 대신 쓴다.
const INDEX_LINKS = {
  코스피: { chartTicker: '^KS11', externalUrl: 'https://finance.naver.com/sise/sise_index.naver?code=KOSPI', externalLabel: '네이버금융' },
  나스닥100: { chartTicker: '^NDX', externalUrl: 'https://finance.yahoo.com/quote/%5ENDX', externalLabel: 'Yahoo Finance' },
  'S&P500': { chartTicker: '^GSPC', externalUrl: 'https://finance.yahoo.com/quote/%5EGSPC', externalLabel: 'Yahoo Finance' },
  SCHD: { chartTicker: 'SCHD', externalUrl: 'https://finance.yahoo.com/quote/SCHD', externalLabel: 'Yahoo Finance' },
  BTC: { chartTicker: 'BTC-USD', externalUrl: 'https://finance.yahoo.com/quote/BTC-USD', externalLabel: 'Yahoo Finance' },
  달러: { chartTicker: 'KRW=X', externalUrl: 'https://finance.naver.com/marketindex/exchangeDetail.naver?marketindexCd=FX_USDKRW', externalLabel: '네이버 환율' },
};

export async function renderGuide(container) {
  container.innerHTML = `
    <div class="mb-4 flex gap-2 flex-wrap">
      ${SECTIONS.map(
        ([key, label]) =>
          `<button data-section="${key}" class="guide-section-tab px-3 py-1.5 text-sm rounded-full ${
            activeSection === key ? 'bg-blue-600 text-white' : 'bg-white border'
          }">${label}</button>`
      ).join('')}
    </div>
    <div id="guide-body"></div>
  `;

  container.querySelectorAll('.guide-section-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeSection = btn.dataset.section;
      renderGuide(container);
    });
  });

  const body = container.querySelector('#guide-body');
  if (activeSection === 'usage') renderUsage(body);
  else if (activeSection === 'indicators') await renderIndicators(body);
  else if (activeSection === 'glossary') renderGlossary(body);
  else renderExternalEmbed(body, EXTERNAL_EMBEDS[activeSection]);
}

function renderUsage(body) {
  body.innerHTML = `
    <div class="card mb-4">
      <p class="text-sm text-slate-500">
        자산 관리가 처음이라도 괜찮아요. 이 앱은 각 화면에 <b>이벤트(입출금·매수·매도·배당)</b>를 기록하면
        나머지 계산(평단가, 수익률, 배당, 리밸런싱)은 전부 자동으로 이뤄지도록 만들어졌어요.
        아래에서 화면별 사용법을 확인해보세요.
      </p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${USAGE_ITEMS.map(
        (item) => `
        <div class="card">
          <div class="font-bold mb-2">${item.icon} ${escapeHtml(item.title)}</div>
          <ul class="text-sm text-slate-600 space-y-1.5 list-disc list-inside">
            ${item.body.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
          </ul>
        </div>
      `
      ).join('')}
    </div>
  `;
}

// 경제뉴스/AI 인사이트 등 외부 사이트를 iframe으로 그대로 보여주는 서브탭 공통 렌더러.
function renderExternalEmbed(body, { url, label, title, description }) {
  body.innerHTML = `
    <div class="card mb-4 flex justify-between items-center flex-wrap gap-2">
      <p class="text-xs text-slate-500">
        외부 사이트(<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">${escapeHtml(label)}</a>)의
        ${escapeHtml(description)} 화면 안에서 바로 볼 수 있어요. 이 앱이 제공하는 정보가 아니라 외부 제공 콘텐츠예요.
      </p>
      <a href="${url}" target="_blank" rel="noopener noreferrer"
        class="text-sm text-blue-600 border border-blue-200 rounded px-3 py-1.5 whitespace-nowrap">새 창에서 열기 ↗</a>
    </div>
    <div class="card p-0 overflow-hidden">
      <iframe src="${url}" title="${escapeHtml(title)}" class="w-full" style="height: 75vh; border: 0;"
        referrerpolicy="no-referrer" loading="lazy"></iframe>
    </div>
  `;
}

async function renderIndicators(body) {
  body.innerHTML = `<p class="text-slate-500">시세 불러오는 중...</p>`;
  const disclaimer = `
    <div class="card mb-4 border-amber-200 bg-amber-50">
      <p class="text-xs text-amber-700">
        ⚠️ 아래 설명은 각 지표가 무엇을 의미하는지 알려주는 교육용 정보이며, 특정 종목의 매수·매도를 권하거나
        시장 방향을 예측하는 투자 조언이 아니에요. 투자 판단과 책임은 본인에게 있어요.
      </p>
    </div>
  `;
  try {
    const items = await api.getMarketIndices();
    const cards = items
      .map((item) => {
        const explanation = INDICATOR_EXPLANATIONS[item.label] || '';
        const priceText = item.price != null ? formatIndicatorPrice(item) : '조회 실패';
        const up = (item.change ?? 0) >= 0;
        const cls = item.change != null ? (up ? 'text-red-600' : 'text-blue-600') : 'text-slate-400';
        const changeText =
          item.change != null
            ? `${up ? '▲' : '▼'} ${Math.abs(item.changePercent * 100).toFixed(2)}% (전일 대비)`
            : '';
        const clickable = !!INDEX_LINKS[item.label];
        return `
          <div class="card${clickable ? ' indicator-card cursor-pointer hover:border-blue-300' : ''}" ${clickable ? `data-index="${escapeHtml(item.label)}"` : ''}>
            <div class="flex justify-between items-baseline mb-1">
              <div class="font-bold">${escapeHtml(item.label)}${clickable ? ' <span class="text-slate-300 text-xs font-normal">차트 보기 ›</span>' : ''}</div>
              <div class="text-right">
                <div class="font-medium">${priceText}</div>
                <div class="text-xs ${cls}">${changeText}</div>
              </div>
            </div>
            <p class="text-sm text-slate-600">${escapeHtml(explanation)}</p>
          </div>
        `;
      })
      .join('');
    body.innerHTML = `${disclaimer}<div class="grid grid-cols-1 md:grid-cols-2 gap-4">${cards}</div>`;

    body.querySelectorAll('.indicator-card').forEach((card) => {
      card.addEventListener('click', () => {
        const label = card.dataset.index;
        const link = INDEX_LINKS[label];
        if (!link) return;
        openPriceChartModal({
          ticker: link.chartTicker,
          name: label,
          externalLink: { url: link.externalUrl, label: link.externalLabel },
        });
      });
    });
  } catch (err) {
    body.innerHTML = `${disclaimer}<p class="text-red-600">시세를 불러오지 못했어요: ${escapeHtml(err.message)}</p>`;
  }
}

function formatIndicatorPrice(item) {
  const digits = item.label === 'SCHD' ? 2 : 0;
  const symbol = item.label === 'SCHD' || item.label === 'BTC' ? '$' : item.label === '달러' ? '₩' : '';
  return `${symbol}${new Intl.NumberFormat('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(item.price)}`;
}

const GLOSSARY = [
  ['계좌', '증권사·연금 등 자산을 보관하는 단위예요. ISA, IRP, 연금저축, 일반계좌처럼 세제 혜택이나 성격이 다른 계좌를 구분해서 관리해요.'],
  ['이벤트', '매수·매도·입금·출금·배당처럼 계좌에서 일어난 거래 하나하나를 뜻해요. 이 앱의 모든 수치는 이벤트 기록을 바탕으로 계산돼요.'],
  ['평단가', '같은 종목을 여러 번 나눠 샀을 때, 산 금액 전체를 산 수량으로 나눈 평균 매수 단가예요.'],
  ['ETF', '여러 종목을 묶어 하나의 주식처럼 거래할 수 있게 만든 펀드예요. 개별 종목보다 분산 효과가 있어요.'],
  ['배당수익률', '현재 주가 대비 최근 1년간 받은 배당금의 비율이에요. (연간 배당금 ÷ 현재가)'],
  ['YoC (투자배당률)', 'Yield on Cost의 줄임말로, 내가 실제로 산 가격(평단가) 대비 배당금의 비율이에요. (연간 배당금 ÷ 평단가) 오래 보유할수록 매수가 대비 배당률이 올라가는 걸 보여줘요.'],
  ['리밸런싱', '시간이 지나며 흐트러진 자산 비중을 원래 목표했던 비중으로 다시 맞추는 작업이에요.'],
  ['목표 비중', '리밸런싱의 기준이 되는, 내가 이 종목을 전체 자산의 몇 %만큼 갖고 싶은지를 나타내는 값이에요.'],
  ['괴리율', '현재 비중과 목표 비중의 차이예요. (현재 비중 − 목표 비중) 양수면 비중이 초과된 것, 음수면 부족한 것이에요.'],
  ['CAGR (연평균수익률)', 'Compound Annual Growth Rate. 여러 해에 걸친 수익을 매년 몇 %씩 복리로 성장한 것과 같은지로 환산한 값이에요.'],
  ['XIRR', '입출금이 여러 시점에 걸쳐 일어났을 때, 각 현금흐름의 날짜까지 고려해서 계산하는 연 환산 수익률이에요. 이 앱의 연평균수익률·CAGR 계산에 쓰여요.'],
  ['누적수익률', '지금까지 넣은 돈(순납입금) 대비 현재 평가금액이 얼마나 늘었는지를 나타내는 비율이에요. (평가금액 − 순납입금) ÷ 순납입금'],
  ['MDD (최대낙폭)', 'Maximum Drawdown. 특정 기간 중 자산이 고점에서 저점까지 최대 몇 % 떨어졌는지를 나타내요. 숫자가 클수록 그 기간 버티기 힘들었다는 뜻이에요.'],
  ['변동성', '자산 가치가 오르내리는 정도예요. 변동성이 크면 수익도 손실도 크게 날 수 있어요. 이 앱에서는 월별 수익률의 표준편차를 연환산해서 보여줘요.'],
  ['샤프지수', '위험(변동성) 대비 얼마나 수익을 냈는지를 나타내는 지표예요. 숫자가 높을수록 같은 위험을 감수하고 더 많은 수익을 냈다는 뜻이에요.'],
  ['칼마비율', '연평균수익률을 최대낙폭(MDD)으로 나눈 값이에요. 숫자가 높을수록 큰 폭의 하락 없이 꾸준히 수익을 냈다는 뜻이에요.'],
  ['백테스팅', '과거 시세 데이터를 이용해 "이 조합으로 그때 투자했다면 어땠을까"를 시뮬레이션해보는 것이에요. 과거 성과가 미래 수익을 보장하지는 않아요.'],
  ['벤치마크', '내 포트폴리오 성과와 비교하는 기준이 되는 지수예요 (예: S&P500). 내 전략이 시장 평균보다 잘했는지 확인할 때 써요.'],
  ['stale (지연 시세)', '실시간 시세 조회에 실패했을 때, 마지막으로 성공했던 시세를 대신 보여주고 있다는 표시예요.'],
  ['PER (주가수익비율)', 'Price Earnings Ratio. 주가를 주당순이익(EPS)으로 나눈 값이에요. 지금 주가가 회사가 버는 돈에 비해 비싼지 싼지를 가늠하는 대표 지표로, 낮을수록 이익 대비 저평가됐다고 보는 경우가 많지만 업종마다 적정 수준이 달라 단순 비교는 주의가 필요해요.'],
  ['PBR (주가순자산비율)', 'Price Book-value Ratio. 주가를 주당순자산(BPS)으로 나눈 값이에요. 회사를 지금 청산했을 때 주주가 받을 자산 대비 주가가 몇 배인지를 보여주며, 1보다 낮으면 장부상 자산가치보다 싸게 거래되고 있다는 뜻이에요.'],
  ['ROE (자기자본이익률)', 'Return on Equity. 회사가 주주 자본을 얼마나 효율적으로 굴려 이익을 냈는지 보여줘요. (순이익 ÷ 자기자본) 높을수록 자본 활용이 효율적이라는 뜻이에요.'],
  ['EPS (주당순이익)', 'Earnings Per Share. 회사의 순이익을 발행주식수로 나눈 값이에요. 주식 한 주가 벌어들이는 이익을 나타내며, PER 계산의 기준이 돼요.'],
  ['BPS (주당순자산)', 'Book-value Per Share. 회사의 순자산(자산 − 부채)을 발행주식수로 나눈 값이에요. PBR 계산의 기준이 돼요.'],
  ['시가총액', '상장된 전체 주식 수 × 현재 주가로 계산한 회사의 시장 가치예요. 회사 규모를 비교할 때 가장 많이 쓰이는 지표예요.'],
  ['배당성향', '회사가 벌어들인 순이익 중 얼마를 배당으로 나눠줬는지의 비율이에요. (배당금 총액 ÷ 순이익) 너무 높으면 재투자 여력이 부족할 수 있어요.'],
  ['배당락일', '이 날짜 이후에 주식을 사면 이번 배당을 받을 권리가 없어지는 기준일이에요. 배당락일 당일엔 배당금만큼 주가가 이론상 하락하는 경향이 있어요.'],
  ['우선주', '의결권(주주총회 투표권)이 없는 대신 보통주보다 배당을 조금 더 받는 주식 유형이에요. 종목명 끝에 보통 "우"가 붙어요.'],
  ['액면분할', '주식 1주를 여러 주로 쪼개는 것이에요. 회사의 전체 가치는 그대로지만 주당 가격이 낮아져 거래 접근성이 높아져요.'],
  ['상한가·하한가', '하루 동안 주가가 오르내릴 수 있는 최대 폭이에요. 한국 증시는 전일 종가 대비 ±30%로 제한돼 있어요.'],
  ['서킷브레이커', '주가지수가 급락할 때 시장 전체 거래를 일시적으로 중단시키는 안전장치예요.'],
  ['공매도', '주식을 빌려서 먼저 팔고 나중에 다시 사서 갚는 거래 방식이에요. 주가가 떨어질 때 이익을 보는 구조라 하락장에서 쓰이는 전략이에요.'],
  ['기준가 (펀드)', '펀드의 좌당 가격이에요. 보통 1,000좌를 기준으로 고시되기 때문에, 실제 평가금액은 좌수 × 기준가 ÷ 1,000으로 계산해요.'],
  ['좌수', '펀드에 투자한 지분의 단위예요. 주식의 "주"에 해당하며, 납입금액을 매수 당시 기준가로 나눠 계산해요.'],
  ['NAV (순자산가치)', 'Net Asset Value. 펀드나 ETF가 보유한 자산의 총 가치를 좌수(또는 주수)로 나눈 값이에요. 펀드의 "기준가"가 여기 해당해요.'],
  ['운용보수', '펀드·ETF를 운용하는 자산운용사에 매년 지불하는 수수료예요. 보통 연 %로 표시되고, 펀드 자산에서 매일 조금씩 차감돼요.'],
  ['추적오차', '인덱스 ETF가 목표로 하는 지수의 수익률을 얼마나 정확히 따라갔는지 나타내는 오차예요. 작을수록 지수를 잘 복제한 ETF예요.'],
  ['인덱스펀드', '코스피200, S&P500 같은 특정 지수를 그대로 따라가도록 설계된 펀드예요. 개별 종목을 고르지 않아 운용보수가 낮은 편이에요.'],
  ['액티브펀드', '펀드매니저가 시장 평균(지수)보다 높은 수익을 내려고 종목을 직접 골라 운용하는 펀드예요. 인덱스펀드보다 운용보수가 높은 경우가 많아요.'],
  ['환헤지 (H)', '해외자산 투자 시 환율 변동 위험을 없애는 전략이에요. 종목명에 "(H)"가 붙으면 환헤지 상품이라는 뜻으로, 환율과 무관하게 자산 가격 변동만 수익률에 반영돼요.'],
  ['표준코드', '국내 펀드를 구분하는 12자리 고유 코드예요 (KR로 시작). 주식의 6자리 종목코드에 해당하며, 펀드 조회·검색에 사용해요.'],
];

function renderGlossary(body) {
  body.innerHTML = `
    <div class="card mb-4">
      <input id="glossary-search" placeholder="용어 검색 (예: CAGR, 리밸런싱)" class="border rounded px-3 py-2 w-full"
        value="${escapeHtml(glossaryQuery)}" />
    </div>
    <div id="glossary-results" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
  `;

  renderGlossaryResults(body);

  // 검색할 때마다 input을 통째로 다시 그리면 한글 조합(IME) 중간 상태가 끊겨서 자음/모음이
  // 낱개로만 입력된다. 결과 목록만 갱신하고 input 엘리먼트 자체는 건드리지 않는다.
  const input = body.querySelector('#glossary-search');
  input.addEventListener('input', () => {
    glossaryQuery = input.value.trim().toLowerCase();
    renderGlossaryResults(body);
  });
}

function renderGlossaryResults(body) {
  const filtered = GLOSSARY.filter(
    ([term, def]) => !glossaryQuery || term.toLowerCase().includes(glossaryQuery) || def.toLowerCase().includes(glossaryQuery)
  );
  body.querySelector('#glossary-results').innerHTML =
    filtered.length === 0
      ? `<p class="text-slate-400 text-sm">검색 결과가 없어요.</p>`
      : filtered
          .map(
            ([term, def]) => `
        <div class="card">
          <div class="font-bold mb-1">${escapeHtml(term)}</div>
          <p class="text-sm text-slate-600">${escapeHtml(def)}</p>
        </div>
      `
          )
          .join('');
}
