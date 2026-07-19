// 오버레이 배경 클릭 또는 X 버튼으로 모달을 닫는 공통 배선.
// mousedown이 오버레이 자체에서 시작했을 때만 닫는다 — 모달 안(입력창 등)에서 드래그를
// 시작해 바깥에서 마우스를 놓으면 click의 target이 오버레이로 잡혀 잘못 닫히는 것을 방지.
export function wireOverlayDismiss(root, overlayId, closeId, onClose) {
  root.querySelector(`#${closeId}`).addEventListener('click', onClose);
  const overlay = root.querySelector(`#${overlayId}`);
  let mousedownOnOverlay = false;
  overlay.addEventListener('mousedown', (e) => {
    mousedownOnOverlay = e.target.id === overlayId;
  });
  overlay.addEventListener('click', (e) => {
    if (mousedownOnOverlay && e.target.id === overlayId) onClose();
  });
}
