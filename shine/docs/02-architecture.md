# 02. 구조와 연동

## 구성

Shine은 HTML 파일 하나(`app/shine.html`)로 된 claude.ai 아티팩트다. 별도 서버가 없고, claude.ai가 제공하는 기능(capability)을 쓴다.

| 기능 | 용도 |
|---|---|
| `db` | 일정·할 일·메모(`items`), 메일 브리핑 결과(`mail/latest`) 저장. 접근 규칙: 소유자(Sean)만 읽고 쓰기 |
| `sample` | Shine AI. 한 줄 해석(빠른 모델), 미팅 메모 정리와 메일 분석(기본 모델) |
| `dictation` | 음성 입력 (한국어) |
| `mcp` | Gmail `search_threads`, Google Calendar `create_event` |
| `user` | 사용자 식별 |

저장소에 연결할 수 없는 화면(파일로 직접 열 때 등)에서는 브라우저 로컬 저장소로 대신 동작한다.

## 데이터 구조

모든 항목은 하나의 `items` 컬렉션에 같은 구조로 저장한다. 종류만 다르다.

| 필드 | 예시 | 설명 |
|---|---|---|
| type | task / event / note | 종류 |
| title | 계약서 회신 | 제목 |
| area | work / personal | 업무·개인 |
| priority | high / normal / low | 중요도 |
| date | 2026-11-25 | 마감일 또는 일정 날짜 (내 시간대 기준) |
| time, endTime | 15:00, 16:00 | 일정 시간 (내 시간대 기준) |
| tz, tzDate, tzTime | Asia/Seoul, 2026-11-17, 14:00 | 상대 시간대로 입력한 원래 시각 |
| status, doneAt | open / done | 진행 상태 |
| people, org | ["OOO"], Netflix | 관련 사람·회사 (관련 항목 연결에 사용) |
| attendees | [kim@cjenm.com] | 초대 이메일 |
| gcal | {created, link, meet, attendees, tz} | Google 캘린더 생성 결과 |
| mailUrl | Gmail 링크 | 메일에서 만든 할 일 |
| links | [noteId] | 미팅 메모와 후속 항목 연결 |
| source, raw | Shine 해석, 원문 | 출처와 원문 입력 |
| example | true | 예시 항목 표시 |

`mail/latest` 문서: `checkedAt`, `checkedDay`, `results[]`(id, kind, priority, why, action, due, area, subject, from, url), `dismissed[]`(넘긴 스레드), `personalEmail`.

## 한 줄 입력 처리 순서

1. 로컬 해석기가 즉시 결과를 보여준다 (오늘/내일/요일/다음주 X요일/M월 D일/시각/시간대/이메일/중요 키워드).
2. 동시에 Shine AI가 더 정확한 해석을 보낸다. 도착하면 미리보기를 바꾼다.
3. 사용자가 Enter로 확인해야 등록된다. AI 결과를 기다리지 않고 바로 등록할 수도 있다.

## 시간대 처리

- 일정은 항상 내 시간대(달라스) 기준 `date/time`으로 저장한다. 상대 시간대로 입력했다면 원래 시각을 `tz/tzDate/tzTime`에 같이 남긴다.
- 변환은 브라우저의 `Intl` 시간대 데이터로 계산한다. 서머타임 경계도 반영된다.
- Google 캘린더 생성 시 상대 시간대가 있으면 그 시간대(예: Asia/Seoul)로 만든다. Google이 각자의 시간대로 보여준다.

검증 예: 한국 11/17(화) 14:00 = 달라스 11/16(월) 23:00, 한국 3/9 10:00 = 달라스 3/8 20:00 (CDT 시작 직후).

## 메일 브리핑

1. Gmail에서 최근 4일 받은편지함(광고·소셜 제외)과, 2~10일 전 내가 마지막으로 보낸 스레드를 가져온다.
2. Shine AI가 답장 필요 / 후속 / 마감으로 분류하고 이유와 할 일 제목을 만든다. 뉴스레터, 광고, 무관한 콜드 영업은 뺀다.
3. 결과는 `mail/latest`에 저장한다. 하루 첫 접속(오전 5시 이후)에 자동 실행되고, "지금 확인"으로 다시 돌린다.

## Google 캘린더 미팅 생성

`create_event` 호출 값: `summary`, `startTime`, `endTime`, `timeZone`, `attendees[{email}]`, `addGoogleMeetUrl`, `description`. 결과에서 Meet 링크와 캘린더 링크를 찾아 항목에 저장한다.

**미확인:** 실제 생성 결과 형태는 아직 확인하지 못했다. 첫 미팅을 만든 뒤 Meet 링크가 표시되는지 확인해야 한다.
