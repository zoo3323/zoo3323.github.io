// 라벨링 도구: 도구 창 안에 같은 주차장 카메라 화면. 세 장(짐작한 바닥 격자가 어긋남 → 주차면 직선·직각·2.5×5 m 로 보정, 네 점을 찍다 가려진 점을 짐작 → 앞변 가운데 한 번 클릭으로 하단면 생성, 차마다 손으로 → 모델 하단면 추천으로 사전 라벨)
"use strict";
window.SCENE = (() => {
  const BG = "#d6ecff";
  const lot = makeLot({
    bg: "#dfe7ee",
    sp: 2.5, // 일반형 주차면 2.5×5 m: 보정에 쓰는 크기와 같게 그린다
    depth: 5,
    cam: { pos: [6.2, -8.4, 9.4], target: [9.4, 2.7, 0], f: 610, cx: 400, cy: 286 },
    focus: 4,
    cars: [
      { space: -1, dx: 0.1, dy: 0.2, yaw: 0.02, color: "#dfe3e8" },
      { space: 0, dx: 0.06, dy: 0.15, yaw: 0.025, color: "#f7f6f1" },
      { space: 1, dx: -0.12, dy: 0.05, yaw: -0.03, color: "#dfe3e8" },
      { space: 3, dx: 0.08, dy: 0.25, yaw: 0.02, color: "#f7f6f1" },
      { space: 4, dx: 0.14, dy: 0.3, yaw: -0.045, color: C.lilac },
      { space: 6, dx: -0.1, dy: 0.1, yaw: 0.03, color: "#f7f6f1" },
      { space: 7, dx: 0.05, dy: 0.2, yaw: -0.02, color: "#dfe3e8" },
    ],
  });
  const { cars, FOCUS, parts, footprint, hiddenCorner, world, makeCam, spaceQuad, SP, DEPTH } = lot;
  const LABELED = [2, 3, 4, 5]; // 창 안에 온전히 보이는 차
  const beats = [
    { at: 0, solve: 2.9 },
    { at: 5.8, solve: 2.9 },
    { at: 11.6, solve: 2.7 },
  ];
  const duration = 17.6;
  const WIN = { x: 28, y: 80, w: 744, h: 354 };
  const CV = { x: 42, y: 126, w: 494, h: 278 };
  const PN = { x: 552, y: 126, w: 206 };
  const VIEW = { cx: 262, cy: 318, s: 0.93 };
  const CAM_A = { pos: [6.2, -8.4, 9.4], target: [9.4, 2.7, 0] };

  // ── 창 ──
  const TABS = ["수집", "보정", "라벨"];
  const SWITCH = [
    [0, 1],
    [5.8, 2],
  ];
  function tabs(t) {
    let cur = 0;
    SWITCH.forEach((sw, i) => {
      if (t >= sw[0]) cur = i;
    });
    const u = cur ? seg(t, SWITCH[cur][0], 0.25) : 1;
    const weight = TABS.map((_, i) => (i === SWITCH[cur][1] ? u : 0) + (cur && i === SWITCH[cur - 1][1] ? 1 - u : 0));
    const o = { size: 12.5, pad: 11, h: 24 };
    const widths = TABS.map((l) => chip.width(l, o));
    let x = WIN.x + WIN.w - 14 - widths.reduce((a, b) => a + b, 0) - 6 * (TABS.length - 1);
    let s = "";
    TABS.forEach((l, i) => {
      s += chip(x, WIN.y + 17, l, { ...o, fill: C.paper, color: C.sub, stroke: C.rule });
      s += chip(x, WIN.y + 17, l, { ...o, fill: C.lemon, color: C.ink, stroke: C.ink, opacity: weight[i] });
      x += widths[i] + 6;
    });
    return s;
  }

  const ptitle = (s, a = 1) => text(PN.x + 2, PN.y + 12, s, { "font-size": 13.5, "font-weight": 700, fill: C.sub, opacity: a });
  const row = (y, label, right, a = 1, o = {}) =>
    g(
      { opacity: a },
      tag("rect", { x: PN.x, y: y - (o.h || 32) / 2, width: PN.w, height: o.h || 32, rx: 9, fill: o.fill || C.mute }) +
        (o.swatch ? tag("rect", { x: PN.x + 10, y: y - 7, width: 22, height: 14, rx: 4, fill: o.swatch, stroke: C.ink, "stroke-width": 1.4 }) : "") +
        text(PN.x + (o.swatch ? 42 : 12), y + 0.5, label, { "font-size": 14.5, "font-weight": 700, fill: C.ink }) +
        (right || ""),
    );
  const ring = (x, y, a = 1) => tag("circle", { cx: x, cy: y, r: 7, fill: C.paper, stroke: C.wire, "stroke-width": 1.6, opacity: a });
  const mark = (y, u) => ring(PN.x + PN.w - 18, y, 1 - u) + g({ opacity: u }, tick(PN.x + PN.w - 18, y, 0.8));

  // 손으로 네 점을 찍으면 가려진 꼭짓점일수록 크게 빗나간다
  const JIT = [
    [-9, 7],
    [8, -6],
    [15, 11],
    [-12, -9],
  ];
  const clicked = (cam, car, big) => {
    const rg = parts(car).body.bottom.map(cam.P);
    const hc = hiddenCorner(cam, car);
    return rg.map((q, i) => (i === hc ? [q[0] + big[0], q[1] + big[1]] : [q[0] + JIT[i][0], q[1] + JIT[i][1]]));
  };

  // 한 번 클릭: 차가 바닥에 닿는 카메라 쪽 앞변 가운데를 찍으면, 그 자리에서 앞변이 좌우로 벌어지고 하단면이 주차면을 따라 안쪽으로 뻗는다
  const GROW = 0.5;
  const frontMid = (cam, car) => {
    const rg = parts(car).body.bottom;
    return cam.P(v3.lerp(rg[0], rg[1], 0.5));
  };
  function oneClick(cam, car, lt, c, a = 1) {
    if (lt < c || a <= 0.002) return "";
    const rg = parts(car).body.bottom;
    const m = v3.lerp(rg[0], rg[1], 0.5);
    const u1 = seg(lt, c + 0.05, 0.2, E.out);
    const u2 = seg(lt, c + 0.18, GROW - 0.18, E.inOut);
    const done = seg(lt, c + GROW, 0.2);
    const live = (1 - done) * a;
    const f0 = v3.lerp(m, rg[0], u1);
    const f1 = v3.lerp(m, rg[1], u1);
    const b1 = v3.add(f1, v3.lerp([0, 0, 0], v3.sub(rg[2], rg[1]), u2));
    const b0 = v3.add(f0, v3.lerp([0, 0, 0], v3.sub(rg[3], rg[0]), u2));
    const q = [f0, f1, b1, b0].map(cam.P);
    let s = "";
    if (u2 > 0.001) s += tag("path", { d: dpath(q), fill: C.lemon, opacity: 0.62 * live });
    s += tag("path", { d: dpath([q[1], q[2], q[3], q[0]], false), fill: "none", stroke: C.ink, "stroke-width": 2.4, "stroke-dasharray": "5 5", "stroke-linecap": "round", opacity: live * (u2 > 0.001 ? 1 : 0) });
    s += tag("path", { d: dpath([q[0], q[1]], false), fill: "none", stroke: C.ink, "stroke-width": 2.4, "stroke-linecap": "round", opacity: live });
    s += footprint(cam, car, done * a);
    const p = cam.P(m);
    s += tag("circle", { cx: p[0], cy: p[1], r: 4.6, fill: C.lemon, stroke: C.ink, "stroke-width": 2, opacity: a * (1 - done) });
    return s;
  }

  function draw(t) {
    const st = { camPos: CAM_A.pos, camTarget: CAM_A.target, fp: [], fpStyle: [], tint: [], grid: 0 };
    const cam = makeCam(st, VIEW);
    let over = "";
    let under = ""; // 차 아래 바닥에 까는 그림(칸 칠·직각·치수선)
    let panel = "";
    let cursor = null;
    let clicks = [];

    // ── 1장 ──
    if (t < beats[1].at) {
      const lt = t;
      const out = 1 - seg(lt, 5.4, 0.3, E.in);
      // 문제: 보정값이 없어 짐작으로 올린 바닥 격자가 주차선과 어긋난다
      const guess = seg(lt, 0.45, 0.5) * (1 - seg(lt, 2.7, 0.25, E.in));
      if (guess > 0.002) {
        const wob = Math.sin(lt * 2.4);
        const wc = makeCam({ camPos: [6.2 + 1.4 * wob, -8.4, 7.4], camTarget: [9.4 - 0.6 * wob, 3.4, 0] }, VIEW);
        let gl = "";
        for (let x = 0; x <= SP * 8 + 0.01; x += 2.5) gl += dpath(wc.line([x, -2.5, 0], [x, DEPTH, 0]), false);
        for (let y = -2.5; y <= DEPTH + 0.01; y += 2.5) gl += dpath(wc.line([0, y, 0], [SP * 8, y, 0]), false);
        over += tag("path", { d: gl, fill: "none", stroke: C.red, "stroke-width": 1.8, "stroke-dasharray": "6 5", opacity: 0.85 * guess });
        over += chip(CV.x + 12, CV.y + 22, "짐작한 바닥 격자", { size: 12.5, fill: C.paper, color: C.red, stroke: C.red, opacity: seg(lt, 0.9, 0.3) * guess });
      }
      // 해결: 주차면의 가로·세로 직선, 네 귀퉁이 직각, 2.5×5 m 크기로 카메라를 보정한다
      const S = 5; // 크기를 재는 빈 칸
      const lineOn = (p, q, u, color) => drawOn(dpath(cam.line(p, q), false), u, { stroke: color, "stroke-width": 3.2, opacity: out });
      over += lineOn([SP * 1, DEPTH, 0], [SP * 8, DEPTH, 0], seg(lt, 3.0, 0.5, E.inOut), "#16a34a");
      over += lineOn([SP * 1, 0, 0], [SP * 8, 0, 0], seg(lt, 3.15, 0.5, E.inOut), "#16a34a");
      [3, S, S + 1].forEach((i, j) => (over += lineOn([SP * i, 0, 0], [SP * i, DEPTH, 0], seg(lt, 3.3 + j * 0.08, 0.35, E.inOut), "#f97316")));
      [
        [S, 0, 1, 1],
        [S + 1, 0, -1, 1],
        [S + 1, 1, -1, -1],
        [S, 1, 1, -1],
      ].forEach(([i, k, sx, sy], j) => {
        const x = SP * i;
        const y = DEPTH * k;
        const m = 0.55;
        const sq = [
          [x, y, 0],
          [x + sx * m, y, 0],
          [x + sx * m, y + sy * m, 0],
          [x, y + sy * m, 0],
        ].map(cam.P);
        const a = seg(lt, 3.72 + j * 0.08, 0.25) * out;
        under += tag("path", { d: dpath(sq), fill: C.lemon, opacity: 0.9 * a });
        under += tag("path", { d: dpath(sq.slice(1), false), fill: "none", stroke: C.ink, "stroke-width": 2.2, opacity: a });
      });
      const sz = seg(lt, 4.1, 0.3) * out;
      under += tag("path", { d: dpath(cam.poly(spaceQuad(S, 0.12))), fill: C.lemon, opacity: 0.4 * sz });
      // 치수선(양끝 짧은 눈금)과 가운데 치수
      const dimLine = (p, q, n) => {
        const tk = (r) => dpath(cam.line([r[0] - n[0], r[1] - n[1], 0], [r[0] + n[0], r[1] + n[1], 0]), false);
        return tag("path", { d: dpath(cam.line([...p, 0], [...q, 0]), false) + tk(p) + tk(q), fill: "none", stroke: C.ink, "stroke-width": 1.8, "stroke-linecap": "round", opacity: sz });
      };
      under += dimLine([SP * S, -0.55], [SP * (S + 1), -0.55], [0, 0.25]);
      under += dimLine([SP * S + 1.85, 0], [SP * S + 1.85, DEPTH], [0.25, 0]);
      const pw = cam.P([SP * (S + 0.5), -0.55, 0]);
      const pd = cam.P([SP * S + 1.85, DEPTH * 0.5, 0]);
      over += chip(pw[0], pw[1], "2.5 m", { size: 12.5, anchor: "middle", fill: C.paper, opacity: seg(lt, 4.2, 0.25) * out });
      over += chip(pd[0], pd[1], "5 m", { size: 12.5, anchor: "middle", fill: C.paper, opacity: seg(lt, 4.3, 0.25) * out });
      // 보정한 카메라로 올린 2.5 m 격자는 주차선에 그대로 겹친다
      st.grid = seg(lt, 4.55, 0.5) * out;
      // 창 오른쪽 칸
      const RES = ["초점거리", "카메라 높이", "좌우 기울기"];
      const p1 = 1 - seg(lt, 2.85, 0.2, E.in);
      const p2 = seg(lt, 2.95, 0.25);
      panel += g(
        { opacity: p1 },
        ptitle("카메라 보정") +
          RES.map((l, i) => row(PN.y + 44 + i * 38, l, text(PN.x + PN.w - 18, PN.y + 45 + i * 38, "?", { "font-size": 16, "font-weight": 700, fill: C.sub, "text-anchor": "middle" }))).join("") +
          chip(PN.x, PN.y + 44 + 3 * 38 + 4, "보정값 없음", { size: 12.5, fill: C.red, color: C.paper, stroke: null, opacity: seg(lt, 1.4, 0.3) }),
      );
      const RH = { h: 28 };
      let p2s = ptitle("주차면 조건");
      [
        ["가로·세로 직선", 3.0, 3.6],
        ["직각", 3.68, 4.05],
        ["크기 2.5×5 m", 4.1, 4.45],
      ].forEach(([l, a, b], i) => {
        const y = PN.y + 42 + i * 33;
        const done = seg(lt, b, 0.2);
        p2s += row(y, l, ring(PN.x + PN.w - 18, y, 1 - done) + g({ opacity: done }, tick(PN.x + PN.w - 18, y, 0.8)), seg(lt, a, 0.25), RH);
      });
      p2s += text(PN.x + 2, PN.y + 150, "보정값", { "font-size": 13.5, "font-weight": 700, fill: C.sub, opacity: seg(lt, 4.5, 0.25) });
      RES.forEach((l, i) => {
        const y = PN.y + 180 + i * 33;
        p2s += row(y, l, g({ opacity: seg(lt, 4.65 + i * 0.15, 0.25) }, tick(PN.x + PN.w - 18, y, 0.8)), seg(lt, 4.5 + i * 0.1, 0.25), RH);
      });
      panel += g({ opacity: p2 }, p2s);
      // 커서: 가로선을 따라 긋고, 귀퉁이와 폭을 짚는다
      const L0 = cam.P([SP * 2, DEPTH, 0]);
      const L1 = cam.P([SP * 8, DEPTH, 0]);
      const cA = cam.P([SP * S, 0, 0]);
      cursor = track(lt, [
        [0, 330, 380],
        [1.4, 300, 362],
        [2.6, 300, 362],
        [3.0, ...L0],
        [3.5, ...L1],
        [3.72, ...cA],
        [4.0, ...cA],
        [4.15, ...pw],
        [4.6, ...pw],
        [5.1, 440, 372],
        [5.8, 440, 372],
      ]);
      clicks = [3.0, 3.72, 4.15].map((tt) => [tt, lt]);
    }

    // ── 2장: 한 번 클릭 ──
    if (t >= beats[1].at && t < beats[2].at) {
      const lt = t - beats[1].at;
      const out = 1 - seg(lt, 5.4, 0.3, E.in);
      const red = 1 - seg(lt, 2.75, 0.3, E.in);
      const car = cars[FOCUS];
      // 문제: 네 꼭짓점을 다 찍다 보니 가려진 꼭짓점은 짐작으로 찍혀 모양이 틀어진다
      const hc = hiddenCorner(cam, car);
      const pts = clicked(cam, car, [-30, 20]);
      const times = [0.5, 0.9, 1.3, 1.7];
      const shown = times.filter((tt) => lt >= tt).length;
      if (shown) {
        const poly = pts.slice(0, shown);
        const closed = shown === 4;
        over += tag("path", { d: dpath(poly, closed), fill: closed ? C.red : "none", "fill-opacity": 0.14, stroke: C.red, "stroke-width": 2.4, "stroke-linejoin": "round", opacity: red });
        poly.forEach((q) => (over += tag("circle", { cx: q[0], cy: q[1], r: 4.2, fill: C.red, stroke: C.paper, "stroke-width": 1.5, opacity: red })));
      }
      const hq = pts[hc];
      over += chip(hq[0] + 12, hq[1] - 18, "가려진 점?", { size: 12, h: 22, pad: 8, fill: C.paper, color: C.red, stroke: C.red, opacity: seg(lt, times[hc] + 0.1, 0.25) * red });
      // 해결: 보정한 바닥 위에서 차마다 앞변 가운데를 한 번씩 찍는다
      st.grid = 0.4 * seg(lt, 2.95, 0.4) * out;
      const SEQ = [
        { ci: FOCUS, c: 3.15 },
        { ci: 3, c: 3.85 },
        { ci: 5, c: 4.55 },
      ];
      SEQ.forEach(({ ci, c }) => (over += oneClick(cam, cars[ci], lt, c, out)));
      const M = SEQ.map(({ ci }) => frontMid(cam, cars[ci]));
      cursor = track(lt, [
        [0, 440, 372],
        [0.45, ...pts[0]],
        [0.85, ...pts[1]],
        [1.25, ...pts[2]],
        [1.65, ...pts[3]],
        [2.3, 440, 372],
        [2.85, 440, 372],
        [3.12, ...M[0]],
        [3.45, M[0][0] + 30, M[0][1] + 30],
        [3.82, ...M[1]],
        [4.15, M[1][0] + 30, M[1][1] + 30],
        [4.52, ...M[2]],
        [5.1, 440, 372],
        [5.8, 440, 372],
      ]);
      clicks = [...times, ...SEQ.map((q) => q.c)].map((tt) => [tt, lt]);
      // 창 오른쪽 칸
      const p1 = 1 - seg(lt, 2.85, 0.2, E.in);
      const p2 = seg(lt, 2.95, 0.25);
      panel += g(
        { opacity: p1 },
        ptitle("꼭짓점 직접 입력") + row(PN.y + 44, "네 점 직접 클릭", "") + chip(PN.x, PN.y + 86, "가려진 점 짐작", { size: 12.5, fill: C.red, color: C.paper, stroke: null, opacity: seg(lt, 1.9, 0.3) }),
      );
      let p2s = ptitle("한 번 클릭");
      SEQ.forEach(({ ci, c }, j) => {
        const y = PN.y + 44 + j * 38;
        p2s += row(y, "차", mark(y, seg(lt, c + GROW, 0.2)), seg(lt, 2.95 + j * 0.1, 0.25), { swatch: cars[ci].color });
      });
      p2s += chip(PN.x, PN.y + 44 + 3 * 38 + 4, "앞변 가운데 클릭", { size: 12.5, fill: C.lemon, opacity: seg(lt, 3.0, 0.3) });
      panel += g({ opacity: p2 }, p2s);
    }

    // ── 3장: 모델 사전 라벨 ──
    if (t >= beats[2].at) {
      const lt = t - beats[2].at;
      // 문제: 차마다 손으로 한 대씩 찍는다
      const prob = 1 - seg(lt, 2.6, 0.3, E.in);
      const HAND = [
        { j: 1, c: 0.5 },
        { j: 2, c: 1.3 },
      ];
      HAND.forEach(({ j, c }) => (over += oneClick(cam, cars[LABELED[j]], lt, c, prob)));
      // 해결: 「모델 하단면 추천」을 누르면 화면의 모든 차에 하단면 사전 라벨(점선)이 뜬다
      const press = 3.0;
      LABELED.forEach((ci, j) => (over += footprint(cam, cars[ci], seg(lt, press + 0.2 + j * 0.12, 0.3), { style: "pre" })));
      over += chip(CV.x + 12, CV.y + 22, "모델 사전 라벨", { size: 12.5, fill: "#d9d2ff", opacity: seg(lt, press + 0.15, 0.3) });
      // 창 오른쪽 칸: 차마다 상태
      panel += ptitle("라벨");
      LABELED.forEach((ci, j) => {
        const y = PN.y + 44 + j * 38;
        const hand = HAND.find((q) => q.j === j);
        const done = hand ? seg(lt, hand.c + GROW, 0.2) * prob : 0;
        const pre = seg(lt, press + 0.25 + j * 0.12, 0.25);
        const right =
          ring(PN.x + PN.w - 18, y, 1 - Math.max(done, pre)) +
          g({ opacity: done }, tick(PN.x + PN.w - 18, y, 0.85)) +
          chip(PN.x + PN.w - 10, y, "제안", { size: 12, fill: "#d9d2ff", anchor: "end", pad: 8, h: 22, opacity: pre });
        panel += row(y, "차", right, 1, { swatch: cars[ci].color });
      });
      const btn = PN.y + 44 + 4 * 38 + 8;
      panel += chip(PN.x, btn, "차마다 손으로", { size: 12.5, fill: C.red, color: C.paper, stroke: null, opacity: seg(lt, 1.9, 0.3) * prob });
      panel += chip(PN.x + PN.w / 2, btn, "모델 하단면 추천", { size: 13.5, anchor: "middle", fill: lt > press - 0.05 ? C.lemon : C.paper, h: 32, pad: 16, opacity: seg(lt, 2.75, 0.3) });
      const M = HAND.map(({ j }) => frontMid(cam, cars[LABELED[j]]));
      cursor = track(lt, [
        [0, 440, 372],
        [0.47, ...M[0]],
        [0.85, M[0][0] + 30, M[0][1] + 30],
        [1.27, ...M[1]],
        [1.8, M[1][0] + 30, M[1][1] + 30],
        [2.95, PN.x + PN.w / 2 + 20, btn + 4],
        [3.6, PN.x + PN.w / 2 + 20, btn + 4],
        [4.4, 440, 372],
        [6.0, 440, 372],
      ]);
      clicks = [...HAND.map((q) => q.c), press].map((tt) => [tt, lt]);
    }

    // ── 그리기 ──
    let s = tag("rect", { x: 0, y: 0, width: W, height: H, fill: BG });
    s += card(WIN.x, WIN.y, WIN.w, WIN.h);
    s += text(WIN.x + 18, WIN.y + 17.5, "라벨링 도구", { "font-size": 14.5, "font-weight": 700, fill: C.ink });
    s += tabs(t);
    s += tag("path", { d: `M${WIN.x + 2} ${WIN.y + 34}H${WIN.x + WIN.w - 2}`, stroke: C.rule, "stroke-width": 1.5 });
    s += `<clipPath id="cv"><rect x="${CV.x}" y="${CV.y}" width="${CV.w}" height="${CV.h}" rx="9"/></clipPath>`;
    st.under = () => under;
    st.extra = () => over;
    const view = world(st, VIEW);
    s += g({ "clip-path": "url(#cv)" }, view);
    s += tag("rect", { x: CV.x, y: CV.y, width: CV.w, height: CV.h, rx: 9, fill: "none", stroke: C.ink, "stroke-width": 1.5 });
    s += panel;
    if (cursor) {
      for (const [tt, lt] of clicks) s += ripple(cursor[0], cursor[1], (lt - tt) / 0.45);
      s += pointer(cursor[0], cursor[1]);
    }
    return s;
  }

  return { beats, duration, draw, bg: BG, poster: 5.2 };
})();
