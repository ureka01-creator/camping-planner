# PM / Implementation Status

- Project: Camping Planner WebApp
- Version: v0.5.0
- Previous phase: Planning v1.0 DONE
- Current mode: 정산 MVP 구현 + QA 완료 → PM 모드 복귀
- Current implementation status: LIVE FIREBASE MVP + PREPARATION HUB + SETTLEMENT MVP + AUTOMATED REGRESSION PASS
- Firebase realtime mode: ENABLED
- Two-client realtime sync: AUTOMATED QA PASS
- GitHub Pages deployment: PASS
- Next recommended mode: 실사용 데이터 점검 → 정산 UX 리뷰 → 다음 개선 선택

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

## 정산 MVP 규칙
- 준비물/식단 준비항목의 `결제자`는 입력 부담을 줄이기 위해 기본적으로 `담당자`를 자동으로 따라간다.
- 다른 팀이 대신 결제한 경우에만 결제자를 변경한다.
- 준비물/식단에서 금액을 수정하면 정산 페이지가 같은 원본 데이터를 다시 계산하므로 자동 반영된다.
- 준비물/식단 금액은 현재 전체 실제 팀에 균등 분담한다.
- 직접입력 지출은 정산 대상 팀을 선택할 수 있다.
- `공용` 같은 placeholder 팀은 실제 결제자/정산 인원에서 제외한다.
- 1원 단위 나눗셈 오차는 팀 순서대로 1원씩 배분해 합계가 정확히 맞도록 계산한다.

## 현재 자동 QA
- Header smoke: PASS
- Responsive smoke: PASS
- Preparation Hub smoke: PASS
- Packing cost smoke: PASS
- Settlement / payer smoke: PASS
- Two-client realtime sync smoke: PASS
- Real app meal smoke: PASS
- GitHub Pages build/deploy: PASS

## 현재 남은 핵심 검증
자동 QA는 통과했다. 실제 캠핑 데이터로 iPhone/iPad에서 정산 화면의 가독성, 금액 입력 흐름, 담당자와 다른 결제자 지정 흐름을 한 번 확인한다.

## 다음 스프린트 후보
1. 실제 캠핑 데이터 기준 정산 결과 검산
2. 준비물/식단 항목별 `정산 대상 팀` 선택 기능이 필요한지 결정
3. 첫 진입 사용성 개선(공유 링크로 들어온 신규 참여자가 1분 안에 이해하도록)
4. 오프라인/재연결 UX 점검
5. 2026-09-11~13 실사용 전 최종 안정화
