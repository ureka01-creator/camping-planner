# Camping Planner WebApp v0.1.0

기획서 v1.0의 첫 구현 단계입니다.

> 현재 배포 빌드: v0.7.8

## 현재 구현
- 모바일 우선 홈 / 식단 / 준비물 / 설정 4탭
- 참여자 CRUD
- 식단 CRUD
- 준비물 CRUD / 완료 체크 / 필터
- 준비율 계산
- 공유 URL `?trip=...`
- 로컬 데모 저장(localStorage) + 같은 기기 탭 간 BroadcastChannel 동기화
- Firebase Firestore + Anonymous Auth 어댑터 스켈레톤

## 실행
정적 파일이라 GitHub Pages에 그대로 올릴 수 있습니다. 로컬 테스트는 프로젝트 폴더에서:

```bash
python3 -m http.server 8080
```

그 후 `http://localhost:8080` 접속.

## Firebase 실시간 동기화 켜기
`js/firebase.js`의 `FIREBASE_CONFIG`를 Firebase Web App 설정값으로 채우고:

```js
export const DATA_MODE = {
  useFirebase: true,
  ...
};
```

Firebase Console에서:
1. Authentication → Anonymous 활성화
2. Firestore Database 생성
3. 아래 Rules 적용

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trips/{tripId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

> v0.1.0은 MVP 속도를 위해 trip 문서 하나에 members/meals/items 배열을 저장합니다. 기획서의 subcollection 구조는 데이터가 커지거나 변경 이력이 필요해질 때 v0.2+에서 분리할 수 있습니다.

## 첫 실시간 검증
- 서로 다른 2개 기기에서 같은 `?trip=...` 링크 열기
- A에서 준비물 체크
- B에서 새로고침 없이 상태 변경 확인
- 식단 수정도 동일하게 확인
