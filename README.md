# zoo3323.github.io

NamJuKim의 1인 개발자 개발 기록입니다. <https://zoo3323.github.io>

`main`에 올린 파일을 GitHub Pages가 그대로 내보냅니다. HTML은 `tool/build.py`가 앱 정보 파일에서 만들어 내고, 만든 결과를 함께 올립니다.

## 구성

| 경로 | 내용 |
|---|---|
| `tool/site.json` | 개발자 이름, 이름 아래 소개 한 줄, 주소, 앱 페이지를 만들 앱(이 순서가 「다른 작업」·「만든 것」의 순서) |
| `tool/shelf.json` | 첫 화면 맨 위의 스티커 묶음(만든 사람)과 진열대의 칸(개인 프로젝트, 회사 프로젝트, 대회·창업), 칸마다 거는 물건 |
| `tool/apps/<앱>/app.json` | 앱 한 개의 정보(이름, 색, 버전, 플랫폼, 설명) |
| `tool/apps/<앱>/pack.html` | 진열대의 봉지 속에 넣을 물건 |
| `tool/apps/<앱>/preview.html` | 앱 페이지의 「미리보기」 |
| `tool/apps/<앱>/demo.html` | (있으면) 미리보기 아래의 따로 해 보는 구역 |
| `tool/about.json` | 소개 페이지 `/about/`의 내용(경력·학력·자격증·회사 프로젝트·대회·창업) |
| `tool/build.py` | 위 파일들로 HTML을 만든다 |
| `index.html`, `<앱>/index.html`, `work/<이름>/index.html`, `about/index.html`, `404.html` | 만들어진 결과. 직접 고치지 않는다 |
| `assets/site.css` | 화면 전체의 모양 |
| `assets/wall.js`, `light.js` | 봉지의 흔들림, 빛(PC는 마우스를 따르는 등빛과 봉지의 반사·무지개 결, 안드로이드 폰은 기울기를 따르는 봉지의 반사) |
| `assets/aisle.js` | 첫 화면 진열대 줄을 미는 화살표 단추 |
| `assets/shots.js` | 미리보기 화면을 눌러 크게 보기 |
| `assets/pet.js`, `closet.js` | 포켓펫 꺼내 보기, 옷 분류 딱지 |
| `assets/img/`, `assets/fonts/` | 그림과 글꼴 |

첫 화면은 마트 진열대처럼 칸으로 나뉜 벽에 고리로 건 봉지들이고, 봉지를 누르면 나오는 앱 페이지는 앱 장터의 앱 화면처럼 짜여 있습니다.

## 고친 뒤 만들기

```sh
python3 tool/build.py          # HTML 다시 만들기 (파이썬 기본 기능만 씁니다)
python3 -m http.server 8765    # http://127.0.0.1:8765 에서 미리 보기
```

주소가 `/assets/…`처럼 맨 위부터 시작하므로 파일을 직접 열지 말고 서버로 띄워서 봅니다.

## 앱을 더할 때

1. `tool/apps/_template` 폴더를 새 이름으로 복사합니다. 폴더 이름이 곧 주소입니다(`tool/apps/weather` → `/weather/`).
2. `app.json`을 채웁니다.
   - `tone`, `ink`: 봉지의 색과 그 위에 올리는 글자색. `accent`: 흰 바탕에서 쓰는 강조색.
   - `pack`: `card`(한 장짜리 색 판) 또는 `bag`(헤더 카드를 박은 봉지, 봉지 색은 `bag`).
   - `platforms`: `[{"name": "Android", "requires": "8.0 이상"}, {"name": "iOS", "requires": "17 이상"}]`처럼 적습니다. 안드로이드 앱의 페이지에는 Google Play 배지가 늘 나오고, 주소가 없으면 배지 옆에 `status`가 적힙니다. 플레이에 내지 않는 앱(시험용 APK 등)은 `"play": false`를 적으면 배지 대신 `status`만 나옵니다. `store`에 스토어 주소를 넣으면 배지가 그 주소로 이어집니다(배지 그림은 구글이 배포하는 공식 그림 `assets/img/google-play-badge.png`, 페이지 맨 아래에 구글이 요청하는 상표 문구가 함께 나옵니다).
   - `status`: 봉지의 둥근 딱지와 스토어 주소가 없을 때의 버튼에 적히는 말.
   - `mark`: 이름 글씨. 비워 두면 팻말 글씨로 적고 크기는 카드 폭에 맞춥니다.
3. 그림을 `assets/img/<앱>/`에 넣습니다. `icon.webp`(256px 정사각형)는 꼭 있어야 합니다.
4. `pack.html`, `preview.html`의 그림 주소를 고칩니다. 봉지 속에는 `window`(화면 한 장의 윗부분)나 `showcase`(세로로 긴 그림 하나)를, 미리보기의 PC 화면에는 `shots shots--wide`를 씁니다.
   - 웹 서비스처럼 패키지 이름이 없으면 `package` 대신 `code`에 바코드로 찍을 짧은 이름을 적습니다.
5. `tool/site.json`의 `apps`에 폴더 이름을 넣고, `tool/shelf.json`에서 걸 칸의 줄에 `"app:<폴더 이름>"`을 넣은 뒤 `python3 tool/build.py`를 돌립니다. 앱 페이지의 「다른 작업」도 함께 바뀝니다.

### 진열대(`tool/shelf.json`)

- `profile`은 맨 위 벽에 붙인 스티커 묶음입니다.
  - 폴라로이드 사진: `photo`에 그림 주소를 넣으면 그 사진이, 비워 두면 `monogram` 글자가 나옵니다. 아래 여백 글씨는 `caption`입니다.
  - 이름표: `label`, `role`, `org`, `line`. 누르면 `href`(소개 페이지)로 갑니다.
  - `stickers`:
    - `kind: note`는 포스트잇입니다. `title`(학력·경력)과 `rows`(줄마다 `logo`, `name`, `detail`, `when`)를 적습니다.
    - `kind: seal`은 자격증 딱지(정보처리기사)입니다. 소개 묶음 맨 끝, 마지막 포스트잇 오른쪽 아래에 작게 붙습니다.
    - 색은 `tone`, 기울기는 `tilt`입니다.
  - 학교·기관 마크는 `assets/img/marks/`에 있습니다(경북대·대구대 공식 UI 묶음, 한국산업인력공단 공식 로고 SVG). 경북대 UI 관리지침은 상업적 사용을 금지하고 외부인 사용에 허가를 요구합니다.
- `rows`는 그 아래 칸입니다.
  - 칸마다 `name`(벽에 박은 띠의 이름)과 `lines`(고리 줄 목록)가 있습니다. 한 줄에는 물건을 왼쪽부터 적습니다.
  - `pop`을 적으면 띠 오른쪽에 판촉 스티커가 붙습니다(예: 모두의 창업).
- 물건은 두 가지입니다. `"app:pocketpet"`은 그 앱의 봉지이고, 객체는 작은 봉지입니다.
- 작은 봉지에는 다음을 적습니다.
  - `name`, `kind`(어디 것인지), `line`(한 줄), `tone`·`ink`(색), `href`(누르면 갈 곳)
  - 그림: `image`(실제 화면 그림 주소, 가로세로 약 1.9:1) 또는 `art`(`build.py`의 `ART`에 그린 도식 이름)
  - 넓게 걸 때는 `wide`
- 칸마다 한 줄이고, 줄은 옆으로 밀어 봅니다.
  - 마우스가 있는 화면에서는 넘치는 줄 양 끝에 화살표 단추가 나옵니다(`assets/aisle.js`).
  - 크기는 `build.py`의 `SIZE`입니다. 넓은 화면은 한 화면에 칸이 두 줄쯤 보이게 큰 봉지 4칸, 작은 봉지 4칸, 넓은 작은 봉지 6칸입니다. 폰은 원래 크기(큰 봉지 10칸)입니다. 물건 사이는 2칸입니다.
- 고리는 봉지 크기와 상관없이 벽의 크기입니다.
  - 물건은 줄 왼쪽에서 정수 칸만큼 떨어져 놓이고, 밀다가 물건의 시작에서 멈춥니다(scroll-snap). 그래서 멈추면 고리의 두 다리가 늘 구멍에 꽂힙니다.
  - 스티커 묶음의 높이도 구멍 간격의 정수배라서, 그 아래 칸의 고리가 구멍 자리에 섭니다.

### 회사 프로젝트 자세히 보기(`/work/<이름>/`)

- 내용은 `tool/about.json`의 `work`에 있습니다. 줄마다 `slug`(주소), `org`(이름), `unit`(회사), `period`, `role`, `summary`, `notes`, `did`(맡은 일), `stack`(쓴 기술)을 적습니다.
- 진열대의 회사 프로젝트 봉지와 소개 페이지의 「자세히 보기」가 이 페이지로 이어집니다. 색과 도식은 진열대 봉지(`tool/shelf.json`)의 `tone`·`ink`·`art`를 따릅니다.
- 이미지·영상은 `work[].media`에 `{"type": "image" 또는 "video", "src", "w", "h", "alt"}`로 적습니다(영상은 `poster`도). 적은 것이 있을 때만 「자료」 구역이 생깁니다. 파일은 `assets/img/work/<이름>/`에 둡니다.
- 회사 자료는 공개해도 되는 것만 싣습니다(현장·고객이 드러나면 가립니다).

### 연구·논문

- 소개 페이지의 「연구·논문」 구역은 `tool/about.json`의 `research`, 진열대의 「연구·논문」 칸은 `tool/shelf.json`입니다.
- 투고 전 논문의 제목·방법·수치는 본인이 공개해도 된다고 준 문구만 적습니다.

앱에 딸린 문서는 그 앱의 경로 아래에 둡니다(예: `pocketpet/privacy.html` 파일 → `https://zoo3323.github.io/pocketpet/privacy`).

### 개인정보처리방침

- 본문은 `tool/apps/<앱>/privacy.html`에 쓰고, `app.json`에 `"privacy": {"date": "시행일"}`을 넣습니다. 그러면 `<앱>/privacy.html`이 만들어지고 앱 페이지 「정보」 맨 끝에 「개인정보처리방침」 줄이 생깁니다.
- 모든 방침 끝에 붙는 문의처·구제 기관·변경 안내는 `tool/privacy-common.html` 한 곳에 있습니다. 본문의 `{{email}}`, `{{developer}}`, `{{date}}`, `{{app}}`은 만들 때 채워집니다. 문의 메일은 `tool/site.json`의 `email`이고, 사이트에서는 방침 페이지에만 보입니다.
- 공개한 방침 주소는 앱 안과 플레이 콘솔에 걸립니다. `tool/site.json`의 `keep`에 적어 두면, 그 페이지를 만들지 못할 때 `build.py`가 멈춥니다. 주소(앱 폴더 이름)는 바꾸지 않습니다.
- 내용을 바꾸면 `date`를 새 시행일로 고칩니다.

## 그 밖에 고칠 때

- **개발자 이름, 소개 한 줄**: `tool/site.json`의 `developer`, `tagline`을 고치고 다시 만듭니다. 링크 미리보기 그림 `assets/img/og.png`는 첫 화면을 1200×630으로 다시 찍어 바꿉니다.
- **버전 기록**: 그 앱의 `app.json`에서 `version`을 올리고 `history` 맨 위에 `{"version", "date", "notes"}`를 하나 더합니다. 앱 페이지의 「새로운 기능」에는 지금 버전의 기록이, 그 아래 접힌 「버전 기록」에는 나머지가 나옵니다. 버전이 없는 웹 서비스는 `version`을 `null`로 두면 「업데이트 기록」이 됩니다.
- **소개**: `tool/about.json`의 경력·학력·기술·공개한 도구를 고칩니다. 앱 페이지의 개발자 이름은 소개 페이지로 이어집니다.
- **이름 글씨를 따로 쓰는 앱**: 이름 글자만 담은 글꼴 조각을 `tool/wordmarks.py`로 만들고 `assets/site.css` 맨 위에 `@font-face`를 한 줄 더한 뒤 `app.json`의 `mark.font`에 그 이름을 적습니다.
- **포켓펫 동물 추가**: `assets/img/pocketpet/`의 `thumb/`, `atlas/`(스프라이트 위 다섯 줄, 1536×1040), 큐티 그림체면 `stage/`에 그림을 넣고 `tool/apps/pocketpet/demo.html`의 선반에 버튼 한 줄을 더합니다.

## 그림과 글꼴

- 포켓펫 동물 그림, 옷 스티커, 앱 화면은 각 앱에서 가져온 것입니다. 옷 스티커와 모아캠·Scorelab 화면은 견본 데이터로 만든 것입니다.
- 글꼴은 SIL Open Font License로 배포된 Do Hyeon, Black Han Sans, Pretendard, Nunito(이름 글자만 추린 조각)입니다. 라이선스 전문은 `assets/fonts/`에 있습니다.
