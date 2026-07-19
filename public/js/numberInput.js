// 금액 입력 필드에 타이핑하는 즉시 천단위 콤마를 붙여 보여주고, 제출 시에는 콤마를 뗀 순수 숫자로 읽는 헬퍼.
// <input type="number">는 콤마를 넣을 수 없어(브라우저가 거부) type="text"로 바꿔 쓰는 걸 전제로 한다.

function formatWithCommas(raw) {
  if (!raw) return '';
  const [intPart, decPart] = raw.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
}

// 템플릿 문자열에서 input의 초기 value="..."를 미리 콤마 서식으로 채워둘 때 쓴다.
export function formatForInput(value) {
  if (value == null || value === '') return '';
  return formatWithCommas(String(value));
}

// 입력 중 커서 위치가 콤마 삽입/삭제로 튀지 않도록, 끝에서부터의 거리 기준으로 커서를 복원한다.
export function wireThousandsInput(input) {
  input.addEventListener('input', () => {
    const cursorFromEnd = input.value.length - input.selectionStart;
    const raw = input.value.replace(/[^\d.]/g, '');
    input.value = formatWithCommas(raw);
    const pos = Math.max(0, input.value.length - cursorFromEnd);
    input.setSelectionRange(pos, pos);
  });
}

// 콤마가 섞인 문자열(입력 필드 값, FormData 값 등)을 순수 숫자로 되돌린다.
export function parseCommaNumber(value) {
  const raw = String(value ?? '').replace(/,/g, '');
  return raw === '' ? NaN : Number(raw);
}

export function parseNumberInput(input) {
  return parseCommaNumber(input.value);
}
