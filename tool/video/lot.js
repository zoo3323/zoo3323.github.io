// 높이 단 CCTV 로 본 주차 줄. 2.5D 하단면 검출과 라벨링 도구 영상이 함께 쓴다.
// 차는 차체·지붕 두 상자, 하단면(footprint)은 차체 상자의 바닥 사각형이다.
"use strict";
const hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mixColor = (a, b, u) => `rgb(${hexRGB(a).map((v, i) => Math.round(lerp(v, hexRGB(b)[i], u))).join(",")})`;

function makeLot(opt) {
  const { bg, cam: CAM, focus: FOCUS } = opt;
  const SP = opt.sp ?? 2.6; // 주차면 폭
  const DEPTH = opt.depth ?? 5.2; // 주차면 깊이
  const FIRST = opt.first ?? -3; // 그리는 주차면(화면 밖까지 이어 그린다)
  const LAST = opt.last ?? 10;
  const L = 4.5; // 차 길이
  const B = 1.85; // 차 폭
  const cars = opt.cars.map((c) => ({ ...c, c: [SP * (c.space + 0.5) + (c.dx || 0), DEPTH / 2 + (c.dy || 0)] }));
  const occupied = (i) => cars.some((c) => c.space === i);

  function parts(car, at = car.c, yaw = car.yaw) {
    const body = boxCorners(at, yaw, L, B, 0, 0.74);
    const back = [at[0] - Math.sin(yaw) * 0.3, at[1] - Math.cos(yaw) * 0.3];
    const cabin = boxCorners(back, yaw, 2.4, 1.56, 0.74, 0.58);
    return { body, cabin };
  }

  // view = { cx, cy, s }: 화면 안 어디에 얼마나 크게 그릴지. st.zoom 이면 FOCUS 차로 다가간다
  function makeCam(st = {}, view = {}) {
    const k = st.k || 0;
    const s0 = view.s ?? 1;
    const base = camera({ pos: st.camPos || CAM.pos, target: st.camTarget || CAM.target, f: CAM.f * s0 * (1 + 0.34 * k), cx: view.cx ?? CAM.cx, cy: view.cy ?? CAM.cy, k: 0.92 * k });
    if (!st.zoom) return base;
    const pc = base.P([...cars[FOCUS].c, 0.4]);
    const s = 1 + 0.62 * st.zoom;
    const to = [lerp(pc[0], view.zx ?? 404, st.zoom), lerp(pc[1], view.zy ?? 262, st.zoom)];
    const P = (p) => {
      const q = base.P(p);
      return [to[0] + s * (q[0] - pc[0]), to[1] + s * (q[1] - pc[1])];
    };
    const line = (a, b, n = 1) => Array.from({ length: n + 1 }, (_, i) => P(v3.lerp(a, b, i / n)));
    const poly = (ps, n = 1) => ps.flatMap((p, i) => line(p, ps[(i + 1) % ps.length], n).slice(0, -1));
    return { P, line, poly, pos: base.pos, k: 0 };
  }

  const spaceQuad = (i, inset = 0) => [
    [SP * i + inset, inset, 0],
    [SP * (i + 1) - inset, inset, 0],
    [SP * (i + 1) - inset, DEPTH - inset, 0],
    [SP * i + inset, DEPTH - inset, 0],
  ];

  function drawCar(cam, car) {
    const { body, cabin } = parts(car);
    let s = "";
    for (const [box, glass] of [
      [body, false],
      [cabin, true],
    ]) {
      for (const f of boxFaces(cam, box, car.color)) {
        if (!f.vis) continue;
        const fill = glass && f.side !== "top" ? shade("#aebdcb", f.fill === car.color ? 1 : 0.96) : f.fill;
        s += tag("path", { d: dpath(cam.poly(f.quad)), fill, stroke: C.ink, "stroke-width": 1.6, "stroke-linejoin": "round" });
      }
    }
    return s;
  }

  // 하단면: 보이는 옆면의 아래 변은 실선, 가려진 변은 점선. style "pre" 는 모델이 낸 사전 라벨(연보라 점선)
  function footprint(cam, car, a, o = {}) {
    if (a <= 0.002) return "";
    const { body } = parts(car, o.at || car.c, o.yaw ?? car.yaw);
    const faces = boxFaces(cam, body, car.color);
    const ring = body.bottom;
    const pre = o.style === "pre";
    let s = tag("path", { d: dpath(cam.poly(ring)), fill: pre ? "#b9adff" : o.fill || C.lemon, opacity: (pre ? 0.42 : 0.62) * a });
    for (let i = 0; i < 4; i++) {
      const d = dpath(cam.line(ring[i], ring[(i + 1) % 4]), false);
      const dash = pre ? "6 4" : faces[i].vis ? undefined : "5 5";
      s += tag("path", { d, fill: "none", stroke: pre ? "#4b3fb8" : o.stroke || C.ink, "stroke-width": 2.4, "stroke-linecap": "round", "stroke-dasharray": dash, opacity: a });
    }
    if (o.dots) for (const p of ring) s += tag("circle", { cx: cam.P(p)[0], cy: cam.P(p)[1], r: 3.6, fill: C.paper, stroke: C.ink, "stroke-width": 2, opacity: a * o.dots });
    return s;
  }

  function hiddenCorner(cam, car) {
    const faces = boxFaces(cam, parts(car).body, car.color);
    // 두 옆면(i-1, i)이 모두 안 보이는 꼭짓점
    for (let i = 0; i < 4; i++) if (!faces[i].vis && !faces[(i + 3) % 4].vis) return i;
    return 2;
  }

  function bbox2d(cam, car) {
    const { body, cabin } = parts(car);
    const ps = [...body.bottom, ...body.top, ...cabin.top].map(cam.P);
    const xs = ps.map((p) => p[0]);
    const ys = ps.map((p) => p[1]);
    return [Math.min(...xs) - 3, Math.min(...ys) - 3, Math.max(...xs) + 3, Math.max(...ys) + 3];
  }

  // 주차장 한 장면. st = { k: 왜곡, zoom, tint: [[색, 진하기]...](주차면 번호), fp: [하단면 진하기...](차 순서), fpStyle, box2d: [그린 몫, 진하기], grid, extra(cam) }
  function world(st, view = {}) {
    const cam = makeCam(st, view);
    let s = tag("rect", { x: -40, y: -40, width: W + 80, height: H + 80, fill: bg });
    // 뒤쪽 화단 띠: 주차 줄 끝을 알려 준다
    const x0 = FIRST * SP;
    const x1 = (LAST + 1) * SP;
    s += tag("path", { d: dpath(cam.poly([[x0, DEPTH + 0.6, 0], [x1, DEPTH + 0.6, 0], [x1, DEPTH + 3.4, 0], [x0, DEPTH + 3.4, 0]], cam.k ? 40 : 1)), fill: "#cbd8c4" });
    // 앞쪽 통로의 가운데 점선
    s += tag("path", { d: dpath(cam.line([x0, -4.2, 0], [x1, -4.2, 0], cam.k ? 60 : 1), false), fill: "none", stroke: "#ffffff", "stroke-width": 3, "stroke-dasharray": "14 12", opacity: 0.9 });
    (st.tint || []).forEach((tn, i) => {
      if (tn && tn[1] > 0.002) s += tag("path", { d: dpath(cam.poly(spaceQuad(i, 0.16))), fill: tn[0], opacity: tn[1] });
    });
    let lines = "";
    for (let i = FIRST; i <= LAST + 1; i++) lines += dpath(cam.line([i * SP, 0, 0], [i * SP, DEPTH, 0]), false);
    lines += dpath(cam.line([x0, DEPTH, 0], [x1, DEPTH, 0], cam.k ? 60 : 1), false);
    s += tag("path", { d: lines, fill: "none", stroke: "#ffffff", "stroke-width": 4.5, "stroke-linecap": "round" });
    // 보정한 바닥에 올린 격자(2.5 m)
    if (st.grid > 0.002) {
      let gl = "";
      for (let x = -5; x <= 30; x += 2.5) gl += dpath(cam.line([x, -6, 0], [x, DEPTH + 0.5, 0]), false);
      for (let y = -5; y <= DEPTH; y += 2.5) gl += dpath(cam.line([x0, y, 0], [x1, y, 0]), false);
      s += tag("path", { d: gl, fill: "none", stroke: "#3d5a80", "stroke-width": 1.2, opacity: 0.55 * st.grid });
    }
    const order = cars.map((c, i) => i).sort((a, b) => Math.hypot(...v3.sub([...cars[b].c, 0], cam.pos)) - Math.hypot(...v3.sub([...cars[a].c, 0], cam.pos)));
    for (const i of order) s += drawCar(cam, cars[i]);
    cars.forEach((car, i) => {
      s += footprint(cam, car, (st.fp || [])[i] || 0, { dots: i === FOCUS ? st.dots || 0 : 0, style: (st.fpStyle || [])[i] });
    });
    if (st.box2d && st.box2d[1] > 0.002) {
      const [bx0, by0, bx1, by1] = bbox2d(cam, cars[FOCUS]);
      s += drawOn(`M${bx0} ${by0}H${bx1}V${by1}H${bx0}Z`, st.box2d[0], { stroke: C.red, "stroke-width": 3, opacity: st.box2d[1] });
    }
    if (st.extra) s += st.extra(cam);
    return s;
  }

  const spaceChip = (cam, i, label, fill, color, a) => {
    const p = cam.P([SP * (i + 0.5), -0.75, 0]);
    return chip(p[0], p[1], label, { size: 12.5, fill, color, stroke: fill === C.paper ? C.red : null, opacity: a });
  };

  return { bg, SP, DEPTH, cars, FOCUS, occupied, parts, makeCam, spaceQuad, drawCar, footprint, hiddenCorner, bbox2d, world, spaceChip };
}
