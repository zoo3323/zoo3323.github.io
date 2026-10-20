// 위험성평가 AI: 세 장(없는 조문 인용 → MCP 조회·RAG 근거, 제각각인 양식 → 다중 양식 파서, 큰 평가표 → 두 단계 워커)
"use strict";
window.SCENE = (() => {
  const BG = "#d4f2e1";
  const INK2 = "#24533a";
  const beats = [
    { at: 0, solve: 2.8 },
    { at: 6.0, solve: 2.7 },
    { at: 11.6, solve: 2.7 },
  ];
  const duration = 17.6;

  // 글줄 대신 회색 막대
  const bar = (x, y, w, a = 1, fill = "#d9d8d0") => (w <= 0.5 ? "" : tag("rect", { x, y: y - 4, width: w, height: 8, rx: 4, fill, opacity: a }));
  const docIcon = (x, y, fill = C.paper) =>
    tag("path", { d: `M${x} ${y}h11l5 5v15h-16z`, fill, stroke: C.ink, "stroke-width": 1.6, "stroke-linejoin": "round" }) +
    tag("path", { d: `M${x + 4} ${y + 10}h8M${x + 4} ${y + 14}h6`, stroke: C.ink, "stroke-width": 1.3, "stroke-linecap": "round" });
  const node = (x, y, w, h, title, sub, fill, a = 1) =>
    g(
      { opacity: a },
      card(x, y, w, h, { fill }) +
        text(x + 16, y + (sub ? 24 : h / 2), title, { "font-size": 15, "font-weight": 700, fill: C.ink }) +
        (sub ? text(x + 16, y + 46, sub, { "font-size": 12.5, fill: "#4a4528" }) : ""),
    );

  // ── 1장: 조문 ──
  function lawBeat(lt) {
    const out = 1 - seg(lt, 5.6, 0.3, E.in);
    const slide = 134 * (1 - seg(lt, 2.8, 0.55, E.inOut));
    let c = card(40, 92, 452, 330);
    c += chip(58, 116, "AI 검토 의견", { size: 12.5, fill: C.lilacLight });
    // 평가표의 한 줄
    c += tag("rect", { x: 58, y: 138, width: 416, height: 40, rx: 9, fill: C.mute });
    c += text(72, 158.5, "고소 작업", { "font-size": 14, "font-weight": 700, fill: C.ink });
    c += text(170, 158.5, "추락 위험", { "font-size": 14, fill: C.sub });
    c += chip(458, 158, "위험 등급 상", { size: 12, fill: "#ffd6d6", stroke: null, anchor: "end", h: 22, pad: 8 });
    // 답이 한 줄씩 쓰인다
    const lines = [372, 330, 396, 250];
    lines.forEach((w, i) => (c += bar(60, 204 + i * 22, w * seg(lt, 0.3 + i * 0.25, 0.35, E.lin))));
    // 인용 조문: 그럴듯하지만 없는 조문
    const fake = seg(lt, 1.35, 0.3);
    const strike = seg(lt, 3.75, 0.3, E.inOut);
    const gone = seg(lt, 4.05, 0.25, E.in);
    const real = seg(lt, 4.15, 0.3);
    c += g(
      { opacity: fake * (1 - gone) },
      chip(60, 312, "산업안전보건법 제412조", { size: 13, fill: C.paper, stroke: lt > 1.9 && lt < 2.8 ? C.red : C.ink, color: C.ink }) +
        drawOn("M62 312H236", strike, { stroke: C.red, "stroke-width": 2.4 }),
    );
    c += chip(250, 312, "실제로 없는 조문", { size: 12.5, fill: C.red, color: C.paper, stroke: null, opacity: seg(lt, 1.9, 0.3) * (1 - seg(lt, 2.75, 0.25, E.in)) });
    c += g({ opacity: real * out }, chip(60, 312, "산업안전보건법 제38조 · 안전조치", { size: 13, fill: C.lemon }) + tick(60 + chip.width("산업안전보건법 제38조 · 안전조치", { size: 13 }) + 16, 312, 0.9));
    // RAG 근거: 내부 문서 두 장
    const docs = ["작업 지침", "사고 사례"];
    docs.forEach((d, i) => {
      const a = seg(lt, 4.55 + i * 0.15, 0.3) * out;
      const x = 60 + i * 150;
      c += g({ opacity: a, transform: `translate(0 ${n2((1 - a) * 8)})` }, tag("rect", { x, y: 348, width: 138, height: 48, rx: 10, fill: C.lilacLight, stroke: C.ink, "stroke-width": 1.6 }) + docIcon(x + 12, 362) + text(x + 38, 372.5, d, { "font-size": 13.5, "font-weight": 700, fill: C.ink }));
    });
    let s = g({ transform: `translate(${n2(slide)} 0)` }, c);
    // 오른쪽 도구들
    const mcpA = seg(lt, 2.9, 0.35) * out;
    const ragA = seg(lt, 4.35, 0.35) * out;
    s += node(540, 150, 220, 72, "법령 MCP", "korean-law-mcp · 조문 조회", C.lemon, mcpA);
    s += node(540, 300, 220, 72, "내부 문서 RAG", "fastembed · pgvector", C.lemon, ragA);
    // 조문 확인: 인용 칩 → MCP 로 물어보고 답을 받는다
    const ask = seg(lt, 3.2, 0.45, E.inOut);
    const askX = 66 + chip.width("산업안전보건법 제412조", { size: 13 });
    s += drawOn(`M${n2(askX)} 312C380 312 420 186 536 186`, ask, { stroke: C.ink, "stroke-width": 2.2, "stroke-dasharray": ask >= 0.999 ? "6 5" : undefined, opacity: 1 - seg(lt, 4.0, 0.25, E.in) });
    s += chip(650, 248, "없음 → 바로잡기", { size: 12, fill: C.paper, anchor: "middle", h: 22, pad: 8, opacity: seg(lt, 3.6, 0.25) * (1 - seg(lt, 4.3, 0.25, E.in)) });
    const fetch = seg(lt, 4.45, 0.45, E.inOut);
    s += drawOn("M536 336C470 336 430 372 340 372", fetch, { stroke: C.ink, "stroke-width": 2.2, "stroke-dasharray": fetch >= 0.999 ? "6 5" : undefined, opacity: out });
    return s;
  }

  // ── 2장: 양식 ──
  // 칸 [열, 행, 열 수, 행 수, 머리칸?]
  const XLSX = [
    [0, 0, 1, 1, 1], [1, 0, 2, 1, 1], [3, 0, 1, 1, 1],
    [0, 1, 1, 2], [1, 1, 1, 1], [2, 1, 1, 1], [3, 1, 1, 1],
    [1, 2, 1, 1], [2, 2, 1, 1], [3, 2, 1, 1],
    [0, 3, 1, 1], [1, 3, 2, 1], [3, 3, 1, 1],
  ];
  const HWPX = [
    [0, 0, 2, 1, 1], [2, 0, 2, 1, 1],
    [0, 1, 1, 1], [1, 1, 1, 1], [2, 1, 2, 1],
    [0, 2, 1, 1], [1, 2, 1, 2], [2, 2, 1, 1], [3, 2, 1, 1],
    [0, 3, 1, 1], [2, 3, 2, 1],
  ];
  function sheet(x, y, cells, label, o = {}) {
    const cw = 52;
    const ch = 30;
    let s = card(x - 10, y - 38, cw * 4 + 20, ch * 4 + 50, { rx: 12 });
    s += chip(x, y - 20, label, { size: 12, fill: C.paper, h: 22, pad: 8 });
    cells.forEach(([c, r, w, h, head], i) => {
      const merged = w > 1 || h > 1;
      const bad = merged && o.bad > 0 ? o.bad : 0;
      s += tag("rect", { x: x + c * cw, y: y + r * ch, width: w * cw, height: h * ch, fill: head ? "#e8f3ec" : bad ? "#fde3e6" : C.paper, stroke: bad ? C.red : "#8b8a82", "stroke-width": bad ? 1.8 : 1 });
      s += bar(x + c * cw + 8, y + r * ch + (h * ch) / 2, Math.min(w * cw - 16, 30 + ((i * 17) % 18)), 1, head ? "#9bbfaa" : "#d0cfc7");
    });
    return s;
  }
  function formBeat(lt) {
    const out = 1 - seg(lt, 5.25, 0.3, E.in);
    const go = seg(lt, 2.85, 0.6, E.inOut);
    const bad = seg(lt, 1.0, 0.3) * (1 - seg(lt, 2.8, 0.3, E.in));
    let s = "";
    // 두 평가표가 파서로 빨려 들어간다
    const shrink = 1 - 0.5 * go;
    const pos = (x0, y0, x1, y1) => [lerp(x0, x1, go), lerp(y0, y1, go)];
    const [ax, ay] = pos(150, 168, 72, 132);
    const goB = seg(lt, 2.95, 0.6, E.inOut);
    const [bx, by] = [lerp(420, 72, goB), lerp(168, 262, goB)];
    s += g({ transform: `translate(${n2(ax)} ${n2(ay)}) scale(${n2(shrink)})`, opacity: out }, sheet(0, 0, XLSX, "엑셀 .xlsx", { bad }));
    s += g({ transform: `translate(${n2(bx)} ${n2(by)}) scale(${n2(1 - 0.5 * goB)})`, opacity: out }, sheet(0, 0, HWPX, "한글 .hwpx", { bad }));
    s += chip(400, 360, "병합 셀에서 읽다 깨짐", { size: 12.5, fill: C.red, color: C.paper, stroke: null, anchor: "middle", opacity: seg(lt, 1.35, 0.3) * (1 - seg(lt, 2.75, 0.25, E.in)) });
    // 파서
    const pa = seg(lt, 3.25, 0.35);
    s += drawOn("M190 178C230 178 236 222 296 222", seg(lt, 3.35, 0.3), { stroke: C.ink, "stroke-width": 2.2, opacity: out });
    s += drawOn("M190 306C230 306 236 248 296 248", seg(lt, 3.35, 0.3), { stroke: C.ink, "stroke-width": 2.2, opacity: out });
    s += node(300, 203, 168, 64, "다중 양식 파서", "", C.lemon, pa * out);
    s += drawOn("M470 235H544", seg(lt, 3.55, 0.3), { stroke: C.ink, "stroke-width": 2.4, opacity: out });
    s += tag("path", { d: "M538 229l7 6-7 6", fill: "none", stroke: C.ink, "stroke-width": 2.4, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: seg(lt, 3.75, 0.15) * out });
    // 항목 단위로 정리된 카드
    const items = [
      ["고소 작업", "추락", "안전대 착용"],
      ["중량물 운반", "협착", "운반 기구 사용"],
      ["용접", "화재", "불티 방지포"],
    ];
    items.forEach((it, i) => {
      const a = seg(lt, 3.85 + i * 0.18, 0.35) * out;
      const y = 104 + i * 94;
      s += g(
        { opacity: a, transform: `translate(${n2((1 - a) * -14)} 0)` },
        card(562, y, 200, 78, { rx: 12 }) +
          text(578, y + 22, it[0], { "font-size": 14, "font-weight": 700, fill: C.ink }) +
          chip(578, y + 52, `위험 · ${it[1]}`, { size: 11.5, fill: "#ffe1e1", stroke: null, h: 22, pad: 7 }) +
          chip(578 + chip.width(`위험 · ${it[1]}`, { size: 11.5, pad: 7 }) + 6, y + 52, `대책 · ${it[2]}`, { size: 11.5, fill: C.mute, stroke: null, h: 22, pad: 7 }),
      );
    });
    return s;
  }

  // ── 3장: 큰 평가표 → 두 단계 워커 ──
  const LEVEL = { 상: "#ef4444", 중: "#f59e0b", 하: "#22c55e" };
  function queueBeat(lt) {
    let s = "";
    const prob = 1 - seg(lt, 2.65, 0.28, E.in);
    // 문제: 한 번에 다 보내면 멈춘다
    s += g(
      { opacity: prob },
      card(60, 110, 300, 300) +
        text(80, 136, "평가표 한 번에 분석", { "font-size": 14.5, "font-weight": 700, fill: C.ink }) +
        Array.from({ length: 9 }, (_, i) => tag("rect", { x: 80, y: 156 + i * 22, width: 260, height: 16, rx: 5, fill: C.mute })).join("") +
        tag("rect", { x: 400, y: 236, width: 340, height: 26, rx: 13, fill: C.paper, stroke: C.ink, "stroke-width": 2 }) +
        tag("rect", { x: 403, y: 239, width: 334 * Math.min(0.34, seg(lt, 0.4, 1.4, E.out) * 0.34), height: 20, rx: 10, fill: "#94a3b8" }) +
        text(400, 214, "요청 하나", { "font-size": 13.5, "font-weight": 700, fill: INK2 }) +
        chip(740, 290, "시간 초과", { size: 12.5, fill: C.red, color: C.paper, stroke: null, anchor: "end", opacity: seg(lt, 1.9, 0.3) }),
    );
    // 해결: 항목으로 나눠 큐에 넣고, 워커가 두 단계로 처리한다
    const sol = seg(lt, 2.95, 0.35);
    const lanes = [
      { x: 230, label: "1단계 · 항목 분류" },
      { x: 450, label: "2단계 · 위험 등급·보완" },
    ];
    let w = "";
    w += card(40, 120, 150, 280, { rx: 14 }) + text(58, 144, "Redis 큐", { "font-size": 14, "font-weight": 700, fill: C.ink });
    lanes.forEach((l) => (w += card(l.x, 120, 190, 280, { rx: 14 }) + chip(l.x + 12, 144, l.label, { size: 12.5, fill: C.lemon })));
    w += card(660, 120, 104, 280, { rx: 14, fill: C.lilacLight }) + text(676, 144, "결과", { "font-size": 14, "font-weight": 700, fill: C.ink });
    // 항목 칩이 큐 → 1단계 → 2단계 → 결과 로 흐른다
    const levels = ["상", "중", "하", "중", "하", "상", "하"];
    levels.forEach((lv, i) => {
      const t0 = 3.15 + i * 0.28;
      const u = clamp((lt - t0) / 1.6);
      const stops = [
        [56, 172 + i * 30],
        [246, 176 + (i % 4) * 52],
        [466, 176 + (i % 4) * 52],
        [672, 168 + i * 31],
      ];
      const k = Math.min(2, Math.floor(u * 3));
      const f = E.inOut(clamp(u * 3 - k));
      const p = mix2(stops[k], stops[k + 1], f);
      const a = seg(lt, t0 - 0.2, 0.2);
      const done = u >= 0.999;
      const wd = done ? 80 : 118;
      w += g(
        { opacity: a },
        tag("rect", { x: p[0], y: p[1] - 12, width: wd, height: 24, rx: 12, fill: C.paper, stroke: C.ink, "stroke-width": 1.5 }) +
          bar(p[0] + 12, p[1], done ? 30 : 60, 1, "#c8c6bd") +
          (u > 0.62 ? tag("circle", { cx: p[0] + wd - 14, cy: p[1], r: 6, fill: LEVEL[lv], stroke: C.ink, "stroke-width": 1.2 }) : ""),
      );
    });
    const prog = seg(lt, 3.2, 2.4, E.lin);
    w += tag("rect", { x: 40, y: 414, width: 724, height: 12, rx: 6, fill: C.paper, stroke: C.ink, "stroke-width": 1.6 });
    w += tag("rect", { x: 42, y: 416, width: 720 * prog, height: 8, rx: 4, fill: "#22c55e" });
    w += chip(764, 98, "ARQ 워커 · 백그라운드", { size: 12.5, fill: C.paper, anchor: "end", opacity: seg(lt, 3.0, 0.3) });
    s += g({ opacity: sol }, w);
    return s;
  }

  function draw(t) {
    let s = tag("rect", { x: 0, y: 0, width: W, height: H, fill: BG });
    if (t < beats[1].at) s += lawBeat(t);
    else if (t < beats[2].at) s += formBeat(t - beats[1].at);
    else s += queueBeat(t - beats[2].at);
    for (const b of beats.slice(1)) {
      const u = clamp((t - (b.at - 0.3)) / 0.6);
      if (u > 0 && u < 1) s += tag("rect", { x: 0, y: 64, width: W, height: H - 64, fill: BG, opacity: E.inOut(1 - Math.abs(u * 2 - 1)) });
    }
    return s;
  }

  return { beats, duration, draw, bg: BG, poster: 5.0 };
})();
