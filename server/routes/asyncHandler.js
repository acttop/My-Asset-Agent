// Express 4는 async 핸들러 안에서 던진 예외를 자동으로 next(e)로 넘겨주지 않는다.
// 모든 라우트가 반복하던 try { ... } catch (e) { next(e) } 패턴을 이 래퍼로 대체한다.
export function asyncHandler(fn) {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
