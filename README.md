# OX 퀴즈

카훗처럼 진행자 화면에 문제를 띄우고 학생들이 휴대폰으로 O/X를 고르는 실시간 퀴즈입니다.
GitHub Pages와 Firebase Realtime Database로 돌아갑니다.

## 사용법
- 진행자: `host.html`을 큰 화면에 띄우면 6자리 PIN이 나옵니다.
- 참가자: 휴대폰으로 `play.html`에 들어가 PIN과 닉네임을 입력합니다.
- 맞히면 500점, 빨리 맞힐수록 최대 500점이 더해집니다. 문제당 10초.

## 문제 바꾸기
`js/questions.js`의 `questions` 배열을 고치면 됩니다. 제한 시간은 `TIME_LIMIT`.

## Firebase 설정
1. Firebase 콘솔에서 Realtime Database를 만듭니다.
2. 웹 앱을 등록하고 나온 `firebaseConfig` 값을 `js/config.js`에 붙여 넣습니다.
3. Realtime Database → 규칙 탭에 아래 규칙을 넣고 게시합니다.

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "games": {
      "$pin": { ".read": true, ".write": true }
    }
  }
}
```

`games` 아래만 누구나 읽고 쓸 수 있는 수업용 규칙입니다. 지난 게임 기록은 콘솔에서 `games`를 지우면 정리됩니다.
