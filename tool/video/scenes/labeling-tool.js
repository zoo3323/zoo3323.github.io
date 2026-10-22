// 라벨링 도구: 도구 창 안에 같은 주차장 카메라 화면. 세 장(짐작한 바닥 격자가 어긋남 → 주차면 직선·직각·2.5×5 m 로 보정, 다 그리기 → 모델 사전 라벨, 같은 장면·손으로 꾸리는 학습 세트 → 중복 제거·규격 맞춤 내보내기·버전 기록)
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
  const { cars, FOCUS, parts, footprint, world, makeCam, spaceQuad, SP, DEPTH } = lot;
  const LABELED = [2, 3, 4, 5]; // 창 안에 온전히 보이는 차
  const beats = [
    { at: 0, solve: 2.9 },
    { at: 5.8, solve: 2.7 },
    { at: 11.4, solve: 2.8 },
  ];
  const duration = 17.6;
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
    [11.4, 0],
    [14.75, 3],
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

  function draw(t) {
    const st = { camPos: CAM_A.pos, camTarget: CAM_A.target, fp: [], fpStyle: [], tint: [], grid: 0 };
    const cam = makeCam(st, VIEW);
    let over = "";
    let under = ""; // 차 아래 바닥에 까는 그림(칸 칠·직각·치수선)
    let top = ""; // 캔버스 위(레터박스와 함께 줄지 않는) 딱지
    let lbox = 0; // 3장 내보내기: 레터박스로 줄여 넣은 정도
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
      over += chip(fp[0] + 52, fp[1] + 6, "수정 완료", { size: 12.5, fill: C.paper, opacity: seg(lt, 5.0, 0.25) * out });
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
      s += pointer(cursor[0], cursor[1], { opacity: t >= beats[2].at ? 0 : 1 });
    }
    return s;
  }

  return { beats, duration, draw, bg: BG, poster: 5.2 };
})();
