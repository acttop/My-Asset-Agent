// 클라우드(예: Railway)에 배포될 때만 보호가 필요하다. 로컬 개발(start.bat)에서는
// AUTH_USER/AUTH_PASS를 설정하지 않으므로 지금까지와 동일하게 로그인 없이 동작한다.
export function basicAuth(req, res, next) {
  const { AUTH_USER, AUTH_PASS } = process.env;
  if (!AUTH_USER || !AUTH_PASS) return next();

  const header = req.headers.authorization;
  if (header?.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf-8');
    const separatorIndex = decoded.indexOf(':');
    const user = decoded.slice(0, separatorIndex);
    const pass = decoded.slice(separatorIndex + 1);
    if (user === AUTH_USER && pass === AUTH_PASS) return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="asset-manager"');
  res.status(401).send('인증이 필요합니다');
}
