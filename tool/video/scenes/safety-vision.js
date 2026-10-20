// 안전 영상 분석: 세 장(모델 넷이 GPU 한 대에 → 동적 모델 매니저, 카메라를 옮기면 ROI 다시 그리기 → ArUco 마커로 자동, 모든 트랙 ReID → 믿을 만한 트랙만)
"use strict";
window.SCENE = (() => {
  const BG = "#d4f2e1";
  const beats = [
    { at: 0, solve: 2.7 },
    { at: 5.7, solve: 2.7 },
    { at: 11.2, solve: 2.8 },
  ];
  const duration = 17.6;

  // ── 1장: GPU 메모리 ──
  const MODELS = [
    { name: "화재·연기", w: 112, fill: "#ffc9b9" },
    { name: "안전모", w: 92, fill: "#fff0a0" },
    { name: "침입", w: 78, fill: "#c9e8ff" },
    { name: "다중 카메라 추적", w: 152, fill: "#d9d2ff" },
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
    s += chip(BOX.x + BOX.w / 2 + 40, BOX.y + BOX.h / 2, "메모리 비움", { size: 12.5, fill: C.paper, anchor: "middle", opacity: flush });
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
    over += chip(hand[2][0] + 10, hand[2][1] - 24, "다시 그려야 함", { size: 12.5, fill: C.red, color: C.paper, stroke: null, opacity: wrong * fixA });
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
    over += chip(MON.x + 14, MON.y + MON.h - 22, "마커 네 개 → ROI 자동 생성", { size: 12.5, fill: C.lemon, opacity: seg(lt, 3.7, 0.3) });
    let s = card(MON.x - 2, MON.y - 2, MON.w + 4, MON.h + 4, { rx: 12 });
    s += `<clipPath id="mon"><rect x="${MON.x}" y="${MON.y}" width="${MON.w}" height="${MON.h}" rx="11"/></clipPath>`;
    s += g({ "clip-path": "url(#mon)" }, yard(cam, { extra: over }));
    s += chip(MON.x + 14, MON.y + 22, "CAM 1", { size: 12.5, fill: C.paper });
    s += chip(MON.x + MON.w - 14, MON.y + 22, "카메라 각도 바뀜", { size: 12.5, fill: C.paper, anchor: "end", opacity: seg(lt, 1.35, 0.25) * (1 - seg(lt, 2.4, 0.3, E.in)) + seg(lt, 4.05, 0.25) * (1 - seg(lt, 4.85, 0.2, E.in)) });
    s += g({ opacity: ok }, chip(MON.x + MON.w - 14, MON.y + 22, "ROI가 그대로 따라감", { size: 12.5, fill: C.lemon, anchor: "end" }));
    return s;
  }

  // ── 3장: ReID ──
  const TILE = [
    { x: 40, y: 88, w: 348, h: 222 },
    { x: 412, y: 88, w: 348, h: 222 },
  ];
  const floor = (T) => {
    const top = T.y + T.h * 0.3;
    let s = tag("rect", { x: T.x, y: T.y, width: T.w, height: T.h, fill: "#dfe5e1" });
    s += tag("path", { d: `M${T.x} ${n2(top)}H${T.x + T.w}V${T.y + T.h}H${T.x}Z`, fill: "#e9e7df" });
    let l = "";
    for (let i = -3; i <= 3; i++) l += `M${n2(T.x + T.w / 2 + i * 30)} ${n2(top)}L${n2(T.x + T.w / 2 + i * 120)} ${T.y + T.h}`;
    s += tag("path", { d: l, fill: "none", stroke: "#cfccc2", "stroke-width": 1.5 });
    return s;
  };
  // 사람 그림표와 검출 상자. conf 가 낮으면 점선 상자
  function person(x, y, sc, o = {}) {
    const bw = 30 * sc;
    const bh = 60 * sc;
    let s = tag("circle", { cx: x, cy: y - bh * 0.72, r: 6.5 * sc, fill: "#55606e" });
    s += tag("rect", { x: x - 8.5 * sc, y: y - bh * 0.58, width: 17 * sc, height: bh * 0.58, rx: 6 * sc, fill: "#55606e" });
    s += tag("rect", { x: x - bw / 2 - 4, y: y - bh - 2, width: bw + 8, height: bh + 6, rx: 5, fill: "none", stroke: o.color || C.ink, "stroke-width": 2.2, "stroke-dasharray": o.weak ? "5 4" : undefined, opacity: o.boxA ?? 1 });
    if (o.id) s += chip(x - bw / 2 - 4, y - bh - 14, o.id, { size: 11.5, fill: o.idFill || C.paper, h: 20, pad: 7, opacity: o.idA ?? 1 });
    return s;
  }
  // ReID 를 할 때마다 상자에서 퍼지는 고리
  const ping = (x, y, u, color) => (u <= 0 || u >= 1 ? "" : tag("circle", { cx: x, cy: y, r: 10 + 26 * E.out(u), fill: "none", stroke: color, "stroke-width": 2.4, opacity: 0.7 * (1 - u) }));

  function reidBeat(lt) {
    const fix = seg(lt, 2.8, 0.35);
    let s = "";
    TILE.forEach((T, i) => {
      s += card(T.x - 2, T.y - 2, T.w + 4, T.h + 4, { rx: 12 });
      s += `<clipPath id="tile${i}"><rect x="${T.x}" y="${T.y}" width="${T.w}" height="${T.h}" rx="11"/></clipPath>`;
    });
    // 사람들: [타일, x(0~1), 바닥 y(0~1), 크기, 믿을 만한가, ID]
    const walk = seg(lt, 3.3, 1.2, E.inOut);
    const people = [
      { t: 0, x: lerp(0.55, 1.18, walk), y: 0.84, sc: 1.2, strong: true, id: "ID 7", star: true },
      { t: 0, x: 0.25, y: 0.72, sc: 1.0, strong: true, id: "ID 3" },
      { t: 0, x: 0.4, y: 0.52, sc: 0.72, strong: false },
      { t: 1, x: 0.72, y: 0.68, sc: 1.0, strong: true, id: "ID 5" },
      { t: 1, x: 0.24, y: 0.52, sc: 0.72, strong: false },
      { t: 1, x: lerp(-0.2, 0.38, seg(lt, 4.1, 0.95, E.out)), y: 0.86, sc: 1.2, strong: true, id: "ID 7", star: true, enter: true },
    ];
    TILE.forEach((T, ti) => {
      let inner = floor(T);
      people
        .filter((p) => p.t === ti)
        .forEach((p, k) => {
          const x = T.x + p.x * T.w;
          const y = T.y + p.y * T.h;
          const a = p.enter ? seg(lt, 4.1, 0.2) : 1;
          // 문제: 모든 상자가 쉬지 않고 ReID. 해결: 믿을 만한 상자만 한 번
          let pings = "";
          for (let n = 0; n < 7; n++) {
            const t0 = 0.35 + n * 0.34 + k * 0.09;
            if (t0 < 2.75) pings += ping(x, y - 30 * p.sc, (lt - t0) / 0.5, C.red);
          }
          if (p.strong && !p.enter) pings += ping(x, y - 30 * p.sc, (lt - (3.0 + k * 0.15)) / 0.6, C.ink);
          const idFill = p.star && lt > 4.35 ? C.lemon : C.paper;
          inner += g({ opacity: a }, pings + person(x, y, p.sc, { weak: !p.strong && fix > 0.5, id: p.strong ? p.id : null, idFill, color: !p.strong && fix > 0.5 ? C.wire : C.ink }));
        });
      s += g({ "clip-path": `url(#tile${ti})` }, inner);
      s += chip(T.x + 12, T.y + 20, `CAM ${ti + 1}`, { size: 12, fill: C.paper, h: 22, pad: 8 });
    });
    // 같은 사람: 두 카메라를 잇는 호
    const link = seg(lt, 4.55, 0.5, E.inOut);
    s += drawOn("M372 300C392 338 432 338 452 300", link, { stroke: C.ink, "stroke-width": 2.2, "stroke-dasharray": link >= 0.999 ? "6 5" : undefined });
    s += chip(412, 340, "같은 사람 · 전역 ID", { size: 12.5, fill: C.lemon, anchor: "middle", opacity: seg(lt, 4.8, 0.3) });
    // GPU 부하
    const load = lerp(0.95, 0.42, fix) * seg(lt, 0.2, 0.8);
    const hot = load > 0.8;
    s += text(40, 392, "GPU 부하", { "font-size": 14, "font-weight": 700, fill: "#24533a" });
    s += tag("rect", { x: 120, y: 380, width: 520, height: 24, rx: 12, fill: C.paper, stroke: C.ink, "stroke-width": 2 });
    s += tag("rect", { x: 123, y: 383, width: Math.max(0, 514 * load), height: 18, rx: 9, fill: hot ? C.red : "#4ade80" });
    s += chip(760, 392, "과부하", { size: 12.5, fill: C.red, color: C.paper, stroke: null, anchor: "end", opacity: seg(lt, 1.3, 0.3) * (1 - fix) });
    s += chip(760, 392, "여유", { size: 12.5, fill: C.paper, anchor: "end", opacity: seg(lt, 3.3, 0.3) });
    return s;
  }

  function draw(t) {
    let s = tag("rect", { x: 0, y: 0, width: W, height: H, fill: BG });
    if (t < beats[1].at) s += gpuBeat(t);
    else if (t < beats[2].at) s += roiBeat(t - beats[1].at);
    else s += reidBeat(t - beats[2].at);
    // 장이 바뀔 때 바탕색으로 잠깐 비운다
    for (const b of beats.slice(1)) {
      const u = clamp((t - (b.at - 0.3)) / 0.6);
      if (u > 0 && u < 1) s += tag("rect", { x: 0, y: 64, width: W, height: H - 64, fill: BG, opacity: E.inOut(1 - Math.abs(u * 2 - 1)) });
    }
    return s;
  }

  return { beats, duration, draw, bg: BG, poster: 4.2 };
})();
