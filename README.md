# zoo3323.github.io

NamJuKim의 1인 개발자 개발 기록입니다. <https://zoo3323.github.io>

`main`에 올린 파일을 GitHub Pages가 그대로 내보냅니다. HTML은 `tool/build.py`가 앱 정보 파일에서 만들어 내고, 만든 결과를 함께 올립니다.

## 구성

| 경로 | 내용 |
|---|---|
| `tool/site.json` | 개발자 이름, 이름 아래 소개 한 줄, 주소, 진열대에 거는 앱 순서 |
| `tool/apps/<앱>/app.json` | 앱 한 개의 정보(이름, 색, 버전, 플랫폼, 설명) |
| `tool/apps/<앱>/pack.html` | 진열대의 봉지 속에 넣을 물건 |
| `tool/apps/<앱>/preview.html` | 앱 페이지의 「미리보기」 |
| `tool/apps/<앱>/demo.html` | (있으면) 미리보기 아래의 따로 해 보는 구역 |
| `tool/about.json` | 진열대 맨 앞의 명함(소개)과 소개 페이지 `/about/`의 내용 |
| `tool/build.py` | 위 파일들로 HTML을 만든다 |
| `index.html`, `<앱>/index.html`, `about/index.html`, `404.html` | 만들어진 결과. 직접 고치지 않는다 |
| `assets/site.css` | 화면 전체의 모양 |
| `assets/wall.js`, `light.js` | 봉지의 흔들림, 빛(PC는 마우스를 따르는 등빛과 봉지의 반사·무지개 결, 안드로이드 폰은 기울기를 따르는 봉지의 반사) |
| `assets/shots.js` | 미리보기 화면을 눌러 크게 보기 |
| `assets/pet.js`, `closet.js` | 포켓펫 꺼내 보기, 옷 분류 딱지 |
| `assets/img/`, `assets/fonts/` | 그림과 글꼴 |

첫 화면은 고리에 건 봉지들이고, 봉지를 누르면 나오는 앱 페이지는 앱 장터의 앱 화면처럼 짜여 있습니다.

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
   - `platforms`: `[{"name": "Android", "requires": "8.0 이상"}, {"name": "iOS", "requires": "17 이상"}]`처럼 적습니다. 안드로이드 앱의 페이지에는 Google Play 배지가 늘 나오고, 주소가 없으면 배지 옆에 `status`가 적힙니다. `store`에 스토어 주소를 넣으면 배지가 그 주소로 이어집니다(배지 그림은 구글이 배포하는 공식 그림 `assets/img/google-play-badge.png`, 페이지 맨 아래에 구글이 요청하는 상표 문구가 함께 나옵니다).
   - `status`: 봉지의 둥근 딱지와 스토어 주소가 없을 때의 버튼에 적히는 말.
   - `mark`: 이름 글씨. 비워 두면 팻말 글씨로 적고 크기는 카드 폭에 맞춥니다.
3. 그림을 `assets/img/<앱>/`에 넣습니다. `icon.webp`(256px 정사각형)는 꼭 있어야 합니다.
4. `pack.html`, `preview.html`의 그림 주소를 고칩니다. 봉지 속에는 `window`(화면 한 장의 윗부분)나 `showcase`(세로로 긴 그림 하나)를, 미리보기의 PC 화면에는 `shots shots--wide`를 씁니다.
   - 웹 서비스처럼 패키지 이름이 없으면 `package` 대신 `code`에 바코드로 찍을 짧은 이름을 적습니다.
5. `tool/site.json`의 `apps`에 폴더 이름을 넣고 `python3 tool/build.py`를 돌립니다.

앱이 셋을 넘으면 진열대는 아래 줄로 내려갑니다. 앱 페이지의 「다른 앱」도 함께 바뀝니다.

앱에 딸린 문서는 그 앱의 경로 아래에 둡니다(예: `pocketpet/privacy.html` 파일 → `https://zoo3323.github.io/pocketpet/privacy`).

## 그 밖에 고칠 때

- **개발자 이름, 소개 한 줄**: `tool/site.json`의 `developer`, `tagline`을 고치고 다시 만듭니다. 링크 미리보기 그림 `assets/img/og.png`는 첫 화면을 1200×630으로 다시 찍어 바꿉니다.
- **버전 기록**: 그 앱의 `app.json`에서 `version`을 올리고 `history` 맨 위에 `{"version", "date", "notes"}`를 하나 더합니다. 앱 페이지의 「새로운 기능」에는 지금 버전의 기록이, 그 아래 접힌 「버전 기록」에는 나머지가 나옵니다. 버전이 없는 웹 서비스는 `version`을 `null`로 두면 「업데이트 기록」이 됩니다.
- **소개**: `tool/about.json`의 경력·학력·기술·공개한 도구를 고칩니다. 앱 페이지의 개발자 이름은 소개 페이지로 이어집니다.
- **이름 글씨를 따로 쓰는 앱**: 이름 글자만 담은 글꼴 조각을 `tool/wordmarks.py`로 만들고 `assets/site.css` 맨 위에 `@font-face`를 한 줄 더한 뒤 `app.json`의 `mark.font`에 그 이름을 적습니다.
- **포켓펫 동물 추가**: `assets/img/pocketpet/`의 `thumb/`, `atlas/`(스프라이트 위 다섯 줄, 1536×1040), 보송 그림체면 `stage/`에 그림을 넣고 `tool/apps/pocketpet/demo.html`의 선반에 버튼 한 줄을 더합니다.

## 그림과 글꼴

- 포켓펫 동물 그림, 옷 스티커, 앱 화면은 각 앱에서 가져온 것입니다. 옷 스티커와 모아캠·Scorelab 화면은 견본 데이터로 만든 것입니다.
- 글꼴은 SIL Open Font License로 배포된 Do Hyeon, Black Han Sans, Pretendard, Nunito(이름 글자만 추린 조각)입니다. 라이선스 전문은 `assets/fonts/`에 있습니다.
