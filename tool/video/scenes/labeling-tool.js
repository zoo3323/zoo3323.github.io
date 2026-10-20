// 라벨링 도구: 도구 창 안에 같은 주차장 카메라 화면. 세 장(손으로 찍기 → 보정·차급 프리셋, 다 그리기 → 모델 사전 라벨, 같은 장면·어긋남 → 중복 제거·자동 재정렬)
"use strict";
window.SCENE = (() => {
  const BG = "#d6ecff";
  const lot = makeLot({
    bg: "#dfe7ee",
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
  const { cars, FOCUS, parts, footprint, hiddenCorner, world, makeCam, SP, DEPTH } = lot;
  const LABELED = [2, 3, 4, 5]; // 창 안에 온전히 보이는 차
  const beats = [
    { at: 0, solve: 2.9 },
    { at: 5.8, solve: 2.7 },
    { at: 11.4, solve: 2.8 },
  ];
  const duration = 17;
  const WIN = { x: 28, y: 80, w: 744, h: 354 };
  const CV = { x: 42, y: 126, w: 494, h: 278 };
  const PN = { x: 552, y: 126, w: 206 };
  const VIEW = { cx: 262, cy: 318, s: 0.93 };
  const CAM_A = { pos: [6.2, -8.4, 9.4], target: [9.4, 2.7, 0] };
  const CAM_B = { pos: [8.6, -7.6, 8.6], target: [10.2, 3.1, 0] }; // 카메라 각도가 바뀐 뒤

  // ── 창 ──
  const TABS = ["수집", "보정", "라벨", "내보내기"];
  const SWITCH = [
    [0, 2],
    [2.95, 1],
    [4.3, 2],
    [11.4, 0],
    [14.7, 1],
    [15.9, 2],
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
      tag("rect", { x: PN.x, y: y - 16, width: PN.w, height: 32, rx: 9, fill: o.fill || C.mute }) +
        (o.swatch ? tag("rect", { x: PN.x + 10, y: y - 7, width: 22, height: 14, rx: 4, fill: o.swatch, stroke: C.ink, "stroke-width": 1.4 }) : "") +
        text(PN.x + (o.swatch ? 42 : 12), y + 0.5, label, { "font-size": 14.5, "font-weight": 700, fill: C.ink }) +
        (right || ""),
    );
  const ring = (x, y, a = 1) => tag("circle", { cx: x, cy: y, r: 7, fill: C.paper, stroke: C.wire, "stroke-width": 1.6, opacity: a });

  // 손으로 찍은 꼭짓점: 가려진 꼭짓점일수록 크게 빗나간다
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

  // 바닥 위 차급 프리셋이 차 밑으로 미끄러져 들어간다
  const presetAt = (car, u) => ({ at: [car.c[0] - 1.6 * (1 - u), car.c[1] - 3.4 * (1 - u)], yaw: car.yaw + 0.55 * (1 - u) });

  function draw(t) {
    const camState = { camPos: CAM_A.pos, camTarget: CAM_A.target };
    // 3장: 카메라 각도가 바뀐다
    if (t >= beats[2].at) {
      const m = seg(t, beats[2].at + 1.35, 0.85, E.inOut);
      camState.camPos = v3.lerp(CAM_A.pos, CAM_B.pos, m);
      camState.camTarget = v3.lerp(CAM_A.target, CAM_B.target, m);
    }
    const st = { ...camState, fp: [], fpStyle: [], tint: [], grid: 0 };
    const cam = makeCam(st, VIEW);
    const camA = makeCam({ camPos: CAM_A.pos, camTarget: CAM_A.target }, VIEW);
    let over = "";
    let panel = "";
    let cursor = null;
    let clicks = [];

    // ── 1장 ──
    if (t < beats[1].at) {
      const lt = t;
      const out = 1 - seg(lt, 5.4, 0.3, E.in);
      const red = 1 - seg(lt, 2.95, 0.3, E.in);
      const car = cars[FOCUS];
      const pts = clicked(cam, car, [-30, 20]);
      const times = [0.5, 0.9, 1.3, 1.7];
      // 찍은 점과 그 점을 이은 사각형(빨강)
      const shown = times.filter((tt) => lt >= tt).length;
      if (shown) {
        const poly = pts.slice(0, shown);
        const closed = shown === 4;
        over += tag("path", { d: dpath(poly, closed), fill: closed ? C.red : "none", "fill-opacity": 0.14, stroke: C.red, "stroke-width": 2.4, "stroke-linejoin": "round", opacity: red });
        poly.forEach((q) => (over += tag("circle", { cx: q[0], cy: q[1], r: 4.2, fill: C.red, stroke: C.paper, "stroke-width": 1.5, opacity: red })));
      }
      const other = clicked(cam, cars[3], [24, -16]);
      over += g({ opacity: seg(lt, 2.0, 0.3) * red }, tag("path", { d: dpath(other), fill: C.red, "fill-opacity": 0.14, stroke: C.red, "stroke-width": 2.4, "stroke-linejoin": "round" }));
      // 보정: 바닥 선을 따라 그은 가로선(초록)·세로선(주황), 그리고 바닥 격자
      const cal = 1 - seg(lt, 4.35, 0.35, E.in);
      const lineOn = (a, b, u, color) => drawOn(dpath(cam.line(a, b), false), u, { stroke: color, "stroke-width": 3.2, opacity: cal });
      over += lineOn([SP * 2, DEPTH, 0], [SP * 6, DEPTH, 0], seg(lt, 3.0, 0.55, E.inOut), "#16a34a");
      over += lineOn([SP * 2, 0, 0], [SP * 6, 0, 0], seg(lt, 3.2, 0.5, E.inOut), "#16a34a");
      over += lineOn([SP * 3, 0, 0], [SP * 3, DEPTH, 0], seg(lt, 3.35, 0.4, E.inOut), "#f97316");
      over += lineOn([SP * 5, 0, 0], [SP * 5, DEPTH, 0], seg(lt, 3.45, 0.4, E.inOut), "#f97316");
      st.grid = seg(lt, 3.55, 0.5) * out;
      // 차급 프리셋(중형)을 바닥에 놓고 차 밑으로 끈다
      const pu = seg(lt, 4.75, 0.6, E.inOut);
      const pa = seg(lt, 4.62, 0.15) * out;
      const pr = presetAt(car, pu);
      over += footprint(cam, car, pa, { at: pr.at, yaw: pr.yaw });
      // 창 오른쪽 칸
      const p1 = 1 - seg(lt, 2.85, 0.2, E.in);
      const p2 = seg(lt, 2.95, 0.25) * (1 - seg(lt, 4.2, 0.2, E.in));
      const p3 = seg(lt, 4.3, 0.25);
      panel += g({ opacity: p1 }, ptitle("꼭짓점 찍기") + row(PN.y + 44, "네 점을 하나씩", "", 1) + chip(PN.x, PN.y + 86, "크기·방향 제각각", { size: 12.5, fill: C.red, color: C.paper, stroke: null, opacity: seg(lt, 2.15, 0.3) }));
      panel += g(
        { opacity: p2 },
        ptitle("카메라 보정") +
          ["초점거리", "카메라 높이", "좌우 기울기"].map((l, i) => row(PN.y + 44 + i * 38, l, tick(PN.x + PN.w - 18, PN.y + 44 + i * 38, 0.85), seg(lt, 3.35 + i * 0.15, 0.25))).join(""),
      );
      panel += g(
        { opacity: p3 },
        ptitle("차급 프리셋") +
          ["경차", "소형", "중형", "대형"].map((l, i) => row(PN.y + 44 + i * 38, l, "", 1, { fill: l === "중형" && lt > 4.45 ? C.lemon : C.mute })).join(""),
      );
      // 커서
      cursor = track(lt, [
        [0, 330, 380],
        [0.42, ...pts[0]],
        [0.82, ...pts[1]],
        [1.22, ...pts[2]],
        [1.62, ...pts[3]],
        [2.3, 440, 372],
        [2.95, 440, 372],
        [3.05, ...cam.P([SP * 2, DEPTH, 0])],
        [3.55, ...cam.P([SP * 6, DEPTH, 0])],
        [4.3, PN.x + 150, PN.y + 44 + 2 * 38],
        [4.6, PN.x + 150, PN.y + 44 + 2 * 38],
        [4.75, ...cam.P([...presetAt(car, 0).at, 0])],
        [5.35, ...cam.P([...presetAt(car, 1).at, 0])],
        [5.8, ...cam.P([...presetAt(car, 1).at, 0])],
      ]);
      clicks = [0.5, 0.9, 1.3, 1.7, 4.5].map((tt) => [tt, lt]);
    }

    // ── 2장 ──
    if (t >= beats[1].at && t < beats[2].at) {
      const lt = t - beats[1].at;
      const out = 1 - seg(lt, 5.2, 0.35, E.in);
      // 문제: 한 대씩 꼭짓점을 찍는다(느리다)
      const slow = cars[3];
      const sp = parts(slow).body.bottom.map(cam.P);
      const times = [0.5, 1.05, 1.6, 2.15];
      const shown = times.filter((tt) => lt >= tt).length;
      const prob = 1 - seg(lt, 2.75, 0.3, E.in);
      if (shown) {
        const poly = sp.slice(0, shown);
        over += tag("path", { d: dpath(poly, shown === 4), fill: shown === 4 ? C.lemon : "none", "fill-opacity": 0.55, stroke: C.ink, "stroke-width": 2.4, "stroke-linejoin": "round", opacity: prob });
        poly.forEach((q) => (over += tag("circle", { cx: q[0], cy: q[1], r: 3.8, fill: C.paper, stroke: C.ink, "stroke-width": 1.8, opacity: prob })));
      }
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
      over += chip(fp[0] + 52, fp[1] + 6, "고침", { size: 12.5, fill: C.paper, opacity: seg(lt, 5.0, 0.25) * out });
      // 오른쪽 칸: 차마다 상태
      panel += ptitle("라벨");
      LABELED.forEach((ci, j) => {
        const y = PN.y + 44 + j * 38;
        const done = j === 0 ? seg(lt, 2.25, 0.2) * prob : 0;
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
        [0.45, ...sp[0]],
        [1.0, ...sp[1]],
        [1.55, ...sp[2]],
        [2.1, ...sp[3]],
        [2.8, 300, 380],
        [3.5, PN.x + PN.w / 2 + 20, btn + 4],
        [3.95, PN.x + PN.w / 2 + 20, btn + 4],
        [4.45, ...fx],
        [5.1, ...fx2],
        [5.6, ...fx2],
      ]);
      clicks = [0.5, 1.05, 1.6, 2.15, 3.9, 4.5].map((tt) => [tt, lt]);
    }

    // ── 3장 ──
    if (t >= beats[2].at) {
      const lt = t - beats[2].at;
      const realign = seg(lt, 3.6, 0.7, E.inOut);
      const bad = seg(lt, 2.2, 0.3) * (1 - realign);
      // 라벨은 예전 카메라 자리에 남아 있다가(어긋남) 새 보정으로 다시 맞춰진다
      LABELED.forEach((ci) => {
        const rg = parts(cars[ci]).body.bottom;
        const ps = rg.map((p) => mix2(camA.P(p), cam.P(p), realign));
        over += tag("path", { d: dpath(ps), fill: C.lemon, opacity: 0.6 * (1 - bad) + 0.15 * bad });
        over += tag("path", { d: dpath(ps), fill: "none", stroke: bad > 0.5 ? C.red : C.ink, "stroke-width": 2.4, "stroke-linejoin": "round" });
      });
      over += chip(CV.x + 12, CV.y + 22, "어긋남", { size: 12.5, fill: C.red, color: C.paper, stroke: null, opacity: seg(lt, 2.3, 0.25) * (1 - seg(lt, 3.55, 0.25, E.in)) });
      over += chip(CV.x + 12, CV.y + 22, "자동 재정렬", { size: 12.5, fill: C.lemon, opacity: seg(lt, 4.3, 0.3) });
      // 오른쪽 칸: 모은 프레임. 같은 장면이 쌓이다가, 각도가 바뀐 장면이 들어온다
      panel += ptitle("모은 프레임");
      const tw = 99;
      const th = (tw * 9) / 16;
      const thumb = (i, a, camS, mark) => {
        const x = PN.x + (i % 2) * (tw + 8);
        const y = PN.y + 30 + Math.floor(i / 2) * (th + 10);
        const id = `th${i}`;
        return g(
          { opacity: a },
          `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${tw}" height="${n2(th)}" rx="6"/></clipPath>` +
            g({ "clip-path": `url(#${id})` }, g({ transform: `translate(${x} ${y}) scale(${n2(tw / W)})` }, world({ ...camS, fp: [] }))) +
            tag("rect", { x, y, width: tw, height: th, rx: 6, fill: "none", stroke: C.ink, "stroke-width": 1.4 }) +
            (mark || ""),
        );
      };
      const dup = seg(lt, 2.95, 0.4);
      for (let i = 0; i < 4; i++) {
        const a = seg(lt, 0.2 + i * 0.3, 0.25);
        const gone = i > 0 ? dup : 0;
        const x = PN.x + (i % 2) * (tw + 8) + tw / 2;
        const y = PN.y + 30 + Math.floor(i / 2) * (th + 10) + th / 2;
        panel += thumb(i, a * (1 - 0.72 * gone), { camPos: CAM_A.pos, camTarget: CAM_A.target }, gone > 0.01 ? g({ opacity: gone }, cross(x, y, 1.3)) : "");
      }
      panel += thumb(4, seg(lt, 2.25, 0.3), { camPos: CAM_B.pos, camTarget: CAM_B.target }, "");
      const y4 = PN.y + 30 + 2 * (th + 10) + th + 16;
      panel += chip(PN.x, y4, "각도 변경 감지", { size: 12, fill: C.lemon, h: 22, pad: 8, opacity: seg(lt, 3.1, 0.3) });
      panel += chip(PN.x + PN.w, PN.y + 12, "중복 제거", { size: 12, fill: C.paper, anchor: "end", h: 22, pad: 8, opacity: seg(lt, 3.2, 0.3) });
      cursor = null;
    }

    // ── 그리기 ──
    let s = tag("rect", { x: 0, y: 0, width: W, height: H, fill: BG });
    s += card(WIN.x, WIN.y, WIN.w, WIN.h);
    s += text(WIN.x + 18, WIN.y + 17.5, "라벨링 도구", { "font-size": 14.5, "font-weight": 700, fill: C.ink });
    s += tabs(t);
    s += tag("path", { d: `M${WIN.x + 2} ${WIN.y + 34}H${WIN.x + WIN.w - 2}`, stroke: C.rule, "stroke-width": 1.5 });
    s += `<clipPath id="cv"><rect x="${CV.x}" y="${CV.y}" width="${CV.w}" height="${CV.h}" rx="9"/></clipPath>`;
    st.extra = () => over;
    s += g({ "clip-path": "url(#cv)" }, world(st, VIEW));
    s += tag("rect", { x: CV.x, y: CV.y, width: CV.w, height: CV.h, rx: 9, fill: "none", stroke: C.ink, "stroke-width": 1.5 });
    s += panel;
    if (cursor) {
      for (const [tt, lt] of clicks) s += ripple(cursor[0], cursor[1], (lt - tt) / 0.45);
      s += pointer(cursor[0], cursor[1], { opacity: t >= beats[2].at ? 0 : 1 });
    }
    return s;
  }

  return { beats, duration, draw, bg: BG, poster: 5.5 };
})();
