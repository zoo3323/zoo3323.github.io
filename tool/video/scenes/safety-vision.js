// 안전 영상 분석: 세 장(모델 넷이 GPU 한 대에 → 동적 모델 매니저, 카메라를 옮기면 ROI 다시 그리기 → ArUco 마커로 자동, 한 대 끊기면 전체 멈춤 → 카메라별 스레드·자동 재연결과 단일 스키마)
"use strict";
window.SCENE = (() => {
  const BG = "#d4f2e1";
  const beats = [
    { at: 0, solve: 2.7 },
    { at: 5.7, solve: 2.7 },
    { at: 11.2, solve: 3.0 },
  ];
  const duration = 18.4;

  // ── 1장: GPU 메모리 ──
  const MODELS = [
    { name: "화재·연기", w: 112, fill: "#ffc9b9" },
    { name: "안전모", w: 92, fill: "#fff0a0" },
    { name: "침입", w: 78, fill: "#c9e8ff" },
    { name: "인원 파악", w: 96, fill: "#d9d2ff" },
  ];
  const BOX = { x: 318, y: 206, w: 330, h: 70 }; // VRAM 칸
  const BH = 54;
  const colPos = (i) => [48, 128 + i * 66];
  const slotPos = (j, order) => {
    let x = BOX.x + 8;
    for (let k = 0; k < j; k++) x += MODELS[order[k]].w + 6;
    return [x, BOX.y + (BOX.h - BH) / 2];
  };
  const block = (m, p, o = {}) =>
    g(
      { opacity: o.opacity },
      tag("rect", { x: p[0], y: p[1], width: m.w, height: BH, rx: 10, fill: m.fill, stroke: C.ink, "stroke-width": 2 }) +
        text(p[0] + 12, p[1] + BH / 2 + 0.5, m.name, { "font-size": 14, "font-weight": 700, fill: C.ink }),
    );
  // 두 자리 사이를 살짝 떠서 옮겨 간다
  const fly = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u) - Math.sin(Math.PI * u) * 26];

  function gpuBeat(lt) {
    const out = 1 - seg(lt, 5.3, 0.35, E.in);
    let s = text(48, 108, "모델", { "font-size": 14, "font-weight": 700, fill: "#24533a" });
    // 칸 자리(빈 자리 표시)
    MODELS.forEach((m, i) => {
      const p = colPos(i);
      s += tag("rect", { x: p[0], y: p[1], width: m.w, height: BH, rx: 10, fill: "none", stroke: "#24533a", "stroke-width": 1.4, "stroke-dasharray": "5 5", opacity: 0.45 });
    });
    const over = seg(lt, 2.05, 0.3);
    const fix = seg(lt, 2.75, 0.3);
    s += card(294, 96, 470, 330);
    s += text(318, 124, "GPU 한 대", { "font-size": 16, "font-weight": 700, fill: C.ink });
    s += text(BOX.x, BOX.y - 16, "VRAM", { "font-size": 12.5, "font-weight": 700, fill: C.sub });
    const red = over * (1 - fix);
    s += tag("rect", { x: BOX.x, y: BOX.y, width: BOX.w, height: BOX.h, rx: 13, fill: red > 0.5 ? "#fde3e6" : "#f4f3ee", stroke: red > 0.5 ? C.red : C.ink, "stroke-width": 2 });
    // 문제: 네 모델을 모두 올린다 → 넘친다
    const order = [0, 1, 2, 3];
    const shake = red > 0 ? Math.sin(lt * 70) * 3 * (1 - seg(lt, 2.1, 0.5)) : 0;
    const back = (i) => seg(lt, 2.8 + (3 - i) * 0.07, 0.45, E.inOut);
    // 해결: 요청 하나에 모델 하나만. 안전모 → (메모리 비우고) 침입
    const inH = seg(lt, 3.5, 0.45, E.inOut);
    const outH = seg(lt, 4.35, 0.35, E.inOut);
    const inI = seg(lt, 4.75, 0.45, E.inOut);
    MODELS.forEach((m, i) => {
      const go = seg(lt, 0.45 + i * 0.42, 0.5, E.inOut);
      let p = fly(colPos(i), slotPos(i, order), go);
      if (back(i) > 0) p = fly(slotPos(i, order), colPos(i), back(i));
      if (i === 1 && inH > 0) p = outH > 0 ? fly(slotPos(0, [1]), colPos(1), outH) : fly(colPos(1), slotPos(0, [1]), inH);
      if (i === 2 && inI > 0) p = fly(colPos(2), slotPos(0, [2]), inI);
      s += block(m, [p[0] + (i === 3 ? shake : 0), p[1]]);
    });
    // 넘친 몫은 빨갛게
    const edge = BOX.x + BOX.w;
    const p3 = fly(colPos(3), slotPos(3, order), seg(lt, 0.45 + 3 * 0.42, 0.5, E.inOut));
    if (red > 0.01 && p3[0] + MODELS[3].w > edge) {
      const x0 = Math.max(edge, p3[0]);
      s += tag("rect", { x: x0, y: p3[1], width: p3[0] + MODELS[3].w - x0, height: BH, fill: C.red, opacity: 0.35 * red });
    }
    s += chip(BOX.x + BOX.w, BOX.y + BOX.h + 28, "OOM · 메모리 부족", { size: 13, fill: C.red, color: C.paper, stroke: null, anchor: "end", opacity: red });
    s += chip(BOX.x, BOX.y + BOX.h + 28, "모델 매니저", { size: 13, fill: C.lemon, opacity: seg(lt, 3.1, 0.3) * out });
    const req = (label, a) => chip(BOX.x + BOX.w, 124, label, { size: 12.5, fill: C.paper, anchor: "end", opacity: a });
    s += req("안전모 요청", seg(lt, 3.25, 0.25) * (1 - seg(lt, 4.25, 0.2, E.in)));
    s += req("침입 요청", seg(lt, 4.3, 0.25) * out);
    // 바꿀 때 메모리를 완전히 비운다
    const flush = seg(lt, 4.45, 0.15) * (1 - seg(lt, 4.75, 0.2, E.in));
    s += chip(BOX.x + BOX.w / 2 + 40, BOX.y + BOX.h / 2, "메모리 해제", { size: 12.5, fill: C.paper, anchor: "middle", opacity: flush });
    s += g({ opacity: seg(lt, 3.95, 0.25) * out }, tick(BOX.x + BOX.w - 22, BOX.y + BOX.h / 2, 1.1, "#12804a"));
    return s;
  }

  // ── 2장: ArUco 마커로 ROI ──
  const MON = { x: 87, y: 88, w: 626, h: 352 };
  const YARD = {
    A: { pos: [-6.5, -11, 8.2], target: [0, 0.4, 0] },
    B: { pos: [4.5, -11.5, 8.6], target: [1.4, 0.9, 0] },
    C: { pos: [-1.5, -12.5, 10.5], target: [-0.6, 0.2, 0] },
  };
  const AREA = 3.4; // 출입 금지 구역 반 폭
  const MARK = 0.9;
  const BITS = [
    [1, 0, 1, 1],
    [0, 1, 0, 0],
    [1, 1, 0, 1],
    [0, 0, 1, 0],
  ];
  const corners = [
    [-AREA, -AREA],
    [AREA, -AREA],
    [AREA, AREA],
    [-AREA, AREA],
  ];
  function yardCam(c) {
    return camera({ pos: c.pos, target: c.target, f: 520, cx: MON.x + MON.w / 2, cy: MON.y + MON.h / 2 + 18 });
  }
  const camLerp = (a, b, u) => ({ pos: v3.lerp(a.pos, b.pos, u), target: v3.lerp(a.target, b.target, u) });

  function yard(cam, o = {}) {
    let s = tag("rect", { x: MON.x, y: MON.y, width: MON.w, height: MON.h, fill: "#e6e4dc" });
    // 바닥에 칠한 통로 선
    let lines = "";
    for (const y of [-7, 7]) lines += dpath(cam.line([-14, y, 0], [14, y, 0]), false);
    for (const x of [-8, 8]) lines += dpath(cam.line([x, -14, 0], [x, 14, 0]), false);
    s += tag("path", { d: lines, fill: "none", stroke: "#f2c94c", "stroke-width": 4, opacity: 0.9 });
    // 저장 탱크(원기둥)
    const ring = (z) => Array.from({ length: 48 }, (_, i) => cam.P([1.9 * Math.cos((i / 48) * 2 * Math.PI), 1.9 * Math.sin((i / 48) * 2 * Math.PI), z]));
    const bottom = ring(0);
    const top = ring(2.8);
    const hull = convexHull([...bottom, ...top]);
    s += tag("path", { d: dpath(hull), fill: "#cfd6dc", stroke: C.ink, "stroke-width": 1.8, "stroke-linejoin": "round" });
    s += tag("path", { d: dpath(top), fill: "#eef1f3", stroke: C.ink, "stroke-width": 1.8 });
    // 마커
    for (const [cx, cy] of corners) {
      const cell = MARK / 6;
      const x0 = cx - MARK / 2;
      const y0 = cy - MARK / 2;
      s += tag("path", { d: dpath(cam.poly([[x0, y0, 0], [x0 + MARK, y0, 0], [x0 + MARK, y0 + MARK, 0], [x0, y0 + MARK, 0]])), fill: "#17171a" });
      let white = "";
      BITS.forEach((r, j) =>
        r.forEach((b, i) => {
          if (!b) return;
          const a = x0 + (i + 1) * cell;
          const c = y0 + (j + 1) * cell;
          white += dpath(cam.poly([[a, c, 0], [a + cell, c, 0], [a + cell, c + cell, 0], [a, c + cell, 0]]));
        }),
      );
      s += tag("path", { d: white, fill: "#ffffff" });
    }
    if (o.extra) s += o.extra;
    return s;
  }

  function convexHull(ps) {
    const p = ps.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const q of p) {
      while (lower.length >= 2 && cr(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
      lower.push(q);
    }
    const upper = [];
    for (const q of p.slice().reverse()) {
      while (upper.length >= 2 && cr(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
      upper.push(q);
    }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  }

  function roiBeat(lt) {
    const move1 = seg(lt, 1.35, 0.85, E.inOut);
    const move2 = seg(lt, 4.05, 0.85, E.inOut);
    const c = move2 > 0 ? camLerp(YARD.B, YARD.C, move2) : camLerp(YARD.A, YARD.B, move1);
    const cam = yardCam(c);
    const camA = yardCam(YARD.A);
    const fixA = 1 - seg(lt, 2.8, 0.3, E.in);
    // 문제: 손으로 그린 ROI 는 화면에 붙어 있어 카메라가 돌면 어긋난다
    const hand = corners.map(([x, y]) => camA.P([x * 1.02, y * 1.02, 0]));
    const drawn = seg(lt, 0.3, 0.9, E.inOut);
    const wrong = seg(lt, 2.15, 0.25);
    let over = "";
    over += tag("path", { d: dpath(hand), fill: C.red, opacity: 0.12 * drawn * fixA });
    over += drawOn(dpath(hand), drawn, { stroke: C.red, "stroke-width": 2.6, "stroke-dasharray": drawn >= 0.999 ? "8 6" : undefined, opacity: fixA });
    over += chip(hand[2][0] + 10, hand[2][1] - 24, "ROI 재작성 필요", { size: 12.5, fill: C.red, color: C.paper, stroke: null, opacity: wrong * fixA });
    // 해결: 마커를 찾아(레몬 테두리) 그 자리로 ROI 를 만든다. 카메라가 또 돌아도 따라간다
    corners.forEach(([x, y], i) => {
      const a = seg(lt, 2.95 + i * 0.12, 0.25);
      const m = MARK * 0.75;
      over += tag("path", { d: dpath(cam.poly([[x - m, y - m, 0], [x + m, y - m, 0], [x + m, y + m, 0], [x - m, y + m, 0]])), fill: "none", stroke: C.lemon, "stroke-width": 3.5, opacity: a });
      over += tag("path", { d: dpath(cam.poly([[x - m, y - m, 0], [x + m, y - m, 0], [x + m, y + m, 0], [x - m, y + m, 0]])), fill: "none", stroke: C.ink, "stroke-width": 1.2, opacity: a });
    });
    const roi = corners.map(([x, y]) => cam.P([x, y, 0]));
    const ru = seg(lt, 3.5, 0.5, E.inOut);
    over += tag("path", { d: dpath(roi), fill: C.lemon, opacity: 0.38 * ru });
    over += drawOn(dpath(roi), ru, { stroke: C.ink, "stroke-width": 2.6 });
    const ok = seg(lt, 5.08, 0.3);
    over += chip(MON.x + 14, MON.y + MON.h - 22, "마커 네 개로 ROI 자동 생성", { size: 12.5, fill: C.lemon, opacity: seg(lt, 3.7, 0.3) });
    let s = card(MON.x - 2, MON.y - 2, MON.w + 4, MON.h + 4, { rx: 12 });
    s += `<clipPath id="mon"><rect x="${MON.x}" y="${MON.y}" width="${MON.w}" height="${MON.h}" rx="11"/></clipPath>`;
    s += g({ "clip-path": "url(#mon)" }, yard(cam, { extra: over }));
    s += chip(MON.x + 14, MON.y + 22, "CAM 1", { size: 12.5, fill: C.paper });
    s += chip(MON.x + MON.w - 14, MON.y + 22, "카메라 각도 변경", { size: 12.5, fill: C.paper, anchor: "end", opacity: seg(lt, 1.35, 0.25) * (1 - seg(lt, 2.4, 0.3, E.in)) + seg(lt, 4.05, 0.25) * (1 - seg(lt, 4.85, 0.2, E.in)) });
    s += g({ opacity: ok }, chip(MON.x + MON.w - 14, MON.y + 22, "ROI 자동 추종", { size: 12.5, fill: C.lemon, anchor: "end" }));
    return s;
  }

  // ── 3장: 스트림 끊김과 결과 형식 ──
  // 문제: 디코딩 루프 하나가 카메라 셋을 차례로 돌려, 한 대가 끊기면 모두 멈추고 모델마다 결과 모양이 다르다.
  // 해결: 카메라마다 디코딩 스레드를 두어 끊긴 카메라만 다시 붙고, 결과는 box·roi·count 한 스키마로 WebSocket 에 보낸다.
  const CAMS = [0, 1, 2].map((i) => ({ x: 36, y: 96 + i * 108, w: 168, h: 88 }));
  const camY = (i) => CAMS[i].y + CAMS[i].h / 2;
  const LOOP = { x: 262, y: 172, w: 178, h: 120 };
  const LANE = { x: 262, w: 178, h: 56 };
  const MID = LOOP.y + LOOP.h / 2;
  const OX = 488;
  const BUS = 460;
  const ROWS = [
    { name: "화재", fill: "#ffc9b9", raw: "[[12,40,88,96,.91]]" },
    { name: "안전모", fill: "#fff0a0", raw: '{"helmet":2,"head":1}' },
    { name: "침입", fill: "#c9e8ff", raw: '"ALERT zone_3"' },
    { name: "인원 파악", fill: "#d9d2ff", raw: "count=7" },
  ];
  const rowY = (k) => MID + (k - 1.5) * 46;
  const MONO = '"SF Mono", Menlo, monospace';
  // 멈춘 동안은 화면 속 시간도 선다: [시작, 끝]
  const STOP = [
    [[1.35, 3.1]],
    [[1.0, 3.1], [3.75, 4.85]],
    [[1.35, 3.1]],
  ];
  const streamT = (i, lt) => STOP[i].reduce((t, [a, b]) => t - clamp(lt - a, 0, b - a), lt);
  const stopped = (i, lt) => STOP[i].some(([a, b]) => lt >= a && lt < b);
  const cut = (i, lt) => i === 1 && ((lt >= 1.0 && lt < 3.1) || (lt >= 3.75 && lt < 4.85));
  const bez = (p0, p1, p2, p3, u) => {
    const v = 1 - u;
    return [0, 1].map((k) => v * v * v * p0[k] + 3 * v * v * u * p1[k] + 3 * v * u * u * p2[k] + u * u * u * p3[k]);
  };

  function camTile(i, lt) {
    const T = CAMS[i];
    const st = streamT(i, lt);
    const top = T.y + T.h * 0.34;
    let inner = tag("rect", { x: T.x, y: T.y, width: T.w, height: T.h, fill: "#dfe5e1" });
    inner += tag("path", { d: `M${T.x} ${n2(top)}H${T.x + T.w}V${T.y + T.h}H${T.x}Z`, fill: "#e9e7df" });
    // 걷는 사람 둘. 스트림이 멈추면 같이 선다
    [
      [0.2, 0.66, 20, 0.9],
      [0.72, 0.9, -14, 1.1],
    ].forEach(([x0, fy, v, sc]) => {
      const span = T.w + 30;
      const x = T.x - 15 + ((((x0 * T.w + v * st + i * 23) % span) + span) % span);
      const y = T.y + fy * T.h;
      inner += tag("circle", { cx: x, cy: y - 25 * sc, r: 5 * sc, fill: "#55606e" });
      inner += tag("rect", { x: x - 6 * sc, y: y - 19 * sc, width: 12 * sc, height: 19 * sc, rx: 4 * sc, fill: "#55606e" });
    });
    const stop = stopped(i, lt);
    const bad = cut(i, lt);
    if (stop) inner += tag("rect", { x: T.x, y: T.y, width: T.w, height: T.h, fill: bad ? "#fde3e6" : "#8b8a82", opacity: bad ? 0.75 : 0.45 });
    let s = card(T.x - 2, T.y - 2, T.w + 4, T.h + 4, { rx: 12, stroke: bad ? C.red : C.ink });
    s += `<clipPath id="cam${i}"><rect x="${T.x}" y="${T.y}" width="${T.w}" height="${T.h}" rx="11"/></clipPath>`;
    s += g({ "clip-path": `url(#cam${i})` }, inner);
    s += chip(T.x + 10, T.y + 17, `CAM ${i + 1}`, { size: 11.5, fill: C.paper, h: 20, pad: 7 });
    s += tag("circle", { cx: T.x + T.w - 15, cy: T.y + 17, r: 5, fill: stop ? C.wire : C.green, stroke: C.paper, "stroke-width": 1.5 });
    if (bad) s += chip(T.x + T.w / 2, T.y + T.h / 2 + 8, "연결 끊김", { size: 12.5, fill: C.red, color: C.paper, stroke: null, anchor: "middle" });
    else if (stop) s += chip(T.x + T.w / 2, T.y + T.h / 2 + 8, "멈춤", { size: 12.5, fill: C.paper, anchor: "middle" });
    return s;
  }

  // 카메라에서 가운데 칸으로 가는 선과 그 위를 흐르는 프레임
  function wire(i, lt, toY, a) {
    const p0 = [CAMS[i].x + CAMS[i].w + 4, camY(i)];
    const p3 = [LOOP.x - 4, toY];
    const mx = (p0[0] + p3[0]) / 2;
    const p1 = [mx, p0[1]];
    const p2 = [mx, p3[1]];
    const bad = cut(i, lt);
    let s = tag("path", { d: `M${n2(p0[0])} ${n2(p0[1])}C${n2(p1[0])} ${n2(p1[1])} ${n2(p2[0])} ${n2(p2[1])} ${n2(p3[0])} ${n2(p3[1])}`, fill: "none", stroke: bad ? C.red : C.ink, "stroke-width": 2.2, "stroke-dasharray": bad ? "5 5" : undefined });
    if (!stopped(i, lt)) {
      const st = streamT(i, lt);
      for (let k = 0; k < 2; k++) {
        const q = bez(p0, p1, p2, p3, (st * 1.1 + k * 0.5 + i * 0.17) % 1);
        s += tag("rect", { x: q[0] - 5, y: q[1] - 4, width: 10, height: 8, rx: 2, fill: C.lemon, stroke: C.ink, "stroke-width": 1.2 });
      }
    }
    if (bad) {
      const q = bez(p0, p1, p2, p3, 0.5);
      s += tag("circle", { cx: q[0], cy: q[1], r: 9.5, fill: C.paper, stroke: C.red, "stroke-width": 1.6 }) + cross(q[0], q[1], 0.75, C.red);
    }
    return g({ opacity: a }, s);
  }

  function streamBeat(lt) {
    const sol = seg(lt, 3.0, 0.35, E.inOut);
    const stall = lt >= 1.35 && lt < 3.1;
    const ax = LOOP.x + LOOP.w;
    const line = { fill: "none", "stroke-width": 2.2, "stroke-linecap": "round", "stroke-linejoin": "round" };
    let s = "";
    CAMS.forEach((_, i) => (s += camTile(i, lt)));
    // 가운데 → 결과로 잇는 선
    const head = (x, y, color) => tag("path", { d: `M${x - 8} ${y - 6}L${x} ${y}L${x - 8} ${y + 6}`, ...line, stroke: color });
    if (sol < 0.99) {
      const color = stall ? C.red : C.ink;
      s += g({ opacity: 1 - sol }, tag("path", { d: `M${ax + 6} ${MID}H${OX - 12}`, ...line, stroke: color, "stroke-dasharray": stall ? "5 5" : undefined }) + head(OX - 12, MID, color));
    }
    if (sol > 0.01) {
      let b = tag("path", { d: `M${BUS} ${camY(0)}V${camY(2)}M${BUS} ${MID}H${OX - 12}`, ...line, stroke: C.ink }) + head(OX - 12, MID, C.ink);
      CAMS.forEach((_, i) => {
        const bad = cut(i, lt);
        b += tag("path", { d: `M${ax + 4} ${camY(i)}H${BUS}`, ...line, stroke: bad ? C.red : C.ink, "stroke-dasharray": bad ? "5 5" : undefined });
      });
      s += g({ opacity: sol }, b);
    }
    // 문제: 디코딩 루프 하나
    if (sol < 0.99) {
      const a = 1 - sol;
      CAMS.forEach((_, i) => (s += wire(i, lt, MID + (i - 1) * 24, a)));
      let b = card(LOOP.x, LOOP.y, LOOP.w, LOOP.h, { stroke: stall ? C.red : C.ink, fill: stall ? "#fde3e6" : C.paper });
      b += text(LOOP.x + 16, LOOP.y + 28, "디코딩 루프 하나", { "font-size": 15, "font-weight": 700, fill: C.ink });
      b += text(LOOP.x + 16, LOOP.y + 51, "카메라 셋을 차례로", { "font-size": 12.5, fill: C.sub });
      b += chip(LOOP.x + LOOP.w / 2, LOOP.y + LOOP.h - 27, "한 대 끊기면 전체 멈춤", { size: 12, fill: C.red, color: C.paper, stroke: null, anchor: "middle", h: 23, pad: 8, opacity: seg(lt, 1.4, 0.3) });
      s += g({ opacity: a }, b);
    }
    // 해결: 카메라마다 디코딩 스레드
    if (sol > 0.01) {
      CAMS.forEach((_, i) => {
        const y = camY(i);
        s += wire(i, lt, y, sol);
        const bad = cut(i, lt);
        let b = card(LANE.x, y - LANE.h / 2, LANE.w, LANE.h, { stroke: bad ? C.red : C.ink });
        b += text(LANE.x + 14, y - 9, `디코딩 스레드 ${i + 1}`, { "font-size": 13.5, "font-weight": 700, fill: C.ink });
        if (bad) {
          b += text(LANE.x + 14, y + 13, "재연결 중", { "font-size": 12, "font-weight": 700, fill: C.red });
          const on = Math.floor(lt * 6) % 3;
          for (let k = 0; k < 3; k++) b += tag("circle", { cx: LANE.x + 86 + k * 10, cy: y + 13, r: 2.6, fill: C.red, opacity: k === on ? 1 : 0.25 });
        } else if (i === 1 && lt >= 4.85) {
          b += chip(LANE.x + 14, y + 14, "자동 재연결", { size: 11.5, fill: C.lemon, h: 20, pad: 7, opacity: seg(lt, 4.85, 0.25) });
        } else {
          b += text(LANE.x + 14, y + 13, "실행 중", { "font-size": 12, fill: C.sub });
        }
        if (!bad) b += tick(LANE.x + LANE.w - 20, y, 0.9, "#12804a");
        s += g({ opacity: sol, transform: `translate(${n2((1 - sol) * -10)} 0)` }, b);
      });
    }
    // 결과: 모델마다 다른 모양 → box·roi·count 한 스키마
    const uni = seg(lt, 3.35, 0.4, E.inOut);
    const bad = seg(lt, 1.8, 0.3) * (1 - sol);
    s += chip(OX, rowY(0) - 36, "모델마다 다른 결과 형식", { size: 12.5, fill: C.red, color: C.paper, stroke: null, opacity: bad });
    s += chip(OX, rowY(0) - 36, "단일 스키마", { size: 12.5, fill: C.lemon, opacity: uni });
    ROWS.forEach((r, k) => {
      const y = rowY(k);
      const sx = OX + 76;
      let row = chip(OX, y, r.name, { size: 12, fill: r.fill, h: 24, pad: 8 });
      row += g({ opacity: 1 - uni }, text(sx, y + 0.5, r.raw, { "font-size": 12, "font-family": MONO, fill: bad > 0.5 ? C.red : C.ink }));
      row += g({ opacity: uni }, chip(sx, y, "{ box, roi, count }", { size: 11.5, family: MONO, weight: 600, fill: C.paper, h: 22, pad: 8 }));
      s += g({ opacity: seg(lt, 0.45 + k * 0.15, 0.3) * (stall ? 0.45 : 1) }, row);
    });
    // WebSocket 으로 흘러 나간다
    const ws = seg(lt, 3.9, 0.35);
    const wx = OX + 112;
    const y0 = rowY(3) + 18;
    const y1 = 386;
    const down = tag("path", { d: `M${wx - 6} ${y1 - 8}L${wx} ${y1}L${wx + 6} ${y1 - 8}`, ...line, stroke: C.ink });
    s += g({ opacity: ws }, tag("path", { d: `M${wx} ${y0}V${y1}`, ...line, stroke: C.ink }) + down + chip(wx, 406, "WebSocket 실시간 송출", { size: 13, fill: C.lemon, anchor: "middle" }));
    if (ws > 0.5) {
      for (let k = 0; k < 2; k++) {
        const u = ((lt - 3.9) * 1.1 + k / 2) % 1;
        s += tag("rect", { x: wx - 7, y: lerp(y0 + 4, y1 - 14, u) - 5, width: 14, height: 10, rx: 2.5, fill: C.lemon, stroke: C.ink, "stroke-width": 1.3, opacity: Math.min(1, Math.sin(Math.PI * u) * 2) });
      }
    }
    return s;
  }

  function draw(t) {
    let s = tag("rect", { x: 0, y: 0, width: W, height: H, fill: BG });
    if (t < beats[1].at) s += gpuBeat(t);
    else if (t < beats[2].at) s += roiBeat(t - beats[1].at);
    else s += streamBeat(t - beats[2].at);
    // 장이 바뀔 때 바탕색으로 잠깐 비운다
    for (const b of beats.slice(1)) {
      const u = clamp((t - (b.at - 0.3)) / 0.6);
      if (u > 0 && u < 1) s += tag("rect", { x: 0, y: 64, width: W, height: H - 64, fill: BG, opacity: E.inOut(1 - Math.abs(u * 2 - 1)) });
    }
    return s;
  }

  return { beats, duration, draw, bg: BG, poster: 4.2 };
})();
