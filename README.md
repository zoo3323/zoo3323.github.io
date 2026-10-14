# zoo3323.github.io

NamJuKim이 혼자 만드는 안드로이드 앱을 걸어 둔 진열대입니다. <https://zoo3323.github.io>

빌드 과정이 없는 정적 사이트입니다. `main`에 올린 파일을 GitHub Pages가 그대로 내보냅니다.

## 구성

| 경로 | 내용 |
|---|---|
| `index.html` | 첫 화면. 고리에 걸린 봉지 세 개 |
| `pocketpet/`, `mylittlecloset/`, `moacam/` | 앱마다 한 장. 봉지의 뒷면 |
| `404.html` | 없는 주소에 보이는 빈 고리 |
| `assets/site.css` | 화면 전체의 모양. 길이 단위는 타공판 구멍 간격 `--p` |
| `assets/wall.js` | 걸린 봉지의 흔들림 |
| `assets/pet.js` | 포켓펫 꺼내 보기 |
| `assets/closet.js` | 마이리틀클로젯 분류 딱지 |
| `assets/img/`, `assets/fonts/` | 그림과 글꼴 |

앱마다 제 경로를 씁니다. 앱에 딸린 문서를 더할 때는 그 아래에 둡니다(예: `pocketpet/privacy.html` 파일 → `https://zoo3323.github.io/pocketpet/privacy`).

## 미리 보기

주소가 `/assets/…`처럼 맨 위부터 시작하므로 파일을 직접 열지 말고 서버로 띄웁니다.

```sh
python3 -m http.server 8765
# http://127.0.0.1:8765
```

## 고칠 때

- **개발자 이름**: HTML 다섯 장에서 `NamJuKim`을 찾아 바꿉니다. `assets/img/og.png`(링크 미리보기 그림)에도 이름이 찍혀 있으니 첫 화면을 1200×630으로 다시 찍어 바꿉니다.
- **출시 상태**: 봉지의 둥근 딱지(`<p class="tag">`) 글을 바꿉니다. 스토어 주소가 생기면 앱 페이지의 「표시」 표에 한 줄 더합니다.
- **버전**: 봉지의 흰 딱지와 앱 페이지의 「표시」 표, 두 곳에 있습니다.
- **앱 이름**: 이름 글자만 담은 글꼴 조각을 쓰므로 `tool/wordmarks.py`의 이름을 고쳐 다시 만듭니다. 바코드는 패키지 이름을 Code 128로 적은 것이라 패키지 이름이 바뀌면 다시 그려야 합니다.
- **포켓펫 동물 추가**: `assets/img/pocketpet/`의 `thumb/`, `atlas/`(스프라이트 위 다섯 줄, 1536×1040), 보송 그림체면 `stage/`에 그림을 넣고 `pocketpet/index.html`의 선반에 버튼 한 줄을 더합니다.

## 그림과 글꼴

- 포켓펫 동물 그림, 옷 스티커, 앱 화면은 각 앱에서 가져온 것입니다. 마이리틀클로젯과 모아캠의 화면은 견본 데이터로 만든 것입니다.
- 글꼴은 SIL Open Font License로 배포된 Do Hyeon, Black Han Sans, Pretendard(이름 글자만 추린 조각)입니다. 라이선스 전문은 `assets/fonts/`에 있습니다.
