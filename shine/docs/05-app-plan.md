# 05. Shine 앱 전환 계획

## 결정 (2026-11-19): 비용 없는 방향 → claude.ai 기반 유지

Sean 결정: 추가 비용이 없는 방향으로 간다. Shine은 Sean 혼자 쓰는 개인 도구다(팀·고객용 제품 계획 없음).

- Shine은 계속 claude.ai 위에서 운영한다. 저장소, Shine AI, Gmail·캘린더 연동, 예약 작업, 핸드폰 알림이 모두 기존 구독 안에서 돌아가 추가 비용이 없다.
- 자체 앱(아래 A, B)은 Shine AI를 Claude API로 바꿔야 해서 사용량 비용이 생기므로 보류한다. 무료 AI로 바꾸는 방법은 업무 메일이 학습에 쓰일 수 있어 쓰지 않는다.
- 앱처럼 쓰는 방법:
  1. claude.ai 사이드바에 Shine 고정 (완료)
  2. iPad Safari에서 Shine 링크 → 공유 → "홈 화면에 추가" (아이콘으로 바로 실행)
  3. iPad 설정 → 디스플레이 및 밝기 → 자동 잠금 "안 함" (책상 옆 상시 화면)
- 나중에 비용을 들일 수 있게 되면 아래 A → B 경로로 전환한다. 화면 코드는 그대로 재사용한다.

---

## 참고: 유료 전환 시 계획 (보류)

목표: claude.ai 위에서 도는 지금의 Shine을, iPad와 iPhone에 설치하는 진짜 앱으로 만든다.

## 선택지

| 방식 | 내용 | 장점 | 단점 | 기간 · 비용 (추정) |
|---|---|---|---|---|
| A. 설치형 웹앱 (PWA) | 자체 도메인에 올린 웹앱. Safari "홈 화면에 추가"로 설치 | 앱처럼 전체 화면, 아이콘, 푸시 알림(iOS 16.4+), App Store 심사 없음 | 로그인, DB, AI, Google 연동을 직접 구축해야 함 | 2~4주 · 월 $20~50 (호스팅 + Claude API 사용량) |
| B. 네이티브 앱 (A를 Capacitor로 감싸기) | A의 화면을 iOS 앱으로 포장. TestFlight 또는 App Store 배포 | 진짜 앱, 알림 안정적, 홈 화면 위젯 추가 가능 | Mac + Xcode 필요, Apple 개발자 계정 연 $99, 배포 심사 | A 이후 +2~3주 |
| C. 지금 방식 유지 (claude.ai) | 홈 화면 바로가기 | 비용·작업 없음 | claude.ai 로그인 필요, 알림은 예약 작업으로만 | 0 |

## 추천 경로: A → B

1. **A로 먼저 전환한다.** 지금 앱 화면(`app/shine.html`)은 그대로 쓰고, claude.ai가 대신해주던 부분만 바꾼다.

   | 지금 (claude.ai) | 앱 전환 후 |
   |---|---|
   | 저장소 (db) | Supabase (Postgres + 실시간 구독) |
   | Shine AI (sample) | 서버에서 Claude API 호출 (키는 서버에만 보관) |
   | Gmail · Google Calendar 커넥터 | Google OAuth + Gmail/Calendar API |
   | 음성 입력 | Safari 음성 인식 (Web Speech API) |
   | 예약 작업 (아침 브리핑) | 서버 예약 작업 (Vercel Cron 등) + 웹 푸시 알림 |

2. **B로 포장한다.** A가 안정되면 Capacitor로 iOS 앱을 만들고, 우선 TestFlight로 Sean의 기기에만 설치한다. 홈 화면 위젯(오늘 일정, 중요한 일)은 이 단계에서 추가한다.

## 꼭 알아둘 점

- **Gmail 권한 심사:** Gmail 읽기 권한은 Google이 "제한된 범위"로 분류한다. 외부 사용자에게 공개하는 앱은 Google 보안 심사(CASA)가 필요해서 수주와 비용이 든다. **glozinc.com Google Workspace 안에서만 쓰는 "내부(Internal)" 앱으로 등록하면 이 심사가 필요 없다.**
- **개인 Gmail:** 내부 앱은 glozinc.com 계정만 로그인된다. 개인 메일은 지금처럼 업무 계정으로 자동 전달하는 방식을 유지한다.
- **데이터 이전:** 지금 claude.ai 저장소의 일정, 할 일, 메모는 내보내기 후 Supabase로 옮긴다.

## 결정이 필요한 것

- [x] 사용자 범위: Sean 혼자 사용 (2026-11-19 결정). 여러 사용자 구조는 만들지 않는다.
- [ ] 앱 도메인 (예: shine.glozinc.com)
- [ ] Apple 개발자 계정 (개인 또는 GloZ 법인)
