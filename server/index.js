import { createApp } from './app.js';
import { config } from './config.js';

// 예상 못한 곳에서 프로미스가 reject된 채 방치되면 Node가 프로세스 전체를 죽인다.
// 개인용 로컬 앱에서 요청 하나의 오류 때문에 서버 전체가 내려가는 건 과한 대가이므로,
// 로그만 남기고 계속 실행한다.
process.on('unhandledRejection', (reason) => {
  console.error('처리되지 않은 프로미스 거부:', reason);
});

const app = createApp();

app.listen(config.port, () => {
  console.log(`asset-manager server listening on http://localhost:${config.port}`);
});
