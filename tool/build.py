"""사이트의 HTML 을 만든다. 표준 라이브러리만 쓴다.

    python3 tool/build.py

읽는 것
  tool/site.json            개발자 이름, 이름 아래 소개 한 줄, 주소, 앱 순서
  tool/apps/<앱>/app.json   앱 한 개의 정보
  tool/apps/<앱>/pack.html  진열대의 봉지 속에 넣을 물건
  tool/apps/<앱>/preview.html  앱 페이지의 「미리보기」에 넣을 내용
  tool/apps/<앱>/demo.html  (있으면) 미리보기 아래에 따로 두는 구역. 제목은 app.json 의 demoTitle
  tool/apps/<앱>/privacy.html  (app.json 에 privacy 가 있으면) 그 앱 개인정보처리방침의 본문
  tool/privacy-common.html  모든 방침 끝에 붙는 문의처·구제 기관·변경 안내
  tool/about.json           (있으면) 진열대 맨 앞의 명함과 소개 페이지(/about/)

쓰는 것
  index.html, <앱>/index.html, <앱>/privacy.html, about/index.html, 404.html

site.json 의 keep 에 적은 파일은 앱 안과 플레이 콘솔에 주소가 걸려 있다. 하나라도 만들지 못하면 멈춘다.

앱을 더할 때는 tool/apps/_template 을 복사해 고치고, site.json 의 apps 에 폴더 이름을 넣은 뒤
이 파일을 다시 돌린다. 만들어진 HTML 은 직접 고치지 않는다.
"""

import html
import itertools
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOL = ROOT / "tool"
SITE = json.loads((TOOL / "site.json").read_text())
DEV = SITE["developer"]

# ── 바코드(Code 128 B): 패키지 이름을 그대로 적는다 ──

CODE128 = (
    "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 "
    "112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 "
    "311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 "
    "112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 "
    "313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 "
    "314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 "
    "122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 "
    "124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 "
    "114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112"
).split()


def barcode(text):
    values = [104] + [ord(ch) - 32 for ch in text]  # 104 = Start B
    values.append(sum(v * max(i, 1) for i, v in enumerate(values)) % 103)
    values.append(106)  # Stop
    x, rects = 0, []
    for value in values:
        for i, width in enumerate(CODE128[value]):
            if i % 2 == 0:
                rects.append(f'<rect x="{x}" y="0" width="{width}" height="10"/>')
            x += int(width)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {x} 10" preserveAspectRatio="none" '
        f'fill="currentColor" aria-hidden="true" focusable="false">{"".join(rects)}</svg>'
    )


# ── 되풀이해 쓰는 조각 ──

HOOK = (
    '<svg class="hook"{style} viewBox="0 0 64 80" fill="none" stroke="#8b8a82" stroke-width="5" '
    'stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M16 16v10a8 8 0 0 0 8 8h16a8 8 0 0 0 8-8V16"/>'
    '<path d="M32 34v30"/><circle cx="16" cy="16" r="3.5" fill="#6a6962" stroke="none"/>'
    '<circle cx="48" cy="16" r="3.5" fill="#6a6962" stroke="none"/></svg>'
)
TIP = '<span class="hook-tip"{style} aria-hidden="true"></span>'


def icon(path):
    return (
        '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" '
        f'stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="{path}"/></svg>'
    )


ICON_OUT = icon("M3 11 11 3M4.5 3H11v6.5")
ICON_GO = icon("M2 7h9.5M7.5 3l4 4-4 4")
ICON_BACK = icon("M12 7H2.5M6.5 3 2.5 7l4 4")

STORE = {"Android": "Google Play", "iOS": "App Store"}


def esc(text):
    return html.escape(str(text), quote=True)


def load(app_id):
    folder = TOOL / "apps" / app_id
    app = json.loads((folder / "app.json").read_text())
    app["id"] = app_id
    app["pack_html"] = (folder / "pack.html").read_text().strip()
    app["preview_html"] = (folder / "preview.html").read_text().strip()
    demo = folder / "demo.html"
    app["demo_html"] = demo.read_text().strip() if demo.exists() else ""
    if app.get("privacy"):
        app["privacy_html"] = (folder / "privacy.html").read_text().strip()
    return app


APPS = [load(app_id) for app_id in SITE["apps"]]
APP_BY_ID = {app["id"]: app for app in APPS}
ABOUT = json.loads((TOOL / "about.json").read_text()) if (TOOL / "about.json").exists() else None
SHELF = json.loads((TOOL / "shelf.json").read_text())
GITHUB_HOST = SITE["github"].split("://", 1)[-1].rstrip("/")
ABOUT_STYLE_WALL = "--rest:-0.8deg;--tone:#ffffff;--tone-ink:#17171a;--accent:#17171a;--bag:#f5f4ef;--mark-size:2.8"
ABOUT_STYLE_PAGE = "--tone:#ffe55c;--tone-ink:#17171a;--accent:#17171a"


def code(app):
    """바코드와 그 아래에 적는 글. 앱은 패키지 이름, 웹 서비스처럼 패키지가 없으면 app.json 의 code."""
    return app.get("package") or app["code"]


def name_lines(app):
    """헤더 카드에 적을 이름의 줄. nameLines 가 없으면 긴 이름을 가운데 가까운 띄어쓰기에서 둘로 나눈다."""
    if app.get("nameLines"):
        return app["nameLines"]
    name = app["name"]
    if len(name) <= 5:
        return [name]
    spaces = [i for i, ch in enumerate(name) if ch == " "]
    cut = min(spaces, key=lambda i: abs(i - len(name) / 2)) if spaces else len(name) // 2
    return [name[:cut].strip(), name[cut:].strip()]


def mark_size(app):
    """이름 글씨 크기(구멍 간격의 배수). 가장 긴 줄이 카드 안쪽 폭 8.2칸에 들어오게 한다."""
    lines = name_lines(app)
    widest = max(sum(0.4 if ch == " " else 1 for ch in line) for line in lines)
    cap = {1: 2.8, 2: 1.85}.get(len(lines), 1.3)
    return round(min(cap, 8.2 / (widest * 0.92)), 2)


def compat(app):
    return ", ".join(" ".join(filter(None, [p["name"], p.get("requires")])) for p in app["platforms"])


def tone_style(app):
    mark = app.get("mark", {})
    parts = [f"--tone:{app['tone']}", f"--tone-ink:{app['ink']}", f"--accent:{app.get('accent', app['ink'])}"]
    if app.get("bag"):
        parts.append(f"--bag:{app['bag']}")
    if mark.get("font"):
        parts.append(f"--mark:'{mark['font']}'")
    if "weight" in mark:
        parts.append(f"--mark-weight:{mark['weight']}")
    parts.append(f"--mark-size:{mark.get('size') or mark_size(app)}")
    if "tracking" in mark:
        parts.append(f"--mark-tracking:{mark['tracking']}")
    return ";".join(parts)


def head(title, desc, path, scripts=(), index=True, preview=True):
    """preview=False 면 링크 미리보기에 첫 화면 그림(og.png)을 쓰지 않는다(개인정보처리방침)."""
    site = SITE["site"]
    tags = "".join(f'\n<script src="/assets/{name}" defer></script>' for name in scripts)
    canonical = f'<link rel="canonical" href="{site}{path}">' if index else '<meta name="robots" content="noindex">'
    if preview:
        image = (
            f'<meta property="og:image" content="{site}/assets/img/og.png">\n'
            '<meta property="og:image:width" content="1200">\n'
            '<meta property="og:image:height" content="630">\n'
            '<meta name="twitter:card" content="summary_large_image">'
        )
    else:
        image = '<meta name="twitter:card" content="summary">'
    return f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
{canonical}
<meta property="og:type" content="website">
<meta property="og:site_name" content="{esc(DEV)}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{site}{path}">
{image}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/DoHyeon.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css">{tags}
</head>
"""


def sign(home, back=("/", "진열대")):
    if home:
        who = f'<h1 class="sign__name">{esc(DEV)}</h1>'
        link = f'<a class="btn" href="{SITE["github"]}" rel="me">GitHub {ICON_OUT}</a>'
    else:
        who = f'<p class="sign__name"><a href="/">{esc(DEV)}</a></p>'
        link = f'<a class="btn" href="{back[0]}">{ICON_BACK} {esc(back[1])}</a>'
    return f"""<header class="sign">
  {who}
  {link}
  <p class="sign__line">{esc(SITE["tagline"])}</p>
</header>"""


FOOT = f"""<footer class="foot">
  <p>© {SITE["year"]} {esc(DEV)}</p>
  <a href="{SITE["github"]}" rel="me">GitHub</a>
</footer>"""
# 개인정보처리방침의 발치: 링크 없이 이름만
FOOT_PLAIN = f"""<footer class="foot">
  <p>© {SITE["year"]} {esc(DEV)}</p>
</footer>"""


def name_html(app):
    text = "<br>".join(esc(line) for line in name_lines(app))
    return text + ('<span class="dot" aria-hidden="true"></span>' if app.get("dot") else "")


def tag(app):
    """봉지의 둥근 딱지. 앱 페이지의 상태 문구가 길면 app.json 의 tag 로 짧게 적는다."""
    first, _, rest = app.get("tag", app["status"]).partition(" ")
    return esc(first) + (f"<br>{esc(rest)}" if rest else "")


def pack(app, place="", level=3):
    app_id = app["id"]
    platforms = compat(app) if len(app["platforms"]) == 1 else " · ".join(p.get("short", p["name"]) for p in app["platforms"])
    line = app.get("labelLine") or f'{app["version"]} · {platforms}'
    return f"""<li class="peg"{place}>
  {HOOK.format(style="")}
  <article class="pack pack--{app["pack"]} pack--{app_id}" data-sway style="--rest:{app.get("rest", 0)}deg;{tone_style(app)};view-transition-name:pack-{app_id}">
    <div class="card">
      <h{level} class="card__name"><a class="pack__link" href="/{app_id}/">{name_html(app)}</a></h{level}>
      <p class="card__line">{esc(app["line"])}</p>
    </div>
    <p class="tag">{tag(app)}</p>
    <div class="bag">
      {app["pack_html"]}
      <div class="label label--{app.get("label", "sticker")}">{barcode(code(app))}<span class="label__id">{esc(code(app))}</span><span class="label__ver">{esc(line)}</span><span class="label__go" aria-hidden="true">뒷면 보기 {ICON_GO}</span></div>
    </div>
    <span class="pack__holo" aria-hidden="true"></span>
    <span class="pack__glare" aria-hidden="true"></span>
    <a class="pack__cover" href="/{app_id}/" tabindex="-1" aria-hidden="true"></a>
  </article>
  {TIP.format(style="")}
</li>"""


def date_ko(text):
    year, month, day = text.split("-")
    return f"{int(year)}. {int(month)}. {int(day)}."


def news_entry(app):
    """「새로운 기능」에 올릴 기록. 지금 버전의 기록이 있으면 그것, 없으면 가장 위의 기록."""
    history = app.get("history") or []
    for entry in history:
        if entry.get("version") == app["version"]:
            return entry
    return history[0] if history else None


def news(app):
    entry = news_entry(app)
    if not entry:
        return ""
    head = " · ".join(filter(None, [f'버전 {entry["version"]}' if entry.get("version") else "", date_ko(entry["date"])]))
    rest = [e for e in app.get("history", []) if e is not entry]
    older = ""
    if rest:
        label = "버전 기록" if any(e.get("version") for e in app["history"]) else "업데이트 기록"
        rows = "\n          ".join(
            f'<li><div class="history__head"><b>{esc(e.get("version") or "")}</b>'
            f'<time datetime="{e["date"]}">{date_ko(e["date"])}</time></div><p>{esc(e["notes"])}</p></li>'
            for e in rest
        )
        older = f"""
      <details class="history">
        <summary>{label} <span>{len(rest)}개 더</span></summary>
        <ol class="history__list">
          {rows}
        </ol>
      </details>"""
    return f"""<section class="sec" aria-labelledby="h-news">
      <h2 id="h-news">새로운 기능</h2>
      <p class="news__ver">{head}</p>
      <p>{esc(entry["notes"])}</p>{older}
    </section>"""


def about_pack(place="", level=3):
    a = ABOUT
    orgs = "<br>".join(esc(line) for line in a["card"])
    return f"""<li class="peg"{place}>
  {HOOK.format(style="")}
  <article class="pack pack--bag pack--about" data-sway style="{ABOUT_STYLE_WALL};view-transition-name:pack-about">
    <div class="card">
      <h{level} class="card__name"><a class="pack__link" href="/about/">소개</a></h{level}>
      <p class="card__line">{esc(a["packLine"])}</p>
    </div>
    <div class="bag">
      <div class="namecards">
        <div class="namecard namecard--under" aria-hidden="true"></div>
        <div class="namecard">
          <p class="namecard__name">{esc(DEV)}</p>
          <p class="namecard__role">{esc(a["role"])}</p>
          <p class="namecard__org">{orgs}</p>
        </div>
      </div>
      <div class="label label--sticker">{barcode(GITHUB_HOST)}<span class="label__id">{esc(GITHUB_HOST)}</span><span class="label__go" aria-hidden="true">뒷면 보기 {ICON_GO}</span></div>
    </div>
    <span class="pack__holo" aria-hidden="true"></span>
    <span class="pack__glare" aria-hidden="true"></span>
    <a class="pack__cover" href="/about/" tabindex="-1" aria-hidden="true"></a>
  </article>
  {TIP.format(style="")}
</li>"""


# ── 작은 봉지: 스펙·도구·회사 프로젝트처럼 따로 뒷면이 없는 물건. 누르면 소개나 GitHub 로 간다 ──

ART = {
    # 주차장을 위에서 본 그림: 주차면 선, 서 있는 차와 차를 찾은 빨간 상자, 빈자리 점
    "parking": (
        '<path d="M6 8h108M6 56h108M26 8v18M46 8v18M66 8v18M86 8v18M26 56V38M46 56V38M66 56V38M86 56V38" '
        'fill="none" stroke="currentColor" stroke-width="1.4" stroke-opacity=".45"/>'
        '<g fill="currentColor"><rect x="10" y="11" width="12" height="13" rx="2.5"/><rect x="50" y="11" width="12" height="13" rx="2.5"/>'
        '<rect x="70" y="11" width="12" height="13" rx="2.5"/><rect x="30" y="40" width="12" height="13" rx="2.5"/>'
        '<rect x="95" y="40" width="12" height="13" rx="2.5"/></g>'
        '<g fill="none" stroke="#e8112d" stroke-width="1.5"><rect x="8" y="9" width="16" height="17" rx="1.5"/>'
        '<rect x="48" y="9" width="16" height="17" rx="1.5"/><rect x="68" y="9" width="16" height="17" rx="1.5"/>'
        '<rect x="28" y="38" width="16" height="17" rx="1.5"/><rect x="93" y="38" width="16" height="17" rx="1.5"/></g>'
        '<g fill="currentColor" fill-opacity=".35"><circle cx="36" cy="17" r="2"/><circle cx="100" cy="17" r="2"/>'
        '<circle cx="16" cy="47" r="2"/><circle cx="56" cy="47" r="2"/><circle cx="76" cy="47" r="2"/></g>'
    ),
    # 라벨링 도구: 한 장면에 다 단 상자와 그리는 중인 점선 상자, 커서, 아래 프레임 줄
    "labeling": (
        '<rect x="4" y="4" width="112" height="44" rx="3" fill="currentColor" fill-opacity=".07" stroke="currentColor" stroke-opacity=".35" stroke-width="1.2"/>'
        '<path d="M4 40 116 26" stroke="currentColor" stroke-opacity=".16" stroke-width="10" fill="none"/>'
        '<rect x="20" y="25" width="20" height="11" rx="3" fill="currentColor"/>'
        '<rect x="70" y="18" width="20" height="11" rx="3" fill="currentColor" fill-opacity=".85"/>'
        '<rect x="17" y="22" width="26" height="17" rx="1.5" fill="none" stroke="#e8112d" stroke-width="1.5"/>'
        '<rect x="17" y="16.5" width="13" height="5.5" rx="1" fill="#e8112d"/>'
        '<rect x="67" y="15" width="26" height="17" rx="1.5" fill="none" stroke="#e8112d" stroke-width="1.3" stroke-dasharray="3 2"/>'
        '<g fill="#fff" stroke="#e8112d" stroke-width="1"><rect x="65.5" y="13.5" width="3" height="3"/><rect x="91.5" y="13.5" width="3" height="3"/>'
        '<rect x="65.5" y="30.5" width="3" height="3"/><rect x="91.5" y="30.5" width="3" height="3"/></g>'
        '<path d="M94 32v9.5l2.7-2.5 2 4.2 1.7-.8-2-4.1 3.6-.2z" fill="currentColor" stroke="#fff" stroke-width=".8"/>'
        '<rect x="4" y="53" width="112" height="7" rx="2" fill="currentColor" fill-opacity=".12"/>'
        '<path d="M14 54.5v4M24 54.5v4M34 54.5v4M44 54.5v4M54 54.5v4M64 54.5v4M74 54.5v4M84 54.5v4M94 54.5v4M104 54.5v4" stroke="currentColor" stroke-opacity=".45"/>'
        '<rect x="58" y="51" width="2.6" height="11" rx="1.2" fill="#e8112d"/>'
    ),
    # 안전 영상 분석: 카메라 두 대에 걸쳐 같은 사람을 따라가고, 안전모 미착용(!)과 화재 자리를 빨갛게
    "safety": (
        '<g fill="currentColor" fill-opacity=".07" stroke="currentColor" stroke-opacity=".35" stroke-width="1.2">'
        '<rect x="4" y="5" width="52" height="40" rx="3"/><rect x="64" y="5" width="52" height="40" rx="3"/></g>'
        '<circle cx="10" cy="11" r="2" fill="#e8112d"/><circle cx="70" cy="11" r="2" fill="#e8112d"/>'
        '<rect x="24" y="16" width="12" height="25" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/>'
        '<rect x="24" y="11" width="9" height="5" rx="1" fill="currentColor"/>'
        '<rect x="88" y="18" width="11" height="23" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/>'
        '<rect x="88" y="13" width="9" height="5" rx="1" fill="currentColor"/>'
        '<rect x="26" y="17.5" width="8" height="7" rx="1" fill="none" stroke="#e8112d" stroke-width="1.4"/>'
        '<circle cx="40.5" cy="18.5" r="3.3" fill="#e8112d"/><path d="M40.5 16.6v2.3M40.5 20.2v.2" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>'
        '<rect x="102" y="29" width="10" height="12" rx="1.5" fill="#e8112d" fill-opacity=".2" stroke="#e8112d" stroke-width="1.4"/>'
        '<path d="M36 52c16 8 34 8 54-3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="3 2.5"/>'
        '<path d="m91 48.5-4.8.4 2.6 3.6z" fill="currentColor"/>'
    ),
    # 위험성평가 AI: 평가표의 한 줄을 짚고, 옆 말풍선이 법령(§)을 근거로 답한다
    "risk": (
        '<rect x="4" y="4" width="70" height="56" rx="3" fill="#fff" fill-opacity=".7" stroke="currentColor" stroke-opacity=".35" stroke-width="1.2"/>'
        '<path d="M7 4h64a3 3 0 0 1 3 3v6H4V7a3 3 0 0 1 3-3z" fill="currentColor" fill-opacity=".85"/>'
        '<path d="M4 23h70M4 33h70M4 43h70M28 13v47" stroke="currentColor" stroke-opacity=".28"/>'
        '<rect x="4.6" y="33.5" width="68.8" height="9" fill="#e8112d" fill-opacity=".14"/><rect x="4" y="33.5" width="2.6" height="9" fill="#e8112d"/>'
        '<g fill="currentColor" fill-opacity=".45"><rect x="9" y="17" width="14" height="2.4" rx="1.2"/><rect x="33" y="17" width="34" height="2.4" rx="1.2"/>'
        '<rect x="9" y="27" width="12" height="2.4" rx="1.2"/><rect x="33" y="27" width="28" height="2.4" rx="1.2"/>'
        '<rect x="9" y="37" width="15" height="2.4" rx="1.2"/><rect x="33" y="37" width="31" height="2.4" rx="1.2"/>'
        '<rect x="9" y="49" width="11" height="2.4" rx="1.2"/><rect x="33" y="49" width="25" height="2.4" rx="1.2"/></g>'
        '<rect x="81" y="22" width="35" height="30" rx="3" fill="currentColor"/><path d="m81 34-6.5 4 6.5 4z" fill="currentColor"/>'
        '<path d="M87.6 27.6c-1.4-.9-3.6-.6-3.6 1 0 2.4 4.6 1.6 4.6 4.2 0 1.6-2.3 2-3.8 1M84.4 33.4c1.4.9 3.6.6 3.6-1 0-2.4-4.6-1.6-4.6-4.2" '
        'fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round"/>'
        '<g fill="#fff" fill-opacity=".75"><rect x="93" y="28.5" width="18" height="2.4" rx="1.2"/><rect x="86" y="38.5" width="25" height="2.4" rx="1.2"/>'
        '<rect x="86" y="44.5" width="19" height="2.4" rx="1.2"/></g>'
    ),
    # 논문: 제목과 저자 줄, 두 단 본문, 오른쪽 단의 그림 상자
    "paper": (
        '<rect x="31" y="3" width="58" height="58" rx="2" fill="#fff" stroke="currentColor" stroke-opacity=".35" stroke-width="1.2"/>'
        '<rect x="38" y="9" width="44" height="4" rx="1" fill="currentColor"/>'
        '<rect x="45" y="15.5" width="30" height="2" rx="1" fill="currentColor" fill-opacity=".45"/>'
        '<g fill="currentColor" fill-opacity=".28"><rect x="36" y="22" width="22" height="1.8" rx=".9"/><rect x="36" y="25.5" width="22" height="1.8" rx=".9"/>'
        '<rect x="36" y="29" width="22" height="1.8" rx=".9"/><rect x="36" y="32.5" width="19" height="1.8" rx=".9"/>'
        '<rect x="36" y="38" width="22" height="1.8" rx=".9"/><rect x="36" y="41.5" width="22" height="1.8" rx=".9"/>'
        '<rect x="36" y="45" width="22" height="1.8" rx=".9"/><rect x="36" y="48.5" width="17" height="1.8" rx=".9"/>'
        '<rect x="62" y="38" width="22" height="1.8" rx=".9"/><rect x="62" y="41.5" width="22" height="1.8" rx=".9"/>'
        '<rect x="62" y="45" width="22" height="1.8" rx=".9"/><rect x="62" y="48.5" width="20" height="1.8" rx=".9"/></g>'
        '<rect x="62" y="22" width="22" height="13" rx="1" fill="#e8112d" fill-opacity=".14" stroke="#e8112d" stroke-width="1"/>'
        '<path d="m64 33 5-6 4 4 3-3 6 5" fill="none" stroke="#e8112d" stroke-width="1" stroke-linejoin="round"/>'
    ),
    # 노인보호구역 입지: 길과 사고가 몰린 칸(빨강의 진하기), 고른 자리 점선 원과 핀
    "zone": (
        '<rect x="4" y="4" width="112" height="56" rx="3" fill="#fff" fill-opacity=".6" stroke="currentColor" stroke-opacity=".3" stroke-width="1.2"/>'
        '<g fill="none" stroke="currentColor" stroke-opacity=".26"><path d="M4 22h112M4 44h112M30 4v56M62 4v56M94 4v56" stroke-width="2.4"/>'
        '<path d="M4 58 58 4" stroke-width="1.6"/></g>'
        '<g fill="#e8112d"><rect x="64" y="24" width="8" height="8" fill-opacity=".55"/><rect x="72" y="24" width="8" height="8" fill-opacity=".32"/>'
        '<rect x="64" y="32" width="8" height="8" fill-opacity=".28"/><rect x="72" y="32" width="8" height="8" fill-opacity=".62"/>'
        '<rect x="80" y="32" width="8" height="8" fill-opacity=".22"/><rect x="34" y="46" width="8" height="8" fill-opacity=".2"/>'
        '<rect x="96" y="8" width="8" height="8" fill-opacity=".16"/></g>'
        '<circle cx="74" cy="33" r="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3.5 2.5"/>'
        '<path d="M74 19.5c-3.3 0-6 2.6-6 5.9 0 4.4 6 10.1 6 10.1s6-5.7 6-10.1c0-3.3-2.7-5.9-6-5.9z" fill="currentColor"/>'
        '<circle cx="74" cy="25.4" r="2.2" fill="#fff"/>'
    ),
}


def mini_art(item):
    """작은 봉지의 그림: 그림(image, 크기는 imageSize) 또는 하는 일을 보여 주는 도식(art)."""
    if item.get("image"):
        w, h = item.get("imageSize", [600, 316])
        return f'<div class="mini__art"><img src="{esc(item["image"])}" width="{w}" height="{h}" alt="" loading="lazy"></div>'
    if item.get("art") in ART:
        return (
            '<div class="mini__art"><svg viewBox="0 0 120 64" aria-hidden="true" focusable="false">'
            f'{ART[item["art"]]}</svg></div>'
        )
    return ""


def mini_pack(item, place="", level=3):
    href = item["href"]
    if href.startswith("http"):
        go = f'{"GitHub" if "github.com" in href else "열기"} {ICON_OUT}'
    else:
        go = f"보기 {ICON_GO}"
    wide = {"photo": " pack--photo", "wide": " pack--wide"}.get(kind_of(item), "")
    style = (
        f'--rest:{item.get("rest", 0)}deg;--tone:{item["tone"]};--tone-ink:{item["ink"]};'
        f'--accent:{item["ink"]};--mark-size:{item.get("size", 1.3)}'
    )
    return f"""<li class="peg"{place}>
  {HOOK.format(style="")}
  <article class="pack pack--card pack--mini{wide}" data-sway style="{style}">
    <div class="card">
      <h{level} class="card__name"><a class="pack__link" href="{esc(href)}">{esc(item["name"])}</a></h{level}>
      <p class="card__line">{esc(item["kind"])}</p>
    </div>
    <div class="bag">
      {mini_art(item)}
      <p class="mini__line">{esc(item["line"])}</p>
      <span class="mini__go" aria-hidden="true">{go}</span>
    </div>
    <span class="pack__holo" aria-hidden="true"></span>
    <span class="pack__glare" aria-hidden="true"></span>
    <a class="pack__cover" href="{esc(href)}" tabindex="-1" aria-hidden="true"></a>
  </article>
  {TIP.format(style="")}
</li>"""


# ── 진열대의 칸 ──
# 칸(aisle)마다 벽에 박은 이름 띠 하나와 고리 줄(line)이 있고, 줄은 옆으로 밀어 본다. 길이의 단위는 벽의 구멍 간격이다.
# 물건의 폭은 늘 짝수 칸이고 줄의 왼쪽 끝에서 정수 칸만큼 떨어져 놓이며(다 들어가는 줄은 가운데로 모아도 정수 칸),
# 밀다가 멈추는 자리도 물건의 시작(scroll-snap)이라, 가운데에 건 고리의 두 다리는 멈추면 늘 벽의 구멍에 꽂힌다.
# 물건마다 (폭 칸, 봉지 크기 비 s)를 넓은 화면과 폰(735px 이하)에 따로 둔다.

GAP = 2  # 물건 사이(칸)
# 넓은 화면은 한 화면에 칸이 1.5~2줄 보이게(큰 봉지 5칸), 폰(735px 이하)은 원래 크기 그대로다.
# 넓은 화면의 폭은 홀수 칸이라 줄을 반 칸 들여 시작한다(가운데가 칸 경계에 와야 고리 두 다리가 구멍에 꽂힌다).
SIZE = {
    "big": ((5, 0.5), (10, 1.0)),
    "mini": ((5, 0.65), (8, 1.2)),
    "wide": ((7, 0.65), (12, 1.2)),
    "photo": ((9, 0.65), (16, 1.2)),
}
WALL = {"wide": 36, "tablet": 22}  # 벽의 칸 수(넓은 화면, 936px 미만 태블릿)
HEIGHT = {"big": 17.5, "mini": 13.6, "wide": 15}  # 봉지 높이(봉지의 p 단위)
SHADOW = 1  # 봉지 아래 그림자가 잘리지 않게 줄 아래에 두는 칸
# 그림 카드(회사 프로젝트·논문): 그림이 주인공이라 카드를 넓히고, 그림을 카드 폭에 가깝게 3:2 로 둔다.
# 넓은 카드라 이름이 한 줄이어서 이름 칸은 작은 봉지(5.6)보다 낮다. 그림 칸 = 위 여백 + 그림(카드 폭 - 좌우 여백, 3:2)
# + 한 줄(두 줄까지)과 「보기」. 아래 글은 글씨에 px 하한이 있어 칸(P)이 가장 작을 때 가장 길므로, 줄 높이는 그때로 잡는다.
# CSS(.pack--photo)가 같은 값으로 그린다.
PHOTO = {"head": 4.6, "top": 0.15, "inset": 0.35, "ratio": 1.5}
P_MIN = (24, (320 - 32) / 22)  # 가장 작은 칸(px): 넓은 화면·태블릿, 폰


def kind_of(item):
    if isinstance(item, str):
        return "big"
    if item.get("photo"):
        return "photo"
    return "wide" if item.get("wide") else "mini"


def photo_img(w, s):
    """그림 카드의 그림 높이(봉지의 p). 카드 폭(w 칸 = w/s p)을 따라 커진다."""
    return (w / s - 2 * PHOTO["inset"]) / PHOTO["ratio"]


def photo_tail(s, i):
    """그림 아래 한 줄(두 줄까지)과 「보기」 칸(봉지의 p): 여백 1.2 + 두 줄 max(33.6px, 1.4p) + 「보기」 max(15.6px, 0.6p)"""
    p = P_MIN[i] * s
    return 1.2 + max(33.6 / p, 1.4) + max(15.6 / p, 0.6)


def reach(kind, w, s, i):
    """고리 꼭대기부터 봉지 아래까지(칸). 봉지 구멍(위에서 0.5625)이 고리 끝(2칸)에 걸린다. i: 0 넓은 화면, 1 폰"""
    if kind == "photo":
        height = PHOTO["head"] + PHOTO["top"] + photo_img(w, s) + photo_tail(s, i)
    else:
        height = HEIGHT[kind]
    return math.ceil(2 - 0.5625 * s + height * s)


def render_item(item, place, level=3):
    if item == "about":
        return about_pack(place, level)
    if isinstance(item, str):
        return pack(APP_BY_ID[item.removeprefix("app:")], place, level)
    return mini_pack(item, place, level)


def item_style(item):
    kind = kind_of(item)
    (w, s), (nw, ns) = SIZE[kind]
    img = f";--pi:{photo_img(w, s):.3f};--npi:{photo_img(nw, ns):.3f}" if kind == "photo" else ""
    return f' style="--w:{w};--s:{s};--nw:{nw};--ns:{ns}{img}"'


def heights(items):
    """줄 높이(칸): 넓은 화면, 폰"""
    kinds = [kind_of(item) for item in items]
    return tuple(max(reach(k, *SIZE[k][i], i) for k in kinds) + SHADOW for i in (0, 1))


def pop_html(pop):
    if not pop:
        return ""
    return f'\n<a class="pop" href="{esc(pop["href"])}"><b>{esc(pop["top"])}</b><span>{esc(pop["sub"])}</span></a>'


def aisle(row):
    if row.get("bays"):
        return bay_aisle(row)
    items = row["items"]
    height, narrow_height = heights(items)
    total = sum(SIZE[kind_of(item)][0][0] for item in items) + GAP * (len(items) - 1)
    # 다 들어가는 줄은 가운데 가까이 둔다. 들여 쓰는 칸은 1.5 + 정수라 시작이 늘 반 칸에 선다.
    lead = {key: 1.5 + max(0, (cols - 3 - total) // 2) for key, cols in WALL.items()}
    pegs = "\n".join(render_item(item, item_style(item)) for item in items)
    return f"""<section class="aisle aisle--{row["id"]}" aria-labelledby="a-{row["id"]}">
<h2 class="aisle__name" id="a-{row["id"]}">{esc(row["name"])} <span class="aisle__count">{len(items)}</span></h2>{pop_html(row.get("pop"))}
<div class="line" style="--h:{height};--nh:{narrow_height};--lead:{lead["wide"]};--tlead:{lead["tablet"]}">
<ul class="hooks">
{pegs}
</ul>
</div>
</section>"""


# ── 한 줄을 나눈 칸(bay) ──
# 한 줄에 칸을 여럿 두면 칸마다 띠를 따로 박고, 띠도 물건과 함께 옆으로 밀린다.
#  - 이름이 있는 줄(개인 프로젝트)은 한 갈래를 나눈 것이라 띠마다 줄 이름을 작게 앞에 적는다(개인 프로젝트 › 앱).
#  - 이름이 없는 줄(연구·논문 + 대회·창업)은 갈래 둘이 한 줄을 나눠 쓰는 것이라 띠가 곧 칸 이름이다.
# 띠는 정수 칸에서 시작하고 끝나야 양 끝 나사가 구멍에 박힌다. 넓은 크기의 물건은 폭이 홀수라 칸 안에서 반 칸 들여 놓는다.
# 다 들어가는 줄은 띠가 벽 양 끝까지 닿게 칸을 늘리고 물건을 칸 가운데로 모은다.

MODES = {
    # 벽 칸 수, 물건 크기(SIZE 의 앞·뒤), 줄 끝에서 첫 물건까지, 칸 경계에서 물건까지, 띠 사이, 띠 글씨·안쪽 여백(칸)
    "wide": {"wall": WALL["wide"], "size": 0, "edge": 1.5, "inner": 0.5, "gap": 2, "font": 0.66, "pad": 0.9},
    "tablet": {"wall": WALL["tablet"], "size": 0, "edge": 1.5, "inner": 0.5, "gap": 2, "font": 0.66, "pad": 0.9},
    "narrow": {"wall": 22, "size": 1, "edge": 1, "inner": 1, "gap": 1, "font": 1.05, "pad": 1.1},
}


def text_em(text):
    """글자 폭 어림(em): 한글 0.95, 가운뎃점·띄어쓰기 0.32, 그 밖 0.56"""
    return sum(0.95 if ord(ch) > 0x2E80 else 0.32 if ch in " ·" else 0.56 for ch in text)


def label_cols(bay, kicker, m):
    """띠 글씨가 차지하는 폭(칸). 이름, 개수 딱지(0.88em), 사이(0.45em), 앞에 작게 적는 줄 이름(0.78배와 › 표)."""
    em = text_em(bay["name"]) + 0.45 + 0.88
    if kicker:
        em += 0.78 * text_em(kicker) + 1.0
    return 2 * m["pad"] + m["font"] * em + 1


def place_bays(bays, kicker, m):
    """칸마다 (띠 폭, 첫 물건까지 들인 칸)과 띠 사이를 정한다. 단위는 벽의 칸."""
    n = len(bays)
    spans, lows, highs = [], [], []
    for i, bay in enumerate(bays):
        spans.append(sum(SIZE[kind_of(it)][m["size"]][0] for it in bay["items"]) + GAP * (len(bay["items"]) - 1))
        lows.append(m["edge"] if i == 0 else m["inner"])
        highs.append(m["edge"] if i == n - 1 else m["inner"])
    natural = [
        max(int(lows[i] + spans[i] + highs[i]), math.ceil(label_cols(bay, kicker, m))) for i, bay in enumerate(bays)
    ]

    def inset(i, width):
        """칸 가운데에 가장 가까운 들임. 넓은 크기는 반 칸(x.5), 폰은 정수 칸이고, 양쪽 최소 여백을 지킨다."""
        base = 0.5 if m["size"] == 0 else 0
        best = None
        for k in range(int(width) + 1):
            left = base + k
            if left < lows[i] or width - spans[i] - left < highs[i]:
                continue
            err = abs(left - (width - spans[i]) / 2)
            if best is None or err < best[0]:
                best = (err, left)
        return best

    choices = []
    for gap in (1, 2, 3):
        room = m["wall"] - gap * (n - 1)
        if sum(natural) > room:
            continue
        # 늘린 칸 폭을 모두 해 보고(칸은 두세 개뿐), 가운데에 가깝고 원래 폭의 비율에 가까운 것을 고른다
        for extra in itertools.product(range(room - sum(natural) + 1), repeat=n - 1):
            widths = [natural[i] + extra[i] for i in range(n - 1)]
            widths.append(room - sum(widths))
            if widths[-1] < natural[-1]:
                continue
            spots = [inset(i, w) for i, w in enumerate(widths)]
            if None in spots:
                continue
            score = (
                10 * sum(s[0] for s in spots)
                + sum(abs(w - natural[i] * room / sum(natural)) for i, w in enumerate(widths))
                + abs(gap - m["gap"])
            )
            choices.append((score, gap, [(w, s[1]) for w, s in zip(widths, spots)]))
    if choices:
        _, gap, plan = min(choices, key=lambda c: c[0])
        return gap, plan
    # 다 들어가지 않으면 원래 폭대로 놓고 옆으로 민다
    return m["gap"], [(w, lows[i]) for i, w in enumerate(natural)]


def bay_aisle(row):
    bays = row["bays"]
    kicker = row.get("name")
    height, narrow_height = heights([it for bay in bays for it in bay["items"]])
    plans = {mode: place_bays(bays, kicker, m) for mode, m in MODES.items()}
    prefix = {"wide": "", "tablet": "t", "narrow": "n"}
    # 이름이 있는 줄은 줄 이름이 h2, 띠가 h3, 물건이 h4. 이름이 없는 줄은 띠가 곧 칸 이름(h2)이다.
    level = 3 if kicker else 2
    parts = []
    for i, bay in enumerate(bays):
        style = ";".join(
            f"--{prefix[mode]}bw:{plan[1][i][0]};--{prefix[mode]}bo:{plan[1][i][1]:g}" for mode, plan in plans.items()
        )
        small = f'<small class="aisle__kicker" aria-hidden="true">{esc(kicker)}</small>' if kicker else ""
        pegs = "\n".join(render_item(item, item_style(item), level + 1) for item in bay["items"])
        # 판촉 스티커는 그 칸의 띠 오른쪽 끝에 붙어 칸과 함께 밀린다
        parts.append(
            f'<section class="bay bay--{bay["id"]}" style="{style}" aria-labelledby="a-{bay["id"]}">\n'
            f'<h{level} class="aisle__name" id="a-{bay["id"]}">{small}{esc(bay["name"])} '
            f'<span class="aisle__count">{len(bay["items"])}</span></h{level}>{pop_html(bay.get("pop"))}\n'
            f'<ul class="bay__pegs">\n{pegs}\n</ul>\n</section>'
        )
    gaps = ";".join(f"--{prefix[mode]}g:{plan[0]}" for mode, plan in plans.items())
    label = kicker or ", ".join(bay["name"] for bay in bays)
    tag = "section" if kicker else "div"
    labelled = f' aria-labelledby="a-{row["id"]}"' if kicker else ""
    title = f'\n<h2 class="vh" id="a-{row["id"]}">{esc(kicker)}</h2>' if kicker else ""
    return f"""<{tag} class="aisle aisle--bays aisle--{row["id"]}"{labelled}>{title}
<div class="line line--bays" data-name="{esc(label)}" style="--h:{height};--nh:{narrow_height};{gaps}">
<div class="hooks">
{chr(10).join(parts)}
</div>
</div>
</{tag}>"""


def shelf_items():
    """진열대에 건 물건 모두(칸을 나눈 줄 포함)"""
    for row in SHELF["rows"]:
        for items in [bay["items"] for bay in row["bays"]] if row.get("bays") else [row["items"]]:
            yield from items


# ── 만든 사람: 진열대 벽에 붙인 스티커 묶음(사진, 이름표, 학력·자격 딱지) ──


def maker(profile):
    # 폴라로이드 사진: 사진이 있으면 그 사진, 없으면 이름 글자. 아래 넓은 여백에 이름을 적는다.
    # 사진 칸은 증명사진 비율(3.5×4.5)이고, 다른 비율의 사진은 칸에 맞춰 가장자리가 잘린다(object-fit: cover).
    # 사진과 포스트잇은 걸린 봉지처럼 흔들리고 마우스·기울기를 따른다(data-sway, wall.js·light.js). 이름표는 통째로 붙인 스티커라 그대로다.
    if profile.get("photo"):
        pic = f'<img src="{esc(profile["photo"])}" width="350" height="450" alt="">'
    else:
        pic = f'<span class="maker__mono">{esc(profile["monogram"])}</span>'
    photo = f'<span class="polaroid__pic">{pic}</span><span class="polaroid__cap">{esc(profile.get("caption", DEV))}</span>'
    def mark(x, cls):
        """학교·기관 마크. 파일이 있을 때만 붙인다(글자가 이름을 알리므로 그림은 꾸밈)."""
        logo = x.get("logo")
        if not logo or not (ROOT / logo.lstrip("/")).exists():
            return ""
        return f'<img class="{cls}" src="{esc(logo)}" alt="" loading="lazy">'

    def note(x, extra=""):
        """포스트잇 한 장: 제목(학력·경력)과 줄마다 마크·이름·기간·한 줄. extra 는 모서리에 붙일 작은 딱지."""
        rows = "".join(
            f'<li>{mark(r, "note__logo")}<span class="note__text"><span class="note__head"><b>{esc(r["name"])}</b>'
            f'<small>{esc(r["when"])}</small></span><span>{esc(r["detail"])}</span></span></li>'
            for r in x["rows"]
        )
        return (
            f'<li class="note" data-sway style="--tone:{x["tone"]};--tilt:{x["tilt"]}deg">'
            f'<p class="note__title">{esc(x["title"])}</p><ul class="note__rows">{rows}</ul>{extra}</li>'
        )

    def seal(x):
        """자격증 딱지. 소개 묶음 맨 끝(마지막 포스트잇의 오른쪽 아래 모서리)에 작게 붙인다."""
        return (
            f'<span class="seal" style="--tone:{x["tone"]};--tilt:{x["tilt"]}deg">{mark(x, "seal__logo")}'
            f'<b>{esc(x["top"])}</b><small>{esc(x["sub"])}</small></span>'
        )

    note_items = [x for x in profile["stickers"] if x["kind"] == "note"]
    seals = "".join(seal(x) for x in profile["stickers"] if x["kind"] == "seal")
    notes = "\n".join(note(x, seals if i == len(note_items) - 1 else "") for i, x in enumerate(note_items))
    href = esc(profile["href"])
    return f"""<section class="maker" aria-label="{esc(profile["label"])}">
<a class="maker__photo polaroid" href="{href}" tabindex="-1" aria-hidden="true" data-sway>{photo}</a>
<a class="maker__card" href="{href}">
  <span class="maker__tag">{esc(profile["label"])}</span>
  <strong class="maker__role">{esc(profile["role"])}</strong>
  <span class="maker__org">{esc(profile["org"])}</span>
  <span class="maker__line">{esc(profile["line"])}</span>
  <span class="maker__go">소개 보기 {ICON_GO}</span>
</a>
<ul class="maker__stickers" aria-label="학력과 경력">
{notes}
</ul>
</section>"""


ABOUT_ICON = (
    '<svg class="app-icon" viewBox="0 0 120 120" aria-hidden="true" focusable="false">'
    '<rect width="120" height="120" rx="27" fill="#ffe55c"/>'
    '<path d="M48 22v7a6 6 0 0 0 6 6h12a6 6 0 0 0 6-6v-7M60 35v14" fill="none" stroke="#6a6962" stroke-width="5" stroke-linecap="round"/>'
    '<g transform="rotate(-4 60 74)"><rect x="24" y="48" width="72" height="46" rx="5" fill="#fff" stroke="#17171a" stroke-width="3.5"/>'
    '<circle cx="60" cy="55" r="3.2" fill="#6a6962"/>'
    '<rect x="34" y="64" width="34" height="7" rx="3.5" fill="#17171a"/>'
    '<rect x="34" y="77" width="48" height="4" rx="2" fill="#a3a199"/>'
    '<rect x="34" y="85" width="40" height="4" rx="2" fill="#a3a199"/></g></svg>'
)


WRITTEN = set()


def write(path, text):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text)
    WRITTEN.add(path)
    print(path)


# ── 첫 화면: 진열대 ──

names = ", ".join(app["name"] for app in APPS[:6]) + (" 등" if len(APPS) > 6 else "")
write(
    "index.html",
    head(f"{DEV} · {SITE['tagline']}", f"{DEV} · {SITE['tagline']}. {names}.", "/", ["wall.js", "light.js", "aisle.js"])
    + f"""<body class="home">
<a class="skip" href="#apps">목록으로 건너뛰기</a>
<div class="wall">
{sign(True)}
<main id="apps" class="aisles">
{maker(SHELF["profile"])}
{chr(10).join(aisle(row) for row in SHELF["rows"])}
</main>
{FOOT}
</div>
</body>
</html>
""",
)

# ── 앱 페이지: 봉지의 뒷면. 앱 장터의 앱 화면처럼 짠다 ──


PLAY_BADGE = '<img class="badge-play" src="/assets/img/google-play-badge.png" width="646" height="192" alt="{alt}">'
PLAY_LEGAL = "Google Play 및 Google Play 로고는 Google LLC의 상표입니다."


def has_play(app):
    """플레이에 낼 안드로이드 앱인지. 시험용 APK 로만 나눈 앱은 platforms 에 "play": false 를 적는다."""
    return any(p["name"] == "Android" and p.get("play", True) for p in app["platforms"])


def get_buttons(app):
    """받기 단추. 안드로이드 앱은 Google Play 배지를 늘 보이고, 스토어 주소(store)가 생기면 그 주소로 잇는다."""
    parts = []
    for p in app["platforms"]:
        if p["name"] == "Android" and p.get("play", True):
            if p.get("store"):
                parts.append(f'<a class="store-badge" href="{esc(p["store"])}">{PLAY_BADGE.format(alt="Google Play에서 다운로드")}</a>')
            else:
                parts.append(
                    f'<span class="store-badge store-badge--wait">{PLAY_BADGE.format(alt="Google Play에서 다운로드")}'
                    f'<span class="store-badge__note">{esc(app["status"])}</span></span>'
                )
        elif p.get("store"):
            parts.append(f'<a class="get" href="{esc(p["store"])}">{esc(p.get("storeLabel") or STORE.get(p["name"], p["name"]))}</a>')
    return "".join(parts) or f'<span class="get get--wait">{esc(app["status"])}</span>'


def fact(label, value, note=""):
    note_html = f'<span class="fact__note">{esc(note)}</span>' if note else ""
    return f'<li><span class="fact__label">{esc(label)}</span><span class="fact__value">{esc(value)}</span>{note_html}</li>'


def facts(app):
    first = app["platforms"][0]
    if len(app["platforms"]) == 1:
        cells = [fact("버전", app["version"]), fact("호환성", first["name"], first.get("requires", ""))]
    else:
        cells = [fact("버전", app["version"]), fact("호환성", " · ".join(p.get("short", p["name"]) for p in app["platforms"]))]
    return "\n      ".join(cells)


def info(app):
    rows = [("제공자", DEV), ("호환성", compat(app)), ("버전", app["version"])]
    rows += [tuple(row) for row in app.get("info", [])]
    if app.get("package"):
        rows.append(("패키지 이름", app["package"]))
    rows.append(("저작권", f'© {SITE["year"]} {DEV}'))
    cells = [f"<div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>" for k, v in rows]
    # 방침을 쓴 앱에만 단다. 앱 장터처럼 정보 맨 끝에 둔다.
    if app.get("privacy"):
        cells.append(f'<div class="info__more"><dt>개인정보처리방침</dt><dd><a href="/{app["id"]}/privacy">보기 {ICON_GO}</a></dd></div>')
    return "\n      ".join(cells)


def demo(app):
    if not app["demo_html"]:
        return ""
    return f"""<section class="sec" aria-labelledby="h-demo">
      <h2 id="h-demo">{esc(app.get("demoTitle", "직접 해 보기"))}</h2>
      {app["demo_html"]}
    </section>"""


def others(app):
    rows = []
    for other in APPS:
        if other["id"] == app["id"]:
            continue
        rows.append(
            f'<li><a href="/{other["id"]}/"><img src="/assets/img/{other["id"]}/icon.webp" width="256" height="256" alt="" loading="lazy">'
            f'<span><b>{esc(other["name"])}</b><span>{esc(other["line"])}</span></span><span class="get get--small">보기</span></a></li>'
        )
    if not rows:
        return ""
    return f"""<section class="sec" aria-labelledby="h-others">
      <h2 id="h-others">{esc(DEV)}의 다른 작업</h2>
      <ul class="others">
      {chr(10).join("      " + row for row in rows).strip()}
      </ul>
    </section>"""


for app in APPS:
    app_id = app["id"]
    about = "\n      ".join(f"<p>{esc(text)}</p>" for text in app["about"])
    features = "\n        ".join(f"<li>{esc(text)}</li>" for text in app["features"])
    write(
        f"{app_id}/index.html",
        head(f'{app["name"]} · {app["line"]} | {DEV}', app["lead"], f"/{app_id}/", [*app.get("scripts", []), "shots.js", "light.js"])
        + f"""<body>
<a class="skip" href="#app">본문으로 건너뛰기</a>
<div class="wall">
{sign(False)}
<main id="app">
<article class="back back--{app_id}" style="{tone_style(app)}">
  {HOOK.format(style=' style="--hx:-7"')}
  {TIP.format(style=' style="--hx:-7"')}
  {HOOK.format(style=' style="--hx:7"')}
  {TIP.format(style=' style="--hx:7"')}
  <div class="listing" style="view-transition-name:pack-{app_id}">
  <div class="listing__paper"></div>
  <div class="listing__in">
    <header class="app-head">
      <img class="app-icon" src="/assets/img/{app_id}/icon.webp" width="256" height="256" alt="">
      <div>
        <h1 class="app-name">{esc(app["name"])}</h1>
        <p class="app-sub">{esc(app["line"])}</p>
        <p class="app-dev"><a href="{"/about/" if ABOUT else "/"}">{esc(DEV)}</a></p>
        <p class="app-get">{get_buttons(app)}</p>
      </div>
    </header>
    <ul class="app-facts" aria-label="한눈에 보기">
      {facts(app)}
    </ul>
    <section class="sec" aria-labelledby="h-preview">
      <h2 id="h-preview">미리보기</h2>
      {app["preview_html"]}
    </section>
    {demo(app)}
    <section class="sec desc" aria-label="설명">
      <p class="desc__lead">{esc(app["lead"])}</p>
      {about}
      <ul>
        {features}
      </ul>
    </section>
    {news(app)}
    <section class="sec" aria-labelledby="h-info">
      <h2 id="h-info">정보</h2>
      <dl class="info">
      {info(app)}
      </dl>
    </section>
    {others(app)}
    <footer class="imprint">{barcode(code(app))}<span>{esc(code(app))}</span>{f'<small class="imprint__legal">{PLAY_LEGAL}</small>' if has_play(app) else ""}</footer>
  </div>
  </div>
</article>
</main>
{FOOT}
</div>
</body>
</html>
""",
    )

# ── 개인정보처리방침: 벽에 붙인 흰 종이 한 장. 효과 없이 글만 둔다 ──
# 앱 안에서 누르고 들어오는 일이 많아 폰 화면을 먼저 생각한다. 주소는 /<앱>/privacy 로 고정이다.
# 플레이 스토어와 앱에서 누구나 들어오는 곳이라, 포트폴리오(첫 화면·앱 페이지·소개·GitHub)로 가는 길을 두지 않는다.
#   팻말(이름 링크·뒤로 단추)과 발치의 GitHub 링크를 빼고, 링크 미리보기에도 첫 화면 그림(og.png)을 쓰지 않는다.

COMMON_PRIVACY = (TOOL / "privacy-common.html").read_text().strip()


def date_long(text):
    year, month, day = text.split("-")
    return f"{int(year)}년 {int(month)}월 {int(day)}일"


def fill(text, app):
    """방침 본문의 {{...}} 자리를 채운다."""
    email = esc(SITE["email"])
    for key, value in {
        "{{app}}": esc(app["name"]),
        "{{developer}}": esc(DEV),
        "{{email}}": f'<a href="mailto:{email}">{email}</a>',
        "{{date}}": date_long(app["privacy"]["date"]),
    }.items():
        text = text.replace(key, value)
    return text


for app in APPS:
    if not app.get("privacy"):
        continue
    app_id = app["id"]
    policy = app["privacy"]
    title = f'{app["name"]} 개인정보처리방침'
    write(
        f"{app_id}/privacy.html",
        head(f"{title} | {DEV}", f"{title}. 다루는 정보와 쓰는 권한, 문의처를 적었습니다.", f"/{app_id}/privacy", preview=False)
        + f"""<body>
<div class="wall">
<main id="doc">
<article class="doc" style="{tone_style(app)}">
  <header class="doc__head">
    <img class="doc__icon" src="/assets/img/{app_id}/icon.webp" width="256" height="256" alt="">
    <div>
      <h1>{esc(title)}</h1>
      <p class="doc__meta">시행일 <time datetime="{policy["date"]}">{date_ko(policy["date"])}</time> · {esc(DEV)}</p>
    </div>
  </header>
  {fill(app["privacy_html"], app)}
  {fill(COMMON_PRIVACY, app)}
</article>
</main>
{FOOT_PLAIN}
</div>
</body>
</html>
""",
    )

# ── 소개: 명함의 뒷면. 장터의 개발자 페이지처럼 짠다 ──

if ABOUT:
    a = ABOUT
    about_facts = "\n      ".join(fact(f["label"], f["value"], f.get("note", "")) for f in a["facts"])
    about_text = "\n      ".join(f"<p>{esc(t)}</p>" for t in a["about"])
    def cv_list(entries):
        rows = []
        for x in entries:
            link = f' <a href="{esc(x["link"])}">{esc(x["linkLabel"])}</a>' if x.get("link") else ""
            notes = f'<p>{esc(x["notes"])}{link}</p>' if x.get("notes") else ""
            rows.append(
                f'<li><div class="cv__head"><b>{esc(x["org"])}</b><span>{esc(x["unit"])}</span><time>{esc(x["period"])}</time></div>{notes}</li>'
            )
        return "\n        ".join(rows)

    def cv_section(key, title, entries):
        if not entries:
            return ""
        return f"""<section class="sec" aria-labelledby="h-{key}">
      <h2 id="h-{key}">{title}</h2>
      <ol class="cv">
        {cv_list(entries)}
      </ol>
    </section>"""

    cv = cv_list(a["career"] + a.get("education", []))
    more_cv = "\n    ".join(
        filter(None, [
            cv_section("certs", "자격증", a.get("certs")),
            cv_section("work", "회사 프로젝트", [dict(w, link=f'/work/{w["slug"]}/', linkLabel="자세히 보기") for w in a.get("work", [])]),
            cv_section("research", "연구·논문", a.get("research")),
            cv_section("startup", "대회·창업", a.get("startup")),
        ])
    )
    # main 이 참인 줄(주력)은 노란 칩으로 진하게 보인다
    skills = "\n        ".join(
        f'<div{" class=" + chr(34) + "skills__main" + chr(34) if g.get("main") else ""}><dt>{esc(g["group"])}</dt>'
        f'<dd><ul class="chips">{"".join(f"<li>{esc(i)}</li>" for i in g["items"])}</ul></dd></div>'
        for g in a["skills"]
    )
    works = "\n      ".join(
        f'<li><a href="/{w["id"]}/"><img src="/assets/img/{w["id"]}/icon.webp" width="256" height="256" alt="" loading="lazy">'
        f'<span><b>{esc(w["name"])}</b><span>{esc(w["line"])}</span></span><span class="get get--small">보기</span></a></li>'
        for w in APPS
    )
    tools = "\n      ".join(
        f'<li><a href="{esc(t["repo"])}"><span class="tool"><span class="tool__head"><b>{esc(t["name"])}</b>'
        f'<span class="tool__kind">{esc(t["kind"])}</span></span><span class="tool__line">{esc(t["line"])}</span></span>'
        f'<span class="get get--small">GitHub</span></a></li>'
        for t in a.get("tools", [])
    )
    tools_sec = f"""<section class="sec" aria-labelledby="h-tools">
      <h2 id="h-tools">공개한 도구</h2>
      <ul class="others tools">
      {tools}
      </ul>
    </section>""" if a.get("tools") else ""
    write(
        "about/index.html",
        head(f"소개 | {DEV}", f'{DEV} · ' + " · ".join(f'{x["org"]} {x["unit"]}' for x in a["career"][:1] + a.get("education", [])[:1]) + ".", "/about/", ["light.js"])
        + f"""<body>
<a class="skip" href="#app">본문으로 건너뛰기</a>
<div class="wall">
{sign(False)}
<main id="app">
<article class="back back--about" style="{ABOUT_STYLE_PAGE}">
  {HOOK.format(style=' style="--hx:-7"')}
  {TIP.format(style=' style="--hx:-7"')}
  {HOOK.format(style=' style="--hx:7"')}
  {TIP.format(style=' style="--hx:7"')}
  <div class="listing" style="view-transition-name:pack-about">
  <div class="listing__paper"></div>
  <div class="listing__in">
    <header class="app-head">
      {ABOUT_ICON}
      <div>
        <h1 class="app-name">{esc(DEV)}</h1>
        <p class="app-sub">{esc(a["headline"])}</p>
        <p class="app-dev app-dev--plain">{esc(SITE["tagline"])}</p>
        <p class="app-get"><a class="get" href="{SITE["github"]}" rel="me">GitHub</a></p>
      </div>
    </header>
    <ul class="app-facts" aria-label="한눈에 보기">
      {about_facts}
    </ul>
    <section class="sec desc" aria-label="소개">
      <p class="desc__lead">{esc(a["lead"])}</p>
      {about_text}
    </section>
    <section class="sec" aria-labelledby="h-cv">
      <h2 id="h-cv">경력과 학력</h2>
      <ol class="cv">
        {cv}
      </ol>
    </section>
    {more_cv}
    <section class="sec" aria-labelledby="h-skills">
      <h2 id="h-skills">다루는 기술</h2>
      <dl class="skills">
        {skills}
      </dl>
    </section>
    <section class="sec" aria-labelledby="h-works">
      <h2 id="h-works">만든 것</h2>
      <ul class="others">
      {works}
      </ul>
    </section>
    {tools_sec}
    <footer class="imprint">{barcode(GITHUB_HOST)}<span>{esc(GITHUB_HOST)}</span></footer>
  </div>
  </div>
</article>
</main>
{FOOT}
</div>
</body>
</html>
""",
    )

# ── 회사 프로젝트: 진열대 작은 봉지의 뒷면. 앱 페이지와 같은 틀에 개요·맡은 일·쓴 기술·자료(이미지·영상) ──
# 자료는 about.json 의 work[].media 에 {"type": "image"|"video", "src", "poster", "w", "h", "alt", "caption", "generated"} 로 적으면 나온다.
# caption 은 그림 아래 짧은 설명이고, generated 가 참이면 「생성 이미지」 딱지가 붙는다(실제 자료가 없어 만든 그림).

if ABOUT and ABOUT.get("work"):
    minis = {it["href"]: it for it in shelf_items() if isinstance(it, dict)}
    works = ABOUT["work"]

    def work_tone(w):
        mini = minis.get(f'/work/{w["slug"]}/', {})
        return mini, f'--tone:{mini.get("tone", "#ffffff")};--tone-ink:{mini.get("ink", "#17171a")};--accent:{mini.get("ink", "#17171a")}'

    def work_art(mini, cls):
        """회사 프로젝트의 대표 그림: 진열대 카드와 같은 그림(image)이 있으면 그것, 없으면 도식(art)."""
        if mini.get("image"):
            w, h = mini.get("imageSize", [600, 316])
            return f'<span class="{cls} {cls}--photo"><img src="{esc(mini["image"])}" width="{w}" height="{h}" alt=""></span>'
        art = ART.get(mini.get("art"))
        return f'<span class="{cls}"><svg viewBox="0 0 120 64" aria-hidden="true" focusable="false">{art}</svg></span>' if art else ""

    def media_html(w):
        items = []
        for m in w.get("media", []):
            note = '<span class="shots__note">생성 이미지</span>' if m.get("generated") else ""
            cap = f'<p class="shots__cap">{esc(m["caption"])}{note}</p>' if m.get("caption") else ""
            if m["type"] == "video":
                poster = f' poster="{esc(m["poster"])}"' if m.get("poster") else ""
                items.append(
                    f'<li class="shots__video"><video src="{esc(m["src"])}"{poster} width="{m["w"]}" height="{m["h"]}" '
                    f'muted loop playsinline controls preload="metadata" aria-label="{esc(m.get("alt", ""))}"></video>{cap}</li>'
                )
            else:
                items.append(f'<li><img src="{esc(m["src"])}" width="{m["w"]}" height="{m["h"]}" alt="{esc(m.get("alt", ""))}" loading="lazy">{cap}</li>')
        if not items:
            return ""
        return f"""<section class="sec" aria-labelledby="h-media">
      <h2 id="h-media">자료</h2>
      <ul class="shots shots--wide shots--work">
        {chr(10).join(items)}
      </ul>
    </section>"""

    for w in works:
        mini, style = work_tone(w)
        did = "\n        ".join(f"<li>{esc(x)}</li>" for x in w.get("did", []))
        stack = "".join(f"<li>{esc(x)}</li>" for x in w.get("stack", []))
        others_rows = []
        for o in works:
            if o is w:
                continue
            omini, ostyle = work_tone(o)
            others_rows.append(
                f'<li><a href="/work/{o["slug"]}/">{work_art(omini, "work-thumb").replace("<span class=", f"<span style={chr(34)}{ostyle}{chr(34)} class=", 1)}'
                f'<span><b>{esc(o["org"])}</b><span>{esc(o["unit"])} · {esc(o["period"])}</span></span><span class="get get--small">보기</span></a></li>'
            )
        scripts = ["shots.js", "light.js"] if w.get("media") else ["light.js"]
        write(
            f'work/{w["slug"]}/index.html',
            head(f'{w["org"]} · {w["unit"]} | {DEV}', w["summary"], f'/work/{w["slug"]}/', scripts)
            + f"""<body>
<a class="skip" href="#app">본문으로 건너뛰기</a>
<div class="wall">
{sign(False)}
<main id="app">
<article class="back back--work" style="{style}">
  {HOOK.format(style=' style="--hx:-7"')}
  {TIP.format(style=' style="--hx:-7"')}
  {HOOK.format(style=' style="--hx:7"')}
  {TIP.format(style=' style="--hx:7"')}
  <div class="listing">
  <div class="listing__paper"></div>
  <div class="listing__in">
    <header class="app-head work-head">
      {work_art(mini, "work-art")}
      <div>
        <h1 class="app-name">{esc(w["org"])}</h1>
        <p class="app-sub">{esc(w["summary"])}</p>
        <p class="app-dev"><a href="/about/#h-work">{esc(DEV)}</a></p>
      </div>
    </header>
    <ul class="app-facts" aria-label="한눈에 보기">
      {fact("회사", w["unit"])}
      {fact("기간", w["period"])}
      {fact("맡은 일", w["role"])}
    </ul>
    <section class="sec desc" aria-label="설명">
      <p>{esc(w["notes"])}</p>
    </section>
    <section class="sec desc" aria-labelledby="h-did">
      <h2 id="h-did">맡은 일</h2>
      <ul>
        {did}
      </ul>
    </section>
    <section class="sec" aria-labelledby="h-stack">
      <h2 id="h-stack">쓴 기술</h2>
      <ul class="chips">{stack}</ul>
    </section>
    {media_html(w)}
    <section class="sec" aria-labelledby="h-others">
      <h2 id="h-others">다른 회사 프로젝트</h2>
      <ul class="others">
      {chr(10).join("      " + r for r in others_rows).strip()}
      </ul>
    </section>
    <footer class="imprint">{barcode(w["slug"])}<span>{esc(w["slug"])}</span></footer>
  </div>
  </div>
</article>
</main>
{FOOT}
</div>
</body>
</html>
""",
        )

# ── 빈 고리(404) ──

write(
    "404.html",
    head(f"빈 고리 | {DEV}", "찾는 페이지가 여기에는 걸려 있지 않습니다.", "/404.html", ["wall.js", "light.js"], index=False)
    + f"""<body>
<div class="wall">
{sign(False)}
<main class="empty">
  <div class="peg">
    {HOOK.format(style="")}
    <div class="pack pack--note" data-sway style="--rest:1.4deg">
      <div class="card">
        <h1>빈 고리입니다</h1>
        <p>찾는 페이지가 여기에는 걸려 있지 않습니다.</p>
        <a class="btn" href="/">{ICON_BACK} 진열대로</a>
      </div>
      <span class="pack__holo" aria-hidden="true"></span>
      <span class="pack__glare" aria-hidden="true"></span>
    </div>
    {TIP.format(style="")}
  </div>
</main>
{FOOT}
</div>
</body>
</html>
""",
)

# ── 한 번 공개한 주소는 지키기 ──
# keep 의 페이지는 앱 안 링크와 플레이 콘솔에 걸려 있다. 빠지면 구글 심사에서 걸리므로 여기서 멈춘다.

missing = [path for path in SITE.get("keep", []) if path not in WRITTEN]
if missing:
    raise SystemExit("만들지 못한 페이지가 있습니다(앱과 플레이 콘솔에 주소가 걸려 있어 지우면 안 됩니다): " + ", ".join(missing))
