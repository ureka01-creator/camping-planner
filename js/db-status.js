import { dataAdapter, DATA_MODE } from './firebase.js?v=064';

const connectionText = document.getElementById('connectionText');
let current = DATA_MODE.useFirebase ? { state:'connecting', error:null } : { state:'local', error:null };
let painting = false;

function labelFor(status) {
  if (!DATA_MODE.useFirebase || status.state === 'local') return '로컬 데모 모드 · 같은 기기 탭 간 동기화';
  if (status.state === 'connected') return 'Firebase 실시간 연결됨';
  if (status.state === 'offline') return '오프라인 · 마지막 동기화 데이터 표시 중';
  if (status.state === 'error') return 'Firebase 연결 오류 · 자동 재시도 중';
  return 'Firebase 연결 중…';
}

function paint() {
  if (!connectionText) return;
  const next = labelFor(current);
  if (connectionText.textContent === next) return;
  painting = true;
  connectionText.textContent = next;
  queueMicrotask(() => { painting = false; });
}

dataAdapter.subscribeStatus?.(status => {
  current = status;
  paint();
});

if (connectionText) {
  new MutationObserver(() => {
    if (!painting) queueMicrotask(paint);
  }).observe(connectionText, { childList:true, characterData:true, subtree:true });
  paint();
}
