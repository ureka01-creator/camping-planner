# Camping Planner 랜딩 품질 수정 작업 지시서 — v1.0.8

## 목표
현재 iPhone Safari 랜딩에서 확인된 3개 문제를 동시에 해결한다.

1. 메인 포스터 저화질
2. `object-fit: cover` 때문에 제목/그림이 과도하게 확대·잘림
3. 랜딩 화면에서 세로 스크롤바 발생

## 적용 기준
- 현재 480×720 저화질 JPEG 사용 중단.
- 확보된 최종 승인 원본(1024×1536)을 고화질 JPEG로 변환해 사용한다.
- 포스터 전경은 `object-fit: contain`으로 전체 구도를 보존한다.
- 남는 상/하 공간은 같은 포스터의 blurred cover 배경으로 자연스럽게 채운다. 검은 빈 여백처럼 보이면 안 된다.
- 랜딩이 열려 있는 동안 `html`과 `body` 모두 스크롤을 완전히 잠근다.
- 랜딩 종료 즉시 스크롤 잠금을 해제한다.
- iPhone Safari 주소창 확장/축소에도 레이아웃이 흔들리지 않도록 `100dvh`, fixed inset 0 기준으로 유지한다.
- 하단 화살표는 absolute overlay로만 배치하여 문서 높이에 영향을 주지 않는다.

## QA 통과 조건
- 라이브 GitHub Pages에서 포스터 `naturalWidth >= 1000`.
- 제목 왼쪽이 잘리지 않는다.
- 텐트/하단 문구까지 전체 포스터 구도가 보인다.
- 랜딩 상태에서 `document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1`.
- 랜딩 상태에서 세로 스크롤바가 보이지 않는다.
- 포스터 탭 후 Google 로그인 게이트가 정상 표시된다.
