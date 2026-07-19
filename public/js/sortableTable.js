// 테이블 헤더 클릭으로 오름차순/내림차순 정렬을 토글하는 기능을 여러 화면(보유종목/이벤트이력/배당/리밸런싱)에서 공용으로 쓴다.
// sortState: { key, dir } — 호출부(각 화면 모듈)가 상태를 들고 있다가 넘겨준다. dir은 'asc' | 'desc'.

export function sortRows(rows, sortState, accessors) {
  if (!sortState?.key) return rows;
  const accessor = accessors[sortState.key];
  if (!accessor) return rows;
  const dir = sortState.dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1; // 값 없는 행은 정렬 방향과 무관하게 항상 뒤로 보낸다.
    if (bv == null) return -1;
    if (typeof av === 'string') return dir * av.localeCompare(bv, 'ko');
    return dir * (av - bv);
  });
}

export function sortableTh(label, key, sortState) {
  const active = sortState?.key === key;
  const arrow = active ? (sortState.dir === 'asc' ? ' ▲' : ' ▼') : '';
  return `<th data-sort-key="${key}" class="sortable-th">${label}${arrow}</th>`;
}

// 헤더 클릭 시 정렬 상태를 토글하고 onChange()를 호출해 다시 그리게 한다 (데이터는 재조회하지 않음).
export function wireSortableHeaders(container, sortState, onChange) {
  container.querySelectorAll('[data-sort-key]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sortKey;
      if (sortState.key === key) {
        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
      } else {
        sortState.key = key;
        sortState.dir = 'asc';
      }
      onChange();
    });
  });
}
