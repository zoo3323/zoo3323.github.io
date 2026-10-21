// 노인보호구역 입지 분석: 지도 한 장. 세 장(흩어진 노인 시설·사고 데이터 → 시설 가중치를 넣은 사고 핫스폿, 전역 회귀 → GWR, 근거 필요 → 위험도 지도·보고서)
// 지명은 쓰지 않는다(가·나·다·라 지역). 지도는 도식이다.
"use strict";
window.SCENE = (() => {
  const BG = "#ece7df";
  const INK2 = "#2d2a24";
  const beats = [
    { at: 0, solve: 2.8 },
    { at: 5.9, solve: 2.8 },
    { at: 11.8, solve: 2.7 },
  ];
  const duration = 17.8;
  const M = { x: 40, y: 88, w: 480, h: 336 }; // 지도 칸
  const P = { x: 540, y: 88, w: 220, h: 336 }; // 오른쪽 칸
  const at = (p) => [M.x + p[0], M.y + p[1]];

  // 길(지도 안 좌표)
  const ROADS = [
    { main: true, pts: [[0, 150], [120, 156], [240, 150], [360, 140], [480, 132]] },
    { main: true, pts: [[250, 0], [246, 120], [240, 150], [236, 260], [232, 336]] },
    { main: true, pts: [[20, 336], [140, 240], [240, 150], [340, 80], [430, 0]] },
    { main: false, pts: [[0, 262], [120, 262], [236, 260], [360, 256], [480, 250]] },
    { main: false, pts: [[110, 0], [116, 150], [120, 262], [126, 336]] },
    { main: false, pts: [[380, 0], [372, 136], [360, 256], [352, 336]] },
  ];
  const RIVER_TOP = [[0, 36], [120, 54], [240, 62], [360, 68], [480, 84]];
  // 사고 지점: 큰 교차로 두 곳에 몰리고, 나머지는 흩어진다(고정된 의사 난수)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ACC = [];
  const around = (cx, cy, n, r) => {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const d = r * Math.sqrt(rnd());
      ACC.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]);
    }
  };
  around(240, 150, 12, 30);
  around(360, 254, 8, 24);
  around(140, 240, 5, 20);
  [[60, 300], [430, 120], [300, 300], [70, 200], [190, 90]].forEach((p) => ACC.push(p));
  // 노인 시설(모은 시설 데이터). 시설이 모인 곳일수록 보호구역 가중치가 크다
  const FAC = [
    [212, 126],
    [268, 178],
    [336, 232],
    [386, 278],
    [160, 220],
    [82, 104],
    [420, 190],
    [196, 302],
    [440, 300],
    [330, 110],
  ];
  const facW = (x, y) => FAC.reduce((s, [fx, fy]) => s + Math.exp(-((x - fx) ** 2 + (y - fy) ** 2) / (2 * 40 * 40)), 0);
  const FMAX = Math.max(...FAC.map(([x, y]) => facW(x, y)));
  // 사고 밀도에 시설 가중치를 곱한 위험 점수(핫스폿)
  const density = (x, y) => ACC.reduce((s, [ax, ay]) => s + Math.exp(-((x - ax) ** 2 + (y - ay) ** 2) / (2 * 26 * 26)), 0);
  const score = (x, y) => density(x, y) * (0.35 + 0.65 * Math.min(1, facW(x, y) / FMAX));
  const HEX = [];
  {
    const r = 17;
    const hw = Math.sqrt(3) * r;
    for (let row = 0; row * r * 1.5 < M.h + r; row++)
      for (let col = 0; col * hw < M.w + hw; col++) {
        const x = col * hw + (row % 2 ? hw / 2 : 0);
        const y = row * r * 1.5;
        HEX.push({ x, y, r, d: score(x, y) });
      }
    const max = Math.max(...HEX.map((h) => h.d));
    HEX.forEach((h) => (h.v = h.d / max));
  }
  const hexPath = (h) =>
    dpath(
      Array.from({ length: 6 }, (_, i) => {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        return at([h.x + h.r * Math.cos(a), h.y + h.r * Math.sin(a)]);
      }),
    );
  // 행정 구역 넷(길을 경계로)
  const DIST = [
    { name: "가 지역", pts: [[0, 0], [250, 0], [246, 120], [240, 150], [120, 156], [0, 150]], gwr: 0.28 },
    { name: "나 지역", pts: [[250, 0], [480, 0], [480, 132], [360, 140], [240, 150], [246, 120]], gwr: 0.72 },
    { name: "다 지역", pts: [[0, 150], [120, 156], [240, 150], [236, 260], [232, 336], [0, 336]], gwr: 0.5 },
    { name: "라 지역", pts: [[240, 150], [360, 140], [480, 132], [480, 336], [232, 336], [236, 260]], gwr: 0.95 },
  ];
  const lilacScale = (v) => mixColor("#f4f1ff", "#9d8cf0", v);
  // 길마다 잘게 나눠, 조각마다 위험 점수로 위험도를 칠한다
  const DMAX = Math.max(...HEX.map((h) => h.d));
  const RISK = ROADS.map((r) => {
    const out = [];
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i];
      const b = r.pts[i + 1];
      const n = 6;
      for (let k = 0; k < n; k++) {
        const p0 = mix2(a, b, k / n);
        const p1 = mix2(a, b, (k + 1) / n);
        const v = score((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2) / DMAX;
        out.push({ p0, p1, color: v > 0.42 ? "#ef4444" : v > 0.12 ? "#3b82f6" : "#22c55e" });
      }
    }
    return out;
  });

  function base(o = {}) {
    let s = card(M.x - 2, M.y - 2, M.w + 4, M.h + 4, { rx: 12 });
    s += `<clipPath id="map"><rect x="${M.x}" y="${M.y}" width="${M.w}" height="${M.h}" rx="11"/></clipPath>`;
    let m = tag("rect", { x: M.x, y: M.y, width: M.w, height: M.h, fill: "#f7f4ec" });
    // 구역 색(GWR)
    if (o.dist) DIST.forEach((d, i) => (m += tag("path", { d: dpath(d.pts.map(at)), fill: lilacScale(o.dist[i]), opacity: 0.9 * (o.distA ?? 1) })));
    // 강
    m += tag("path", { d: dpath([...RIVER_TOP.map(at), ...RIVER_TOP.slice().reverse().map((p) => at([p[0], p[1] + 24]))]), fill: "#cfe3f3" });
    // 길 아래에 까는 층(시설 가중치)
    if (o.under) m += o.under;
    // 핫스폿 육각 칸
    if (o.hex > 0.002)
      HEX.forEach((h, i) => {
        if (h.v < 0.3) return;
        const a = seg(o.hexT ?? 1, (i % 7) * 0.03, 0.5) * o.hex;
        m += tag("path", { d: hexPath(h), fill: h.v > 0.62 ? "#ef4444" : "#fb923c", opacity: (0.25 + 0.5 * h.v) * a, stroke: "#ffffff", "stroke-width": 1 });
      });
    // 길
    ROADS.forEach((r) => {
      const d = dpath(r.pts.map(at), false);
      m += tag("path", { d, fill: "none", stroke: "#c9c4b6", "stroke-width": r.main ? 10 : 7, "stroke-linecap": "round", "stroke-linejoin": "round" });
      m += tag("path", { d, fill: "none", stroke: "#ffffff", "stroke-width": r.main ? 7 : 4.5, "stroke-linecap": "round", "stroke-linejoin": "round" });
    });
    // 위험도로 칠한 길
    if (o.risk > 0.002)
      RISK.forEach((parts, ri) => {
        const u = seg(o.riskT ?? 1, ri * 0.09, 0.55, E.inOut);
        const shown = Math.floor(u * parts.length + 0.999);
        parts.slice(0, shown).forEach((pt) => {
          m += tag("path", { d: dpath([at(pt.p0), at(pt.p1)], false), stroke: pt.color, "stroke-width": ROADS[ri].main ? 6 : 4.5, "stroke-linecap": "round", opacity: o.risk });
        });
      });
    // 구역 경계
    if (o.lines > 0.002) DIST.forEach((d) => (m += tag("path", { d: dpath(d.pts.map(at)), fill: "none", stroke: INK2, "stroke-width": 1.4, "stroke-dasharray": "4 4", opacity: 0.6 * o.lines })));
    if (o.extra) m += o.extra;
    s += g({ "clip-path": "url(#map)" }, m);
    return s;
  }

  // 노인 시설 표시: 흰 동그라미 안의 집 모양
  const house = (x, y, k = 1) =>
    tag("path", { d: `M${n2(x - 5.5 * k)} ${n2(y + 4.6 * k)}V${n2(y - 0.6 * k)}L${n2(x)} ${n2(y - 5.6 * k)}L${n2(x + 5.5 * k)} ${n2(y - 0.6 * k)}V${n2(y + 4.6 * k)}Z`, fill: C.ink });
  const facility = (f, a) => {
    const [x, y] = at(f);
    return g({ opacity: a }, tag("circle", { cx: x, cy: y, r: 10.5, fill: C.paper, stroke: C.ink, "stroke-width": 1.7 }) + house(x, y));
  };
  const dots = (a, color = C.red) =>
    ACC.map((p, i) => {
      const [x, y] = at(p);
      const u = seg(a, i * 0.035, 0.25);
      return u > 0.01 ? tag("circle", { cx: x, cy: y, r: 3.6 * (0.6 + 0.4 * u), fill: color, stroke: C.paper, "stroke-width": 1, opacity: u }) : "";
    }).join("");
  const side = (inner, a = 1) => g({ opacity: a }, card(P.x, P.y - 2, P.w, P.h + 4, { rx: 12 }) + inner);

  function draw(t) {
    let s = tag("rect", { x: 0, y: 0, width: W, height: H, fill: BG });
    // ── 1장 ──
    if (t < beats[1].at) {
      const lt = t;
      const out = 1 - seg(lt, 5.5, 0.3, E.in);
      // 지도: 노인 시설과 사고 지점이 먼저 따로 찍힌다
      const glow = seg(lt, 3.05, 0.6) * out;
      const hot = seg(lt, 3.6, 0.4);
      // 시설 가중치는 길 아래에 깔리는 보라 번짐, 사고 지점과 시설 표시는 길 위에
      let under = "";
      FAC.forEach((f, i) => {
        const [x, y] = at(f);
        const a = glow * seg(lt, 3.05 + i * 0.04, 0.5);
        if (a > 0.002) under += tag("circle", { cx: x, cy: y, r: 30 + 16 * a, fill: "url(#fw)", opacity: a });
      });
      let extra = g({ opacity: 1 - 0.45 * hot }, dots(clamp((lt - 1.0) / 1.2)));
      FAC.forEach((f, i) => (extra += facility(f, seg(lt, 0.35 + i * 0.05, 0.3))));
      s += base({ hex: hot * out, hexT: clamp((lt - 3.6) / 0.8), under, extra });
      const c1 = at([240, 150]);
      s += chip(c1[0] + 34, c1[1] - 34, "가중 핫스폿", { size: 12.5, fill: C.lemon, opacity: seg(lt, 4.35, 0.3) * out });
      // 오른쪽: 데이터 묶음. 흩어져 있다가 한 지도로 모인다
      const align = seg(lt, 2.95, 0.55, E.inOut);
      const SRC = [
        { label: "고령 보행자 사고", icon: (x, y) => tag("circle", { cx: x, cy: y, r: 5, fill: C.red }), r: -6, dx: -6, dy: -3 },
        { label: "노인 시설", icon: (x, y) => house(x, y, 0.85), r: 5, dx: 10, dy: 5 },
        { label: "도로·인구", icon: (x, y) => tag("path", { d: `M${x - 8} ${y + 4}L${x + 8} ${y - 4}`, stroke: "#c9c4b6", "stroke-width": 5, "stroke-linecap": "round" }), r: -4, dx: -2, dy: 2 },
      ];
      let inner = text(P.x + 18, P.y + 26, "데이터", { "font-size": 13.5, "font-weight": 700, fill: C.sub });
      SRC.forEach((d, i) => {
        const x = P.x + 16;
        const y = P.y + 48 + i * 44;
        const cx = x + 94;
        const cy = y + 18;
        const rot = d.r * (1 - align);
        const tr = `translate(${n2(d.dx * (1 - align))} ${n2(d.dy * (1 - align))}) rotate(${n2(rot)} ${cx} ${cy})`;
        inner += g(
          { opacity: seg(lt, 0.3 + i * 0.25, 0.3), transform: tr },
          tag("rect", { x, y, width: 188, height: 36, rx: 9, fill: C.paper, stroke: C.ink, "stroke-width": 1.6 }) +
            d.icon(x + 18, cy) +
            text(x + 34, cy + 0.5, d.label, { "font-size": 14, "font-weight": 700, fill: C.ink }) +
            g({ opacity: seg(lt, 3.35 + i * 0.08, 0.25) }, tick(x + 170, cy, 0.8)),
        );
      });
      inner += chip(P.x + 18, P.y + 196, "따로 흩어진 데이터", { size: 12.5, fill: C.red, color: C.paper, stroke: null, opacity: seg(lt, 1.85, 0.3) * (1 - seg(lt, 2.75, 0.25, E.in)) });
      inner += chip(P.x + 18, P.y + 196, "한 지도로 통합", { size: 12.5, fill: C.lemon, opacity: seg(lt, 3.45, 0.3) * out });
      inner +=
        g({ opacity: seg(lt, 3.2, 0.3) * out }, tag("circle", { cx: P.x + 27, cy: P.y + 244, r: 12, fill: "url(#fw)" }) + text(P.x + 46, P.y + 244.5, "시설 가중치", { "font-size": 13.5, fill: C.ink })) +
        g({ opacity: hot * out }, tag("path", { d: hexPath({ x: 0, y: 0, r: 10 }), fill: "#ef4444", opacity: 0.7, transform: `translate(${P.x + 27 - M.x} ${P.y + 278 - M.y})` }) + text(P.x + 46, P.y + 278.5, "핫스폿(Hot Spot)", { "font-size": 13.5, fill: C.ink }));
      s += side(inner);
    }
    // ── 2장 ──
    else if (t < beats[2].at) {
      const lt = t - beats[1].at;
      const out = 1 - seg(lt, 5.5, 0.3, E.in);
      const local = seg(lt, 3.0, 0.8, E.inOut);
      const vals = DIST.map((d) => lerp(0.6, d.gwr, local));
      const distA = seg(lt, 0.2, 0.4);
      s += base({ dist: vals, distA, lines: distA, hex: 0.55, extra: dots(1, "rgba(232,17,45,0.55)") });
      // 구역 이름
      DIST.forEach((d) => {
        const cx = d.pts.reduce((a, p) => a + p[0], 0) / d.pts.length;
        const cy = d.pts.reduce((a, p) => a + p[1], 0) / d.pts.length;
        const [x, y] = at([cx, cy + 14]);
        s += chip(x, y, d.name, { size: 12, fill: C.paper, anchor: "middle", h: 22, pad: 8, opacity: distA });
      });
      // 오른쪽: 도로 폭이 사고에 주는 영향 — 하나의 값 → 구역마다 다른 값
      let inner = text(P.x + 18, P.y + 26, "도로 폭 영향도", { "font-size": 13.5, "font-weight": 700, fill: C.sub });
      DIST.forEach((d, i) => {
        const y = P.y + 66 + i * 46;
        inner += text(P.x + 18, y, d.name, { "font-size": 13.5, "font-weight": 700, fill: C.ink });
        inner += tag("rect", { x: P.x + 82, y: y - 9, width: 118, height: 18, rx: 9, fill: C.mute });
        inner += tag("rect", { x: P.x + 82, y: y - 9, width: Math.max(10, 118 * vals[i]), height: 18, rx: 9, fill: lilacScale(vals[i]), stroke: C.ink, "stroke-width": 1.4 });
      });
      inner += chip(P.x + 18, P.y + 262, "전역 회귀 · 단일 계수", { size: 12.5, fill: C.paper, opacity: seg(lt, 0.6, 0.3) * (1 - seg(lt, 2.85, 0.25, E.in)) });
      inner += chip(P.x + 18, P.y + 262, "GWR · 지역별 계수", { size: 12.5, fill: C.lemon, opacity: seg(lt, 3.2, 0.3) * out });
      inner += chip(P.x + 18, P.y + 298, "Random Forest · 위험도", { size: 12.5, fill: C.paper, opacity: seg(lt, 4.1, 0.3) * out });
      s += side(inner);
      s += chip(at([240, 150])[0] + 40, at([240, 150])[1] + 52, "?", { size: 13, fill: C.paper, color: C.red, stroke: C.red, pad: 7, opacity: seg(lt, 1.4, 0.3) * (1 - seg(lt, 2.85, 0.25, E.in)) });
      s += chip(at([360, 254])[0] - 40, at([360, 254])[1] + 40, "?", { size: 13, fill: C.paper, color: C.red, stroke: C.red, pad: 7, opacity: seg(lt, 1.6, 0.3) * (1 - seg(lt, 2.85, 0.25, E.in)) });
    }
    // ── 3장 ──
    else {
      const lt = t - beats[2].at;
      const sol = seg(lt, 2.85, 0.4);
      const pins = [
        [240, 150],
        [360, 254],
      ];
      let extra = "";
      // 문제: 어디에 지정할지 근거가 없다
      const cand = [
        [120, 120],
        [300, 210],
        [420, 290],
      ];
      cand.forEach((p, i) => {
        const [x, y] = at(p);
        extra += chip(x, y, "?", { size: 14, fill: C.paper, color: C.sub, stroke: C.wire, pad: 8, anchor: "middle", opacity: seg(lt, 0.4 + i * 0.2, 0.3) * (1 - sol) });
      });
      // 해결: 위험도 지도와 추천 입지
      pins.forEach((p, i) => {
        const [x, y] = at(p);
        const a = seg(lt, 3.9 + i * 0.25, 0.35);
        extra += g({ opacity: a }, tag("circle", { cx: x, cy: y, r: 30 + 4 * (1 - a), fill: C.lemon, opacity: 0.5 }) + tag("circle", { cx: x, cy: y, r: 30 + 4 * (1 - a), fill: "none", stroke: C.ink, "stroke-width": 2.2 }));
      });
      s += base({ risk: sol, riskT: clamp((lt - 2.9) / 1.0), extra });
      pins.forEach((p, i) => {
        const [x, y] = at(p);
        s += chip(x + 26, y - 30, "추천 입지", { size: 12.5, fill: C.lemon, opacity: seg(lt, 4.1 + i * 0.25, 0.3) });
      });
      s += chip(M.x + M.w / 2, M.y + M.h / 2 - 8, "지정 근거 부재", { size: 14, fill: C.paper, anchor: "middle", opacity: seg(lt, 1.0, 0.3) * (1 - sol) });
      // 오른쪽: 위험도 범례와 보고서
      const rep = seg(lt, 4.5, 0.4);
      const ask = seg(lt, 0.5, 0.3) * (1 - seg(lt, 2.7, 0.25, E.in));
      let inner = g(
        { opacity: ask },
        text(P.x + 18, P.y + 26, "지정 근거", { "font-size": 13.5, "font-weight": 700, fill: C.sub }) +
          tag("rect", { x: P.x + 18, y: P.y + 48, width: P.w - 36, height: 120, rx: 10, fill: "none", stroke: C.wire, "stroke-width": 1.6, "stroke-dasharray": "6 5" }) +
          text(P.x + P.w / 2, P.y + 108, "근거 자료 없음", { "font-size": 14, "font-weight": 700, fill: C.sub, "text-anchor": "middle" }),
      );
      inner += text(P.x + 18, P.y + 26, "위험도", { "font-size": 13.5, "font-weight": 700, fill: C.sub, opacity: sol });
      [["높음", "#ef4444"], ["보통", "#3b82f6"], ["낮음", "#22c55e"]].forEach(([l, c], i) => {
        inner += g({ opacity: seg(lt, 3.1 + i * 0.1, 0.3) }, tag("path", { d: `M${P.x + 18} ${P.y + 58 + i * 28}h26`, stroke: c, "stroke-width": 6, "stroke-linecap": "round" }) + text(P.x + 56, P.y + 58.5 + i * 28, l, { "font-size": 13.5, fill: C.ink }));
      });
      inner += g(
        { opacity: rep, transform: `translate(0 ${n2((1 - rep) * 10)})` },
        tag("rect", { x: P.x + 18, y: P.y + 158, width: P.w - 36, height: 150, rx: 10, fill: C.lilacLight, stroke: C.ink, "stroke-width": 1.6 }) +
          text(P.x + 32, P.y + 182, "분석 보고서", { "font-size": 14, "font-weight": 700, fill: C.ink }) +
          [150, 120, 138, 96].map((w, i) => tag("rect", { x: P.x + 32, y: P.y + 200 + i * 18, width: w, height: 8, rx: 4, fill: "#c9c2f0" })).join("") +
          chip(P.x + 32, P.y + 288, "시군별 최적입지", { size: 12, fill: C.lemon, h: 22, pad: 8 }),
      );
      s += side(inner);
    }
    for (const b of beats.slice(1)) {
      const u = clamp((t - (b.at - 0.3)) / 0.6);
      if (u > 0 && u < 1) s += tag("rect", { x: 0, y: 64, width: W, height: H - 64, fill: BG, opacity: E.inOut(1 - Math.abs(u * 2 - 1)) });
    }
    return s;
  }

  const defs = '<radialGradient id="fw"><stop offset="0" stop-color="#8f7cf0" stop-opacity="0.78"/><stop offset="0.55" stop-color="#a596f3" stop-opacity="0.42"/><stop offset="1" stop-color="#b9adff" stop-opacity="0"/></radialGradient>';
  return { beats, duration, draw, defs, bg: BG, poster: 4.9 };
})();
