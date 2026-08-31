# PM / Implementation Status

- Project: Camping Planner WebApp
- Version: v0.5.1
- Previous phase: Planning v1.0 DONE
- Current mode: 첫 진입 UX 구현 + QA 완료 → PM 모드 복귀
- Current implementation status: LIVE FIREBASE MVP + PREPARATION HUB + SETTLEMENT MVP + FIRST ENTRY UX + AUTOMATED REGRESSION PASS
- Firebase realtime mode: ENABLED
- Two-client realtime sync: AUTOMATED QA PASS
- GitHub Pages deployment: PASS
- Next recommended mode: 실사용 데이터 점검 → 모바일 실기기 UX 리뷰 → 최종 안정화

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

## 정산 MVP 규칙
- 준비물/식단 준비항목의 `결제자`는 입력 부담을 줄이기 위해 기본적으로 `담당자`를 자동으로 따라간다.
- 다른 팀이 대신 결제한 경우에만 결제자를 변경한다.
- 준비물/식단에서 금액을 수정하면 정산 페이지가 같은 원본 데이터를 다시 계산하므로 자동 반영된다.
- 준비물/식단 금액은 현재 전체 실제 팀에 균등 분담한다.
- 직접입력 지출은 정산 대상 팀을 선택할 수 있다.
- `공용` 같은 placeholder 팀은 실제 결제자/정산 인원에서 제외한다.
- 1원 단위 나눗셈 오차는 팀 순서대로 1원씩 배분해 합계가 정확히 맞도록 계산한다.

## 첫 진입 UX 규칙
- `trip` 공유 링크로 들어왔고 아직 팀을 정하지 않은 기기에서만 팀 선택 화면을 보여준다.
- 여러 장의 온보딩 대신 한 화면에서 팀 하나만 고르게 한다.
- 기존 팀 선택 정보가 있으면 온보딩 없이 바로 홈으로 진입한다.
- 선택한 팀 기준의 일반 준비물 + 식단 준비항목을 합쳐 `내 준비` 현황을 보여준다.
- 홈의 기존 `다음 식사` 영역은 바로 아래에 유지해 `내가 챙길 것`과 `다음에 먹을 것`을 첫 화면에서 빠르게 파악하게 한다.
- 선택 화면은 모바일에서 내부 스크롤이 가능하고 배경만 고정한다.

## 현재 자동 QA
- Header smoke: PASS
- Responsive smoke: PASS
- First entry smoke: PASS
- Preparation Hub smoke: PASS
- Packing cost smoke: PASS
- Settlement / payer smoke: PASS
- Two-client realtime sync smoke: PASS
- Real app meal smoke: PASS
- GitHub Pages build/deploy: PASS

## 현재 남은 핵심 검증
자동 QA는 통과했다. 실제 공유 링크를 새 브라우저 또는 다른 iPhone/iPad에서 열어 실제 팀 이름이 보이는지, 팀 선택 → 홈 `내 준비` → 담당 준비물 이동 흐름의 터치 감각을 한 번 확인한다. 그 뒤 네트워크 전환/백그라운드 복귀까지 포함한 실기기 최종 QA를 진행한다.

## 다음 스프린트 후보
1. 실제 공유 링크 첫 진입 실기기 확인
2. 실제 캠핑 데이터 최종 입력 / 담당자 / 금액 점검
3. 첫 진입 뒤 홈 정보 밀도와 `내 준비` 카드 UI 미세조정
4. 오프라인/재연결 UX 점검
5. 2026-09-11~13 실사용 전 최종 안정화
