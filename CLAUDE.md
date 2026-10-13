# studylog — 호호의 지식 지도

공부·연구·강의 결과물(GitHub Pages 사이트, HTML 슬라이드, PDF)을 **주제별로 모아 보는 정적 사이트**.
배포: https://kwonsuhyeon.github.io/studylog/ (GitHub Pages, main 브랜치 `/docs`). PRD: `C:\Users\user\Dropbox\2026_phd\sh_wiki\tasks\prd-studylog.md`.
papers-wiki(논문 한 편 단위)와 달리 studylog는 **주제 단위**다. 결과물 본문은 복사하지 않고 URL로 가리킨다.

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

## 구조

- `topics/<id>.md` 주제 — frontmatter `title`, `parent`(2단계까지), `updated`, `color`. 본문 절: `## 한 줄 정의` · `## 지금까지 정리한 것` · `## 이어서 정리할 것`(체크리스트)
- `items/<id>.md` 자료 — `title`, `section`(study|lecture), `topics`[], `kind`(site|slide|repo|pdf|note), `url`, `date`, `course`, `tags`, `public`, `source`(로컬 원본 상대 경로)
- `private/` 비밀글 원본 (**git 제외**, Dropbox로만 백업). 빌드 시 `.env.local`의 `STUDYLOG_PIN`으로 AES-GCM 암호화해 `docs/secret.json`에만 들어감
- 주제 frontmatter `papers: [태그]` → 빌드 시 `studylog.config.json`의 `papersDir`(papers-wiki/wiki/sources)에서 태그가 겹치는 논문 노트를 "관련 논문"으로 연결 (`lib/papers.js`). 공개 HTML엔 제목·저자·연도만, 이 PC에서 열 때만 `site/app.js`가 노트(4711/#id)·원문 PDF(4711/pdf/파일) 링크를 붙인다 — 노트 내용·PDF는 저작권 때문에 배포하지 않는다.
- `assets/<자료id>/` 로컬 슬라이드·PDF 사본 (공개 자료가 쓰는 것만 `docs/assets/`로 복사)
- `docs/` 빌드 결과 — **직접 고치지 않는다**
- `lib/` md(파서·렌더) · store(읽기·검증·저장) · pages(템플릿) · secret · candidates(등록 후보) · buildwork(Notion) · fsutil(Dropbox 잠금 재시도)
- `site/` 배포본 CSS·JS, `admin/` 등록 페이지 (배포본에 안 들어감)

## 규칙

- 서버는 `127.0.0.1` 전용. 쓰기 API는 같은 출처 요청만 받고, UTF-8이 아닌 요청은 거부한다.
- 비밀글에는 `assets/` 파일을 붙이지 않는다 (공개 저장소에 평문으로 올라감).
- 커밋·push·Notion 반영은 호호 확인 뒤에. 등록 페이지의 "게시"·"buildwork로 내보내기"도 확인창을 거친다.
- Windows Git Bash에서 curl로 한글 JSON을 보내면 CP949로 깨진다 — 스크립트로 API를 부를 땐 Node `fetch`를 쓴다.
- 검색엔진 노출 `indexable`은 지금 false. 자료가 쌓이거나 블로그로 알리고 싶다는 얘기가 나오면 켤지 물어본다.

## 디자인 (2026-10-13 개편)

- buildwork.kr과 같은 계열: 남색(#0F172A) 헤더 + 흰 본문 + 에메랄드(#10B981) 강조. Pretendard, 숫자·날짜는 mono.
- 첫 화면은 소개(히어로) 없이 헤더 바로 아래 주제 카드부터 — 회사 소개 페이지가 아니라 내 자료를 찾는 곳 (호호 의견). 주제·자료 페이지만 남색 머리 영역에 제목·정의.
- 카드는 전체 클릭 (`.stretch::after`), 칩·열기 버튼은 `z-index`로 따로 눌림.
- 문구는 쉬운 말로: 정렬 "최근순", "최근 수정", "n일째 수정 없음". 지어낸 표현(예: "손댄 순") 쓰지 않기.
