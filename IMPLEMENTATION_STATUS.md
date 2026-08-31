# PM / Implementation Status

- Project: Camping Planner WebApp
- Version: v0.5.3
- Previous phase: Planning v1.0 DONE
- Current mode: 홈 준비 지표 통합 + 식사 카드 재정리 + QA 완료 → PM 모드 복귀
- Current implementation status: LIVE FIREBASE MVP + PREPARATION HUB + SETTLEMENT MVP + FIRST ENTRY UX + HOME DASHBOARD V3 + AUTOMATED REGRESSION PASS
- Firebase realtime mode: ENABLED
- Two-client realtime sync: AUTOMATED QA PASS
- GitHub Pages deployment: PASS
- Next recommended mode: 모바일 실기기 홈 UX 리뷰 → 실제 캠핑 데이터 점검 → 최종 안정화

## 완료된 것
1. 모바일 앱 셸 / 하단 4탭
2. 홈 진행률 / 담당자별 준비율
3. 날짜별 식단 CRUD
4. 식단 상세 준비항목 CRUD / 완료 체크
5. 준비물 CRUD / 완료 토글 / 상태·담당자 필터
6. 준비물 카테고리 필터 / 주류 카테고리
7. Preparation Hub: 공용 준비물 + 식단 준비 통합 보기
8. 담당자별 전체 준비율 / 전체 준비 진행률
9. 참여자 CRUD
10. 공유 URL `trip` 파라미터
11. Firebase Anonymous Auth + Firestore 실시간 동기화
12. Firebase 연결 상태 표시 / 재연결 처리
13. localStorage 서버 캐시 / 로컬 fallback 구조
14. Firestore rules / Firebase CLI 설정
15. GitHub Pages 배포
16. UI QA Harness / GitHub Actions 자동 smoke test
17. 서로 다른 두 브라우저 컨텍스트 간 준비물 완료 상태 실시간 전파 자동 검증
18. 준비물 `내 것` 필터 제거
19. 준비물 금액 입력 / 수정 / 목록 금액 표시
20. 준비물 결제자: 기본값은 담당자, 필요할 때만 변경
21. 식단 준비항목 결제자: 기본값은 담당자, 필요할 때만 변경
22. 하단 설정 탭을 정산 탭으로 전환하고 설정은 상단 바로가기 제공
23. 정산 페이지 총 지출 / 팀별 결제·부담·잔액 / 최소 송금안 계산
24. 식단 준비항목 금액 자동 정산 반영
25. 준비물 금액 자동 정산 반영
26. 현장 직접지출 추가 / 수정 / 삭제
27. 직접지출 정산 대상 팀 선택
28. 공유 링크 첫 진입 시 1회 팀 선택 UX
29. `공용` placeholder를 첫 진입 팀 선택 대상에서 제외
30. 선택한 팀을 `camp:myMemberId` + 기존 `camp:myName`에 저장하고 재방문 시 유지
31. 홈에 `내 준비` 카드 추가: 남은 수 / 완료율 / 미완료 항목 미리보기
32. `내 준비` 카드에서 준비물 화면의 해당 팀 필터로 바로 이동
33. 기존 사용자의 저장된 팀 이름을 새 팀 ID 방식으로 자동 연결
34. 팀 선택 없이도 `그냥 둘러보기` 가능
35. 홈의 `아직 안 챙긴 것` 섹션을 화면에서 제거하고 상세 미완료 목록은 준비물 탭에 집중
36. 홈 준비 정보 순서를 `전체 준비 현황 → 내 준비 → 담당자별 준비율`로 묶어 정보 흐름 통합
37. `다음 식사`를 준비 정보 뒤의 독립 섹션으로 분리
38. 같은 날짜의 다음 식사가 있으면 `1차 → 2차`로 연속 표시, 없으면 다음 식사를 `다음 일정`으로 표시
39. 기존 홈 렌더러가 다음 식사 카드를 다시 그려도 강화 카드가 최종 상태를 유지하도록 렌더 경쟁 방어
40. Home dashboard 전용 자동 smoke test 추가
41. Preparation Hub QA를 Firebase 초기 동기화 완료 후 검증하도록 안정화
42. 홈 `준비 현황`, `내 준비`, `담당자별 준비율` 계산 기준을 모두 `일반 준비물 + 식단 준비항목` 통합 기준으로 통일
43. 담당자별 준비율과 `내 준비` 카드가 동일한 완료수/전체수를 표시하는지 자동 QA 추가
44. 다음 식사 카드의 준비물 상세 나열과 중복 퍼센트 정보를 제거하고 메뉴 중심 정보 계층으로 재설계
45. 식사 카드에서 `1차/2차`, 날짜·식사 타입, 메뉴, 메모, 담당자, `준비 x/y`만 남겨 빠르게 읽히도록 정리

## 정산 MVP 규칙
- 준비물/식단 준비항목의 `결제자`는 입력 부담을 줄이기 위해 기본적으로 `담당자`를 자동으로 따라간다.
- 다른 팀이 대신 결제한 경우에만 결제자를 변경한다.
- 준비물/식단에서 금액을 수정하면 정산 페이지가 같은 원본 데이터를 다시 계산하므로 자동 반영된다.
- 준비물/식단 금액은 현재 전체 실제 팀에 균등 분담한다.
- 직접입력 지출은 정산 대상 팀을 선택할 수 있다.
- `공용` 같은 placeholder 팀은 실제 결제자/정산 인원에서 제외한다.
- 1원 단위 나눗셈 오차는 팀 순서대로 1원씩 배분해 합계가 정확히 맞도록 계산한다.

## 첫 진입 / 홈 UX 규칙
- `trip` 공유 링크로 들어왔고 아직 팀을 정하지 않은 기기에서만 팀 선택 화면을 보여준다.
- 여러 장의 온보딩 대신 한 화면에서 팀 하나만 고르게 한다.
- 기존 팀 선택 정보가 있으면 온보딩 없이 바로 홈으로 진입한다.
- 선택한 팀 기준의 일반 준비물 + 식단 준비항목을 합쳐 `내 준비` 현황을 보여준다.
- 홈의 전체 준비율과 담당자별 준비율도 같은 통합 준비항목 기준을 사용한다.
- 홈은 준비 관련 정보를 먼저 하나의 흐름으로 끝낸 뒤 식사 정보로 넘어간다.
- 미완료 준비물 개별 목록은 홈에서 반복하지 않고 준비물 탭에서 확인한다.
- 다음 식사 카드는 준비 진행률을 설명하는 카드가 아니라 `무엇을 먹는지`를 우선 보여주는 메뉴 카드로 사용한다.
- 다음 식사 카드에는 1차뿐 아니라 같은 날 이어지는 2차 정보까지 함께 보여준다.
- 선택 화면은 모바일에서 내부 스크롤이 가능하고 배경만 고정한다.

## 현재 자동 QA
- Header smoke: PASS
- Responsive smoke: PASS
- First entry smoke: PASS
- Home dashboard smoke: PASS
- Preparation Hub smoke: PASS
- Packing cost smoke: PASS
- Settlement / payer smoke: PASS
- Two-client realtime sync smoke: PASS
- Real app meal smoke: PASS
- GitHub Pages build/deploy: PASS

## 현재 남은 핵심 검증
자동 QA와 Pages 배포는 통과했다. 실제 iPhone 화면에서 `전체 준비 현황 → 내 준비 → 담당자별 준비율 → 다음 식사`의 스크롤 리듬과 1차/2차 메뉴 카드의 정보 밀도를 직접 확인한다. 이후 실제 캠핑 데이터의 담당자/금액을 최종 점검하고 네트워크 전환·백그라운드 복귀까지 포함한 실기기 QA를 진행한다.

## 다음 스프린트 후보
1. 실제 iPhone에서 홈 v3 시각/스크롤 리뷰
2. 실제 캠핑 데이터 최종 입력 / 담당자 / 금액 점검
3. 다음 식사 1차/2차 카드의 메뉴 표현 미세조정
4. 오프라인/재연결 UX 점검
5. 2026-09-11~13 실사용 전 최종 안정화
