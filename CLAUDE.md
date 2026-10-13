# studylog — 호호의 지식 지도

> **이어서 작업할 때: `tasks/handoff-studylog-2026-10-13.md`를 먼저 읽는다** (상태·결정·다음 할 일). PRD는 `tasks/prd-studylog.md` (11절 구현 메모).
> `tasks/`는 PC 경로·연동 계획이 있어 git에서 제외 — Dropbox에만 있다.
> 사용자 호칭은 "호호". UI는 흰 배경 라이트 테마. 등록 페이지를 말할 때는 항상 주소(http://127.0.0.1:4750/admin/)를 함께 쓴다 — 호호가 "등록 페이지"와 admin을 헷갈려 했다.

공부·연구·강의 결과물(GitHub Pages 사이트, HTML 슬라이드, PDF)을 **주제별로 모아 보는 정적 사이트**.
배포: https://kwonsuhyeon.github.io/studylog/ (GitHub Pages, main 브랜치 `/docs`).
papers-wiki(논문 한 편 단위)와 달리 studylog는 **주제 단위**다. 결과물 본문은 복사하지 않고 URL로 가리킨다.
**studylog는 papers-wiki와 연결되어 있다** — 아래 "papers-wiki 연결" 절 참고.

## 주소

| 이름 | 주소 | 용도 |
|---|---|---|
| 등록 페이지 (admin) | http://127.0.0.1:4750/admin/ | 자료·주제 추가·수정, "게시"(git push), buildwork 내보내기 — 이 PC에서만 |
| 로컬 미리보기 | http://127.0.0.1:4750/ | 공개 사이트와 같은 화면 + 논문 노트·원문 PDF 링크 |
| 공개 사이트 | https://kwonsuhyeon.github.io/studylog/ | 보기만, 어디서든 |
| papers-wiki | http://127.0.0.1:4711/ | 논문 노트 (studylog가 읽어 감) |

서버는 `C:\Users\user\Dropbox\2026_phd\sh_wiki\wiki-start.bat`로 다른 wiki들과 함께 켜진다 (탭은 /admin/). 끌 때는 `wiki-stop.bat`.

## 실행

| 명령 | 하는 일 |
|---|---|
| `node serve.js` | 로컬 미리보기 + 등록 페이지 `http://127.0.0.1:4750/admin/` (포트 `STUDYLOG_PORT`) |
| `node build.js` | `topics/`·`items/` -> `docs/` (등록 페이지에서 저장하면 자동 실행) |
| `node check.js` | 원본 검증만 |
| `node publish.js [--apply]` | `public: true` 자료를 buildwork.kr Notion으로 (기본 미리보기) |
| `npm test` | 단위·API 테스트 (테스트 서버 4760~) |
| `npm run test:e2e` | 헤드리스 Chrome E2E (테스트 서버 4761, 임시 데이터) |

외부 의존성 없음 (Node 20 기본 모듈만). `node_modules` 없음.
코드를 고친 뒤 순서: `npm test` → `npm run test:e2e` → 사용자 서버(4750) 재시작 → 화면 확인. 재시작은 4750 프로세스를 끈 뒤 `node C:\Users\user\Dropbox\2026_phd\sh_wiki\start-wiki.js --no-open`.

## 구조

- `topics/<id>.md` 주제 — frontmatter `title`, `parent`(2단계까지), `papers`(papers-wiki 태그), `updated`, `color`. 본문 절: `## 한 줄 정의` · `## 지금까지 정리한 것` · `## 이어서 정리할 것`(체크리스트)
- `items/<id>.md` 자료 — `title`, `section`(study|lecture), `topics`[], `kind`(site|slide|repo|pdf|note), `url`, `date`, `course`, `tags`, `public`, `source`(로컬 원본 상대 경로)
- `private/` 비밀글 원본 (**git 제외**, Dropbox로만 백업). 빌드 시 `.env.local`의 `STUDYLOG_PIN`으로 AES-GCM 암호화해 `docs/secret.json`에만 들어감
- `assets/<자료id>/` 로컬 슬라이드·PDF 사본 (공개 자료가 쓰는 것만 `docs/assets/`로 복사)
- `docs/` 빌드 결과 — **직접 고치지 않는다**
- `lib/` md(파서·렌더) · store(읽기·검증·저장) · pages(템플릿) · papers(papers-wiki 읽기) · secret · candidates(등록 후보) · buildwork(Notion) · fsutil(Dropbox 잠금 재시도)
- `site/` 배포본 CSS·JS, `admin/` 등록 페이지 (배포본에 안 들어감)
- `tasks/` PRD·인계 문서 (git 제외)

## papers-wiki 연결

studylog는 papers-wiki(`C:\Users\user\Dropbox\2026_phd\sh_wiki\papers-wiki`, 포트 4711)와 세 가지로 연결된다.

### 1. 관련 논문 자동 연결 (태그 기반)

- 주제 frontmatter `papers: [태그, …]` ↔ papers-wiki 노트 frontmatter `tags: [...]`. 하나라도 겹치면 그 노트가 주제 페이지의 **"관련 논문"** 목록에 들어간다. 상위 주제 페이지는 하위 주제의 논문까지 합친다. 주제 카드에는 "논문 n".
- 읽는 위치: `studylog.config.json`의 `papersDir` = `C:/Users/user/Dropbox/2026_phd/sh_wiki/papers-wiki/wiki/sources`. 비우면 연결 안 함.
- 읽는 필드: `title`, `authors`, `year`, `tags`, `pdf` (코드: `lib/papers.js`). **papers-wiki 노트 frontmatter 형식이 바뀌면 이 파일도 고쳐야 한다.**
- 반영 시점: studylog **빌드할 때**(등록 페이지 저장·게시, `node build.js`, 서버 시작). papers-wiki에 노트를 추가해도 studylog를 다시 빌드하기 전에는 안 보인다.
- 태그 편집: 등록 페이지 → 주제 관리 → "papers-wiki 태그" 칸.

현재 매핑 (2026-10-13):

| studylog 주제 | papers 태그 | 연결된 노트 |
|---|---|---|
| 온톨로지 `ontology` | 온톨로지, 지식그래프 | 7 |
| 인과효과 `causal` | 인과추론, 인과그래프, 구조적인과모형 | 11 |
| 학습분석 `la` | 학습분석 (+ 하위 주제 합산) | 20 |
| 지식추적 `kt` | 지식추적 | 6 |
| 인지진단 `cdm` | 인지진단모형, Q행렬 | — |
| 자동문항생성 `aig` | 자동문항생성 | — |
| 통계 `stats` | 기초통계, 통계 | — |
| 페르소나 `persona` | (맞는 태그 없음) | 0 |

### 2. 공개 범위 (저작권)

| 어디서 여나 | 관련 논문에 보이는 것 |
|---|---|
| 공개 사이트 | 제목 · 저자 · 연도만 (HTML에 노트 내용·PDF 경로 없음 — 테스트로 확인) |
| 이 PC (`127.0.0.1`/`localhost`) | `site/app.js`가 제목을 papers-wiki 노트 링크(`4711/#노트id`)로, "원문 PDF ↗" 링크(`4711/pdf/파일명`)를 붙인다 |

노트 내용과 원문 PDF는 절대 `docs/`나 `assets/`에 넣지 않는다 (저작권). 저작권 있는 논문·교재 PDF는 자료로 등록하지 않는다.

### 3. 본문 안 논문 링크 `[[papers:노트id|라벨]]`

- 주제 요약 본문에 `[[papers:노트id]]` 또는 `[[papers:노트id|라벨]]`. 표 안에서는 `\|`로 쓴다.
- 이 PC에선 papers-wiki 노트로 연결, 공개 사이트에선 링크 없는 글자로 바뀐다.
- sh_wiki 공통 규약(`sh_wiki/CLAUDE.md`)의 `[[papers:id]]` 표기와 같다. 화살표 `->`·`=>` 변환도 같다.
- 주제 요약 초안을 쓸 때 출처: papers-wiki 계보 파일 `papers-wiki/wiki/lineages/{kt,cdm,causal}.md`와 노트의 "📌 AI 요약"·"✍️ 내 메모". 온톨로지 요약은 노트 7편(Gruber 1993, Garijo 2020, 류 2022, Shin 2026, 김말희 2025, 강의 1주차 S01·S02)으로 썼다. **요약을 쓰기 전에 papers-wiki에서 해당 태그 노트를 먼저 찾는다** (처음에 온톨로지를 빈칸으로 만들었다가 호호가 지적함).

## 규칙

- 서버는 `127.0.0.1` 전용. 쓰기 API는 같은 출처 요청만 받고, UTF-8이 아닌 요청은 거부한다.
- 비밀글에는 `assets/` 파일을 붙이지 않는다 (공개 저장소에 평문으로 올라감).
- 커밋·push·Notion 반영은 호호 확인 뒤에. 등록 페이지의 "게시"·"buildwork로 내보내기"도 확인창을 거친다.
- Windows Git Bash에서 curl로 한글 JSON을 보내면 CP949로 깨진다 — 스크립트로 API를 부를 땐 Node `fetch`를 쓴다.
- 검색엔진 노출 `indexable`은 지금 false. 자료가 쌓이거나 블로그로 알리고 싶다는 얘기가 나오면 켤지 물어본다.
- 한글 산문(주제 요약 등)은 humanize-korean 스킬(Fast)로 윤문한다.

## 디자인 (2026-10-13 개편)

- buildwork.kr과 같은 계열: 남색(#0F172A) 헤더 + 흰 본문 + 에메랄드(#10B981) 강조. Pretendard, 숫자·날짜는 mono.
- 첫 화면은 소개(히어로) 없이 헤더 바로 아래 주제 카드부터 — 회사 소개 페이지가 아니라 내 자료를 찾는 곳 (호호 의견). 주제·자료 페이지만 남색 머리 영역에 제목·정의.
- 카드는 전체 클릭 (`.stretch::after`), 칩·열기 버튼은 `z-index`로 따로 눌림.
- 주제 페이지 순서: 지금까지 정리한 것(+ 오른쪽 "이어서 정리할 것") → 관련 논문 → 자료. 0건 묶음은 숨긴다.
- 문구는 쉬운 말로: 정렬 "최근순", "최근 수정", "n일째 수정 없음". 지어낸 표현(예: "손댄 순") 쓰지 않기.
