# Shine

Sean의 개인 비서이자 업무 허브. 한 줄로 적거나 말하면 Shine이 일정, 할 일, 메모로 정리하고, 메일 브리핑과 Google 캘린더 미팅 생성까지 처리한다. iPad를 책상 옆에 두고 쓰는 것을 기본으로 설계했다.

## 바로가기

| 항목 | 링크 |
|---|---|
| 앱 (실사용) | https://claude.ai/artifact/EjSBhP3q1PoMKbbhSgu8As |
| 초기 기획서 (Claude Docs) | https://claude.ai/artifact/8Tr8DEyKPyK8P8LLbVACsM |

두 링크 모두 비공개다. Sean 계정으로 claude.ai에 로그인해야 열린다.

## 현재 상태 (v14, 2026-11-19)

| 기능 | 상태 |
|---|---|
| 한 줄 입력 → 일정 / 할 일 / 메모 자동 분류 | 완료 |
| 음성 입력 | 완료 (Chromium 브라우저, 데스크톱 앱) |
| 미팅 메모 정리 (요약, 후속 액션, 다음 미팅) | 완료 |
| 오늘의 흐름 일 / 주 / 월 보기 | 완료 |
| 업무 / 개인 필터 | 완료 |
| 중요도 (★) 와 첫 화면 "중요한 일" 카드 | 완료 |
| 왼쪽으로 밀어서 삭제, 중요 항목 삭제 확인, 되돌리기 | 완료 |
| 보관함 (삭제 후 30일 보관, 자동 영구 삭제, 복원) | 완료 |
| 실시간 동기화 표시, 화면 복귀 시 자동 갱신, 메일 1시간마다 자동 확인 | 완료 |
| 메일 브리핑 (Gmail, 10초마다 새 메일 감시, 1시간마다 전체 재분석) | 완료 |
| 메일 중요도 (견적·긴급·계약 등은 높음) 와 분류 태그 | 완료 |
| Google 캘린더 읽기 동기화 (30초마다) | 완료 |
| 미팅 준비 카드와 30분 전 자동 브리핑 | 완료 |
| 메일 답장 초안 → Gmail 임시보관함 저장 (발송은 직접) | 완료 |
| Google 캘린더 미팅 생성 (참석자, 시간대, Meet) | 완료, 실제 생성 결과 확인 전 |
| iPad 가로 / 세로, 핸드폰, 다크 모드 | 완료 |

## 폴더 구성

```
shine/
├── README.md              ← 이 문서. 프로젝트 개요와 바로가기
├── app/
│   └── shine.html         ← 앱 소스 (배포본과 동일)
├── docs/
│   ├── 01-planning.md     ← 기획 요약: 목표, 기능, 구축 방식 결정
│   ├── 02-architecture.md ← 데이터 구조, 연동, AI 프롬프트, 시간대 처리
│   ├── 03-changelog.md    ← 버전별 변경 이력
│   └── 04-roadmap.md      ← 다음 단계와 남은 결정 사항
├── design/
│   ├── design-system.md   ← 색, 글꼴, 레이아웃 규칙
│   └── screenshots/       ← 기기별 화면 캡처
└── scripts/
    ├── test-parser.js     ← 한국어 날짜·시간대 해석 테스트
    ├── swipe-test.js      ← 밀어서 삭제·보관함 동작 테스트
    ├── mail-test.js       ← 메일 중요도·10초 감시 테스트 (Gmail·AI 가짜 응답)
    ├── gcal-test.js       ← Google 캘린더 읽기·미팅 준비 테스트 (가짜 응답)
    ├── draft-test.js      ← 답장 초안 테스트 (가짜 응답)
    └── preview.js         ← 예시 데이터로 기기별 화면 캡처
```

## 앱 수정과 배포 방법

1. `app/shine.html`을 수정한다.
2. 테스트를 돌린다: `node shine/scripts/test-parser.js`
3. 화면을 확인한다: `node shine/scripts/preview.js` (Playwright 필요)
4. Claude에게 "Shine 앱 업데이트해줘"라고 하면, 위 앱 링크(URL 유지)로 다시 배포한다.

데이터는 앱의 저장소(claude.ai)에 있다. 이 파일을 다시 배포해도 일정과 할 일은 지워지지 않는다.
