"""사이트의 HTML 을 만든다. 표준 라이브러리만 쓴다.

    python3 tool/build.py

읽는 것
  tool/site.json            개발자 이름, 이름 아래 소개 한 줄, 주소, 앱 순서
  tool/apps/<앱>/app.json   앱 한 개의 정보
  tool/apps/<앱>/pack.html  진열대의 봉지 속에 넣을 물건
  tool/apps/<앱>/preview.html  앱 페이지의 「미리보기」에 넣을 내용
  tool/apps/<앱>/demo.html  (있으면) 미리보기 아래에 따로 두는 구역. 제목은 app.json 의 demoTitle
  tool/about.json           (있으면) 진열대 맨 앞의 명함과 소개 페이지(/about/)

쓰는 것
  index.html, <앱>/index.html, about/index.html, 404.html

앱을 더할 때는 tool/apps/_template 을 복사해 고치고, site.json 의 apps 에 폴더 이름을 넣은 뒤
이 파일을 다시 돌린다. 만들어진 HTML 은 직접 고치지 않는다.
"""

import html
import json
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
    return app


APPS = [load(app_id) for app_id in SITE["apps"]]
ABOUT = json.loads((TOOL / "about.json").read_text()) if (TOOL / "about.json").exists() else None
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


def head(title, desc, path, scripts=(), index=True):
    site = SITE["site"]
    tags = "".join(f'\n<script src="/assets/{name}" defer></script>' for name in scripts)
    canonical = f'<link rel="canonical" href="{site}{path}">' if index else '<meta name="robots" content="noindex">'
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
<meta property="og:image" content="{site}/assets/img/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/DoHyeon.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css">{tags}
</head>
"""


def sign(home):
    if home:
        who = f'<h1 class="sign__name">{esc(DEV)}</h1>'
        link = f'<a class="btn" href="{SITE["github"]}" rel="me">GitHub {ICON_OUT}</a>'
    else:
        who = f'<p class="sign__name"><a href="/">{esc(DEV)}</a></p>'
        link = f'<a class="btn" href="/">{ICON_BACK} 진열대</a>'
    return f"""<header class="sign">
  {who}
  {link}
  <p class="sign__line">{esc(SITE["tagline"])}</p>
</header>"""


FOOT = f"""<footer class="foot">
  <p>© {SITE["year"]} {esc(DEV)}</p>
  <a href="{SITE["github"]}" rel="me">GitHub</a>
</footer>"""


def name_html(app):
    text = "<br>".join(esc(line) for line in name_lines(app))
    return text + ('<span class="dot" aria-hidden="true"></span>' if app.get("dot") else "")


def tag(app):
    first, _, rest = app["status"].partition(" ")
    return esc(first) + (f"<br>{esc(rest)}" if rest else "")


def pack(app):
    app_id = app["id"]
    platforms = compat(app) if len(app["platforms"]) == 1 else " · ".join(p.get("short", p["name"]) for p in app["platforms"])
    line = app.get("labelLine") or f'{app["version"]} · {platforms}'
    return f"""<li class="peg">
  {HOOK.format(style="")}
  <article class="pack pack--{app["pack"]} pack--{app_id}" data-sway style="--rest:{app.get("rest", 0)}deg;{tone_style(app)};view-transition-name:pack-{app_id}">
    <div class="card">
      <h2 class="card__name"><a class="pack__link" href="/{app_id}/">{name_html(app)}</a></h2>
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


def about_pack():
    a = ABOUT
    orgs = "<br>".join(esc(f'{x["org"]} {x["unit"]}') for x in a["career"])
    return f"""<li class="peg">
  {HOOK.format(style="")}
  <article class="pack pack--bag pack--about" data-sway style="{ABOUT_STYLE_WALL};view-transition-name:pack-about">
    <div class="card">
      <h2 class="card__name"><a class="pack__link" href="/about/">소개</a></h2>
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


def write(path, text):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text)
    print(path)


# ── 첫 화면: 진열대 ──

names = ", ".join(app["name"] for app in APPS[:6]) + (" 등" if len(APPS) > 6 else "")
write(
    "index.html",
    head(f"{DEV} · {SITE['tagline']}", f"{DEV} · {SITE['tagline']}. {names}.", "/", ["wall.js", "light.js"])
    + f"""<body class="home">
<a class="skip" href="#apps">목록으로 건너뛰기</a>
<div class="wall">
{sign(True)}
<main id="apps">
<ul class="rail">
{about_pack() + chr(10) if ABOUT else ""}{chr(10).join(pack(app) for app in APPS)}
</ul>
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
    return any(p["name"] == "Android" for p in app["platforms"])


def get_buttons(app):
    """받기 단추. 안드로이드 앱은 Google Play 배지를 늘 보이고, 스토어 주소(store)가 생기면 그 주소로 잇는다."""
    parts = []
    for p in app["platforms"]:
        if p["name"] == "Android":
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
    cells.append(fact("언어", app["language"]["code"], app["language"]["name"]))
    cells += [fact(h["label"], h["value"], h.get("note", "")) for h in app.get("highlights", [])]
    cells.append(fact("개발", "1인", DEV))
    return "\n      ".join(cells)


def info(app):
    rows = [("제공자", DEV), ("호환성", compat(app)), ("언어", app["language"]["name"]), ("버전", app["version"])]
    rows += [tuple(row) for row in app.get("info", [])]
    if app.get("package"):
        rows.append(("패키지 이름", app["package"]))
    rows.append(("저작권", f'© {SITE["year"]} {DEV}'))
    return "\n      ".join(f"<div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>" for k, v in rows)


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

# ── 소개: 명함의 뒷면. 장터의 개발자 페이지처럼 짠다 ──

if ABOUT:
    a = ABOUT
    about_facts = "\n      ".join(fact(f["label"], f["value"], f.get("note", "")) for f in a["facts"])
    about_text = "\n      ".join(f"<p>{esc(t)}</p>" for t in a["about"])
    cv = "\n        ".join(
        f'<li><div class="cv__head"><b>{esc(x["org"])}</b><span>{esc(x["unit"])}</span><time>{esc(x["period"])}</time></div>'
        + (f'<p>{esc(x["notes"])}</p>' if x.get("notes") else "") + "</li>"
        for x in a["career"] + a.get("education", [])
    )
    skills = "\n        ".join(
        f'<div><dt>{esc(g["group"])}</dt><dd><ul class="chips">{"".join(f"<li>{esc(i)}</li>" for i in g["items"])}</ul></dd></div>'
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
        head(f"소개 | {DEV}", f'{DEV} · {a["role"]}. ' + " · ".join(f'{x["org"]} {x["unit"]}' for x in a["career"] + a.get("education", [])) + ".", "/about/", ["light.js"])
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
        <p class="app-sub">{esc(a["role"])}</p>
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
