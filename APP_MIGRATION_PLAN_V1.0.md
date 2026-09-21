# Camping Planner App Migration Plan v1.0

- Project: Camping Planner
- Migration target: iOS first, Android second
- Base web version: current `main` (Camping Planner v1.0.8 UI)
- Migration branch: `app-migration`
- Live web protection: `main` / GitHub Pages는 앱 마이그레이션 완료 전 변경하지 않는다.
- Native runtime: Capacitor v8
- Backend: existing Firebase project / Firestore
- UI stack: existing HTML / CSS / Vanilla JS 유지
- Status: APP-0 IMPLEMENTATION IN PROGRESS

## 1. 목표

현재 GitHub Pages에서 동작하는 Camping Planner의 기능과 데이터를 그대로 유지하면서 iPhone/Android에 설치 가능한 앱으로 확장한다.

핵심 원칙은 **웹앱 재작성 금지**다. 현재 화면, 정산, 식단, 준비물, 게시판, 실시간 Firebase 데이터 구조를 최대한 그대로 사용하고 네이티브에서 필요한 부분만 어댑터 계층으로 분리한다.

최종 구조:

```
                  ┌─ GitHub Pages (기존 웹)
Shared Web Core ──┼─ iOS / Capacitor
                  └─ Android / Capacitor
                         │
                         └─ Existing Firebase
```

## 2. 현재 코드 기준 분석

### 그대로 사용할 것
- `index.html`
- `css/*`
- 대부분의 `js/*` 화면/업무 로직
- Firebase Firestore 데이터
- trip / members / meals / items / expenses 구조
- 실시간 동기화
- 정산 계산 로직
- 홈/식단/준비물/정산 UI
- 기존 QA 시나리오

### 앱 전용 대응이 필요한 것
1. Google 로그인
   - 현재: Firebase Web Auth의 popup/redirect
   - 앱: 네이티브 Google 로그인 결과를 Firebase credential로 연결
   - Web은 기존 로그인 경로 유지
2. Safe Area
   - iPhone Dynamic Island / Home Indicator 영역 검증
3. 키보드
   - 모달 입력 중 viewport/스크롤/키보드 닫힘 동작 검증
4. 앱 lifecycle
   - background → foreground 복귀 시 Firebase 연결 상태 검증
5. 외부 링크/공유
   - Web Share / Clipboard fallback을 native 환경에서도 확인
6. Android back button
   - 열린 모달 → 현재 화면 → 앱 종료 순서로 처리
7. 앱 아이콘 / launch screen
8. App Store / Play Store metadata 및 privacy 항목

## 3. 중요한 현재 코드 특성

현재 Firestore는 앱과 웹이 같은 Firebase project를 사용하면 데이터를 그대로 공유할 수 있다.

현재 `js/firebase.js`는 Firebase Web SDK를 동적 import하고 Firestore 실시간 listener를 사용한다. 이 부분은 앱 초기 버전에서도 그대로 유지한다. 네이티브 Firebase SDK로 전면 재작성하지 않는다.

현재 Google 로그인은 `js/google-login.js`에서 `signInWithPopup` / `signInWithRedirect`를 사용한다. 이 부분만 환경에 따라 분기한다.

권장 분리:

```
js/auth/
  auth-web.js
  auth-native.js
  auth.js
```

`auth.js`가 실행 환경을 판별해 Web 또는 Native 구현을 선택한다.

## 4. 개발 단계

### Phase A — 보호 브랜치 + 앱 빌드 기반
목표: 기존 웹에 영향 없이 Capacitor 프로젝트가 생성 가능한 상태.

- [x] `app-migration` branch 생성
- [x] Migration Plan v1.0 작성
- [x] Node/npm project scaffold
- [x] Capacitor v8 dependency scaffold
- [x] `capacitor.config.*` 작성
- [x] Web asset staging/build script 작성
- [ ] 기존 GitHub Pages smoke test가 그대로 통과하는지 확인

**완료 조건**
- `main`은 변경 없음
- 앱용 branch에서 web asset을 Capacitor가 읽을 수 있음
- 기존 웹을 브라우저에서 실행했을 때 기능 변화 없음

### Phase B — iOS shell
목표: Xcode에서 현재 Camping Planner 화면이 설치/실행됨.

- [ ] `@capacitor/ios`
- [ ] iOS project 생성
- [ ] Bundle ID 설정
- [ ] Safe Area 검증
- [ ] iPhone 실기기 실행
- [ ] 홈 / 식단 / 준비물 / 정산 navigation 검증

초기 Bundle ID 후보:
`com.ureka01.campingplanner`

앱스토어 등록 전에 최종 확정한다.

### Phase C — 로그인
목표: iOS 앱에서 같은 Firebase 사용자/데이터 사용.

- [x] platform detection 추가
- [ ] Web Google login 기존 동작 보존
- [ ] Native Google authentication 구현
- [ ] Google ID token → Firebase credential
- [ ] 로그인 유지
- [ ] 로그아웃
- [ ] 앱 재실행 후 session 복구
- [ ] 웹 ↔ 앱 동일 trip 실시간 동기화 검증

### Phase D — iOS 실사용 QA
실제 iPhone 기준 아래를 모두 통과해야 한다.

- [ ] 첫 실행 / 로그인
- [ ] 랜딩 화면
- [ ] 팀 선택
- [ ] 준비물 추가/수정/체크
- [ ] 식단 추가/수정
- [ ] 게시판
- [ ] 정산
- [ ] 앱 background 1분 후 복귀
- [ ] Wi-Fi ↔ LTE/5G 전환
- [ ] 강제 종료 → 재실행
- [ ] 키보드가 열린 상태의 모달
- [ ] 화면 회전 정책 확인
- [ ] 외부 링크 / 복사 / 공유

### Phase E — App Store 준비
- [ ] Apple Developer identifier
- [ ] App icon
- [ ] Launch screen
- [ ] Privacy Policy
- [ ] App Privacy questionnaire
- [ ] TestFlight
- [ ] App Review 제출

주의: iOS에서 Google 같은 타사 로그인으로 사용자의 주 계정을 인증하면 Apple App Review Guideline 4.8을 검토해야 한다. 현재 앱 구조에서는 App Store 공개 배포 전에 Apple 요구 조건에 맞는 동등한 로그인 옵션을 설계 단계에서 반드시 확인한다.

### Phase F — Android
iOS 버전 안정화 후 동일 web core로 Android shell을 추가한다.

- [ ] `@capacitor/android`
- [ ] Android project 생성
- [ ] Google login
- [ ] Android back button
- [ ] notification permission/version 대응
- [ ] internal testing
- [ ] Play Console 배포

## 5. 웹과 앱의 코드 공유 규칙

다음 규칙을 지킨다.

1. 기능 로직을 iOS 코드에 복제하지 않는다.
2. 일반 UI 변경은 기존 HTML/CSS/JS에서 한다.
3. 네이티브 기능만 `native adapter`를 통해 호출한다.
4. Web fallback은 항상 유지한다.
5. Firebase 데이터 schema는 앱화 때문에 변경하지 않는다.
6. schema 변경이 필요한 기능은 별도 migration으로 취급한다.

예:

```js
if (isNativeApp()) {
  // native share
} else {
  // Web Share API / clipboard
}
```

## 6. QA 하네스

기존 QA를 버리지 않고 2단으로 확장한다.

### Web regression
기존 GitHub Actions / browser smoke:
- responsive
- first entry
- home dashboard
- preparation hub
- settlement
- realtime sync
- meal
- admin

### Native QA
실기기 중심:
- install / launch
- auth
- safe area
- keyboard
- lifecycle
- network switch
- deep link/share
- Firebase sync

변경 순서:

```
기획 → 구현 → Web 회귀 QA → Native QA → 리뷰 → main 반영
```

Native QA가 실패하면 `main`에는 merge하지 않는다.

## 7. 첫 번째 구현 Sprint

### Sprint APP-0
범위:
- package.json
- Capacitor v8 dependency
- Capacitor config
- mobile web asset build/staging script
- 플랫폼 감지 module
- iOS project 생성 직전까지 자동화

이 단계에서는 기존 로그인/Firestore 구현을 건드리지 않는다.

### Sprint APP-1
범위:
- iOS project 생성
- Simulator/실기기 boot
- 화면 regression
- Safe Area 수정

### Sprint APP-2
범위:
- Native Google login
- Firebase auth 연동
- lifecycle/reconnect

## 8. 완료 정의

앱 마이그레이션 v1의 완료 조건:

- 기존 GitHub Pages 기능 유지
- iPhone 설치 가능
- 동일 Firebase 데이터 공유
- 로그인/로그아웃 정상
- 실시간 동기화 정상
- 기존 핵심 기능 regression 없음
- background/foreground 안정
- TestFlight 배포 가능
- Android 확장이 가능한 동일 web core 구조 유지

## 9. 지금 다음 작업

다음 모드는 **구현자 모드 / Sprint APP-0**.

앱 빌드 기반 파일 추가 완료. 다음은 CI build 확인 후 iOS shell 생성으로 넘어간다.
