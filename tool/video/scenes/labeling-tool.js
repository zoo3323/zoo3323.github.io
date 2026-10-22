// 라벨링 도구: 도구 창 안에 같은 주차장 카메라 화면. 네 장(짐작한 바닥 격자가 어긋남 → 주차면 직선·직각·2.5×5 m 로 보정, 네 점을 찍다 가려진 점을 짐작 → 앞 두 점 클릭으로 하단면 생성, 차마다 손으로 → 모델 사전 라벨, 같은 장면·손으로 꾸리는 학습 세트 → 중복 제거·규격 맞춤 내보내기·버전 기록)
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
    { at: 17.2, solve: 2.8 },
  ];
  const duration = 23.4;
  const WIN = { x: 28, y: 80, w: 744, h: 354 };
  const CV = { x: 42, y: 126, w: 494, h: 278 };
  const PN = { x: 552, y: 126, w: 206 };
  const VIEW = { cx: 262, cy: 318, s: 0.93 };
  const CAM_A = { pos: [6.2, -8.4, 9.4], target: [9.4, 2.7, 0] };
  // 내보내기: 모델 입력(4:3)에 맞춰 레터박스로 줄여 넣은 자리
  const LB = (() => {
    const w = (CV.h * 4) / 3;
    return { x: CV.x + (CV.w - w) / 2, w, s: w / CV.w };
  })();

  // ── 창 ──
  const TABS = ["수집", "보정", "라벨", "내보내기"];
  const SWITCH = [
    [0, 1],
    [5.8, 2],
    [17.2, 0],
    [20.55, 3],
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

  // 두 점 입력: 앞 두 꼭짓점을 찍으면 뒤쪽이 보정한 바닥 위로 펼쳐져 하단면이 된다. cur 는 지금 커서 자리
  const GROW = 0.45;
  const frontPair = (cam, car) => parts(car).body.bottom.slice(0, 2).map(cam.P);
  function twoPoint(cam, car, lt, c1, c2, cur, a = 1, size = true) {
    if (lt < c1 || a <= 0.002) return "";
    const rg = parts(car).body.bottom;
    const [p0, p1] = frontPair(cam, car);
    const g0 = c2 + 0.07;
    const u = seg(lt, g0, GROW, E.inOut);
    const done = seg(lt, g0 + GROW, 0.2);
    const live = (1 - done) * a;
    let s = "";
    if (u > 0.001) {
      const q = [rg[0], rg[1], v3.lerp(rg[1], rg[2], u), v3.lerp(rg[0], rg[3], u)].map(cam.P);
      s += tag("path", { d: dpath(q), fill: C.lemon, opacity: 0.62 * live });
      s += tag("path", { d: dpath([q[1], q[2], q[3], q[0]], false), fill: "none", stroke: C.ink, "stroke-width": 2.4, "stroke-dasharray": "5 5", "stroke-linecap": "round", opacity: live });
    }
    // 첫 점에서 커서까지 고무줄, 두 번째 점을 찍으면 앞 변이 된다
    s += tag("path", { d: dpath([p0, lt < c2 ? cur : p1], false), fill: "none", stroke: C.ink, "stroke-width": 2.4, "stroke-linecap": "round", "stroke-dasharray": lt < c2 ? "4 4" : undefined, opacity: live });
    s += footprint(cam, car, done * a);
    const dot = (p) => tag("circle", { cx: p[0], cy: p[1], r: 4.4, fill: C.lemon, stroke: C.ink, "stroke-width": 2, opacity: a * (1 - done) });
    s += dot(p0);
    if (lt >= c2) s += dot(p1);
    if (size) {
      const pt = cam.P([car.c[0], car.c[1], 1.95]);
      s += chip(pt[0], pt[1], "1.85 × 4.5 m", { size: 12, h: 22, pad: 8, anchor: "middle", fill: C.paper, opacity: seg(lt, g0 + GROW, 0.25) * a });
    }
    return s;
  }
  const grown = (lt, c2) => lt >= c2 + 0.07 + GROW;

  function draw(t) {
    const st = { camPos: CAM_A.pos, camTarget: CAM_A.target, fp: [], fpStyle: [], tint: [], grid: 0 };
    const cam = makeCam(st, VIEW);
    let over = "";
    let under = ""; // 차 아래 바닥에 까는 그림(칸 칠·직각·치수선)
    let top = ""; // 캔버스 위(레터박스와 함께 줄지 않는) 딱지
    let lbox = 0; // 4장 내보내기: 레터박스로 줄여 넣은 정도
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

    // ── 2장: 두 점 입력 ──
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
      // 해결: 보정한 바닥 위에서 차마다 앞 두 점만 찍는다
      st.grid = 0.4 * seg(lt, 2.95, 0.4) * out;
      const SEQ = [
        { ci: FOCUS, c1: 3.15, c2: 3.55 },
        { ci: 3, c1: 4.3, c2: 4.65 },
      ];
      const A = SEQ.map(({ ci }) => frontPair(cam, cars[ci]));
      cursor = track(lt, [
        [0, 440, 372],
        [0.45, ...pts[0]],
        [0.85, ...pts[1]],
        [1.25, ...pts[2]],
        [1.65, ...pts[3]],
        [2.3, 440, 372],
        [2.85, 440, 372],
        [3.12, ...A[0][0]],
        [3.52, ...A[0][1]],
        [3.95, A[0][1][0] + 36, A[0][1][1] + 34],
        [4.27, ...A[1][0]],
        [4.62, ...A[1][1]],
        [5.1, 440, 372],
        [5.8, 440, 372],
      ]);
      clicks = [0.5, 0.9, 1.3, 1.7, 3.15, 3.55, 4.3, 4.65].map((tt) => [tt, lt]);
      const hq = pts[hc];
      over += chip(hq[0] + 12, hq[1] - 18, "가려진 점?", { size: 12, h: 22, pad: 8, fill: C.paper, color: C.red, stroke: C.red, opacity: seg(lt, times[hc] + 0.1, 0.25) * red });
      SEQ.forEach(({ ci, c1, c2 }) => (over += twoPoint(cam, cars[ci], lt, c1, c2, cursor, out)));
      // 창 오른쪽 칸
      const p1 = 1 - seg(lt, 2.85, 0.2, E.in);
      const p2 = seg(lt, 2.95, 0.25);
      panel += g(
        { opacity: p1 },
        ptitle("꼭짓점 직접 입력") + row(PN.y + 44, "네 점 직접 클릭", "") + chip(PN.x, PN.y + 86, "가려진 점 짐작", { size: 12.5, fill: C.red, color: C.paper, stroke: null, opacity: seg(lt, 1.9, 0.3) }),
      );
      const now = SEQ[lt < SEQ[1].c1 - 0.15 ? 0 : 1];
      const n = (lt >= now.c1 ? 1 : 0) + (lt >= now.c2 ? 1 : 0);
      const g1 = now.c2 + 0.07 + GROW;
      const dots = [0, 1].map((i) => tag("circle", { cx: PN.x + PN.w - 34 + i * 16, cy: PN.y + 44, r: 5, fill: n > i ? C.lemon : C.paper, stroke: n > i ? C.ink : C.wire, "stroke-width": 1.6 })).join("");
      let p2s = ptitle("두 점 입력");
      p2s += row(PN.y + 44, "앞 두 점 클릭", dots);
      p2s += row(PN.y + 82, "뒤쪽 자동 생성", mark(PN.y + 82, seg(lt, g1, 0.2)));
      p2s += row(PN.y + 120, "실측 크기 표시", mark(PN.y + 120, seg(lt, g1 + 0.1, 0.2)));
      const doneN = SEQ.filter((q) => grown(lt, q.c2)).length;
      if (doneN) p2s += chip(PN.x, PN.y + 164, `하단면 ${doneN}개 완료`, { size: 12.5, fill: C.lemon });
      panel += g({ opacity: p2 }, p2s);
    }

    // ── 3장 ──
    if (t >= beats[2].at && t < beats[3].at) {
      const lt = t - beats[2].at;
      const out = 1 - seg(lt, 5.2, 0.35, E.in);
      // 문제: 차마다 두 점씩 손으로 찍는다(한 대씩이라 느리다)
      const prob = 1 - seg(lt, 2.75, 0.3, E.in);
      const HAND = [
        { j: 1, c1: 0.5, c2: 0.85 },
        { j: 2, c1: 1.5, c2: 1.85 },
      ];
      const HP = HAND.map(({ j }) => frontPair(cam, cars[LABELED[j]]));
      // 해결: 모델 예측이 사전 라벨로 한꺼번에 뜬다 → 모두 수락 → 하나만 고친다
      const accept = seg(lt, 3.95, 0.3);
      LABELED.forEach((ci, j) => {
        const car = cars[ci];
        const a = seg(lt, 2.95 + j * 0.12, 0.3) * out;
        const off = ci === FOCUS ? 1 - seg(lt, 4.55, 0.55, E.inOut) : 0;
        const at = [car.c[0] + 0.45 * off, car.c[1] - 0.35 * off];
        const yaw = car.yaw + 0.2 * off;
        over += footprint(cam, car, a * (1 - accept), { at, yaw, style: "pre" });
        over += footprint(cam, car, a * accept, { at, yaw });
      });
      over += chip(CV.x + 12, CV.y + 22, "모델 사전 라벨", { size: 12.5, fill: "#d9d2ff", opacity: seg(lt, 2.85, 0.3) * out });
      const fixed = cars[FOCUS];
      const fp = cam.P([fixed.c[0] + 0.45 * (1 - seg(lt, 4.55, 0.55, E.inOut)), fixed.c[1] - 0.35 * (1 - seg(lt, 4.55, 0.55, E.inOut)), 0]);
      over += chip(fp[0] + 52, fp[1] + 6, "수정 완료", { size: 12.5, fill: C.paper, opacity: seg(lt, 5.0, 0.25) * out });
      // 오른쪽 칸: 차마다 상태
      panel += ptitle("라벨");
      LABELED.forEach((ci, j) => {
        const y = PN.y + 44 + j * 38;
        const hand = HAND.find((q) => q.j === j);
        const done = hand ? seg(lt, hand.c2 + 0.07 + GROW, 0.2) * prob : 0;
        const pre = seg(lt, 3.0 + j * 0.12, 0.25) * (1 - accept);
        const ok = accept;
        const right =
          ring(PN.x + PN.w - 18, y, (1 - Math.max(done, pre, ok)) * 1) +
          g({ opacity: done }, tick(PN.x + PN.w - 18, y, 0.85)) +
          chip(PN.x + PN.w - 10, y, "제안", { size: 12, fill: "#d9d2ff", anchor: "end", pad: 8, h: 22, opacity: pre }) +
          g({ opacity: ok }, tick(PN.x + PN.w - 18, y, 0.85));
        panel += row(y, "차", right, 1, { swatch: cars[ci].color });
      });
      const btn = PN.y + 44 + 4 * 38 + 8;
      panel += chip(PN.x + PN.w / 2, btn, "모두 수락", { size: 13.5, anchor: "middle", fill: lt > 3.9 ? C.lemon : C.paper, h: 32, pad: 18, opacity: seg(lt, 3.1, 0.3) });
      const fx = cam.P(parts(fixed, [fixed.c[0] + 0.45, fixed.c[1] - 0.35], fixed.yaw + 0.2).body.bottom[3]);
      const fx2 = cam.P(parts(fixed).body.bottom[3]);
      cursor = track(lt, [
        [0, 440, 372],
        [0.47, ...HP[0][0]],
        [0.82, ...HP[0][1]],
        [1.2, HP[0][1][0] + 36, HP[0][1][1] + 34],
        [1.47, ...HP[1][0]],
        [1.82, ...HP[1][1]],
        [2.3, HP[1][1][0] + 36, HP[1][1][1] + 34],
        [2.8, 300, 380],
        [3.5, PN.x + PN.w / 2 + 20, btn + 4],
        [3.95, PN.x + PN.w / 2 + 20, btn + 4],
        [4.45, ...fx],
        [5.1, ...fx2],
        [5.6, ...fx2],
      ]);
      clicks = [0.5, 0.85, 1.5, 1.85, 3.9, 4.5].map((tt) => [tt, lt]);
      HAND.forEach(({ j, c1, c2 }) => (over += twoPoint(cam, cars[LABELED[j]], lt, c1, c2, cursor, prob, false)));
    }

    // ── 4장 ──
    if (t >= beats[3].at) {
      const lt = t - beats[3].at;
      // 캔버스: 라벨까지 그린 수집 장면. 내보내기에서는 모델 입력 규격(레터박스)으로 줄여 맞춘다
      st.fp = cars.map((c, i) => (LABELED.includes(i) ? 1 : 0));
      lbox = seg(lt, 3.4, 0.65, E.inOut);
      top += chip(LB.x + 10, CV.y + 17.5, "입력 규격 맞춤 · 레터박스", { size: 12, fill: C.lemon, h: 22, pad: 8, opacity: seg(lt, 3.95, 0.3) });
      // 오른쪽 칸 ①: 모은 프레임. 같은 장면이 쌓이다가 중복이 지워진다
      const swap = seg(lt, 3.25, 0.35, E.in);
      const tw = 99;
      const th = (tw * 9) / 16;
      const thumb = (i, a, mark) => {
        const x = PN.x + (i % 2) * (tw + 8);
        const y = PN.y + 30 + Math.floor(i / 2) * (th + 10);
        const id = `th${i}`;
        return g(
          { opacity: a },
          `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${tw}" height="${n2(th)}" rx="6"/></clipPath>` +
            g({ "clip-path": `url(#${id})` }, g({ transform: `translate(${x} ${y}) scale(${n2(tw / W)})` }, world({ camPos: CAM_A.pos, camTarget: CAM_A.target, fp: [] }))) +
            tag("rect", { x, y, width: tw, height: th, rx: 6, fill: "none", stroke: C.ink, "stroke-width": 1.4 }) +
            (mark || ""),
        );
      };
      const dup = seg(lt, 2.95, 0.4);
      let frames = ptitle("수집 프레임");
      for (let i = 0; i < 6; i++) {
        const a = seg(lt, 0.2 + i * 0.25, 0.25);
        const gone = i > 0 ? dup : 0;
        const x = PN.x + (i % 2) * (tw + 8) + tw / 2;
        const y = PN.y + 30 + Math.floor(i / 2) * (th + 10) + th / 2;
        frames += thumb(i, a * (1 - 0.72 * gone), gone > 0.01 ? g({ opacity: gone }, cross(x, y, 1.3)) : "");
      }
      frames += chip(PN.x + PN.w, PN.y + 12, "중복 누적", { size: 12, fill: C.red, color: C.paper, stroke: null, anchor: "end", h: 22, pad: 8, opacity: seg(lt, 1.85, 0.3) * (1 - seg(lt, 2.75, 0.25, E.in)) });
      frames += chip(PN.x + PN.w, PN.y + 12, "중복 제거", { size: 12, fill: C.paper, anchor: "end", h: 22, pad: 8, opacity: seg(lt, 3.0, 0.3) });
      // 학습 세트는 손으로 꾸린다
      const yS = PN.y + 30 + 3 * (th + 10) + 12;
      frames += g(
        { opacity: seg(lt, 2.05, 0.3) * (1 - seg(lt, 2.75, 0.25, E.in)) },
        tag("rect", { x: PN.x, y: yS - 16, width: PN.w, height: 32, rx: 9, fill: "none", stroke: C.wire, "stroke-width": 1.5, "stroke-dasharray": "5 4" }) +
          text(PN.x + 12, yS + 0.5, "학습 세트 정리", { "font-size": 14.5, "font-weight": 700, fill: C.sub }) +
          chip(PN.x + PN.w - 8, yS, "수작업", { size: 12, fill: C.paper, color: C.red, stroke: C.red, anchor: "end", h: 22, pad: 8 }),
      );
      panel += g({ opacity: 1 - swap }, frames);
      // 오른쪽 칸 ②: 내보낸 학습 세트. 버전마다 입력 규격·라벨·프레임 목록을 남긴다
      let sets = ptitle("학습 세트");
      let vx = PN.x;
      ["v1", "v2", "v3"].forEach((v, i) => {
        const o = { size: 13, pad: 11, h: 26 };
        sets += chip(vx, PN.y + 46, v, { ...o, fill: i === 2 ? C.lemon : C.paper, opacity: seg(lt, 3.5 + i * 0.12, 0.25) });
        vx += chip.width(v, o) + 6;
      });
      ["입력 규격", "라벨", "프레임 목록"].forEach((l, i) => {
        const y = PN.y + 90 + i * 38;
        sets += row(y, l, tick(PN.x + PN.w - 18, y, 0.85), seg(lt, 3.8 + i * 0.13, 0.25));
      });
      sets += chip(PN.x, PN.y + 90 + 3 * 38 + 4, "버전 기록", { size: 12.5, fill: C.lemon, opacity: seg(lt, 4.3, 0.3) });
      panel += g({ opacity: swap }, sets);
      cursor = null;
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
    let view = world(st, VIEW);
    if (lbox > 0.001) {
      // 장면을 4:3 입력 폭에 맞춰 줄이고, 위아래 빈 곳은 회색 레터박스, 입력 밖 양옆은 비운다
      const cx = CV.x + CV.w / 2;
      const cy = CV.y + CV.h / 2;
      const sc = lerp(1, LB.s, lbox);
      view =
        `<clipPath id="cvimg"><rect x="${CV.x}" y="${CV.y}" width="${CV.w}" height="${CV.h}"/></clipPath>` +
        tag("rect", { x: CV.x, y: CV.y, width: CV.w, height: CV.h, fill: "#8f8e86" }) +
        g({ transform: `translate(${n2(cx)} ${n2(cy)}) scale(${n2(sc)}) translate(${n2(-cx)} ${n2(-cy)})` }, g({ "clip-path": "url(#cvimg)" }, view)) +
        tag("rect", { x: CV.x, y: CV.y, width: LB.x - CV.x, height: CV.h, fill: C.mute, opacity: lbox }) +
        tag("rect", { x: LB.x + LB.w, y: CV.y, width: CV.x + CV.w - LB.x - LB.w, height: CV.h, fill: C.mute, opacity: lbox }) +
        tag("rect", { x: LB.x, y: CV.y + 1, width: LB.w, height: CV.h - 2, fill: "none", stroke: C.ink, "stroke-width": 1.5, "stroke-dasharray": "6 4", opacity: lbox });
    }
    s += g({ "clip-path": "url(#cv)" }, view);
    s += tag("rect", { x: CV.x, y: CV.y, width: CV.w, height: CV.h, rx: 9, fill: "none", stroke: C.ink, "stroke-width": 1.5 });
    s += top;
    s += panel;
    if (cursor) {
      for (const [tt, lt] of clicks) s += ripple(cursor[0], cursor[1], (lt - tt) / 0.45);
      s += pointer(cursor[0], cursor[1], { opacity: t >= beats[3].at ? 0 : 1 });
    }
    return s;
  }

  return { beats, duration, draw, bg: BG, poster: 5.2 };
})();
