// 설명 영상의 그리기 도구. 장면은 시간 t(초)를 받아 SVG 글을 돌려주는 순수 함수라, 프레임마다 다시 그려도 늘 같은 그림이 나온다.
// 그리는 단위는 800×450 이고, tool/video/render.mjs 가 2배(1600×900)로 찍어 mp4 로 묶는다.
"use strict";
const W = 800;
const H = 450;
const C = {
  ink: "#17171a",
  sub: "#55554f",
  rule: "#d9d8d0",
  mute: "#efeee8",
  paper: "#ffffff",
  lemon: "#ffe55c",
  lilac: "#d9d2ff",
  lilacLight: "#f1eeff",
  red: "#e8112d",
  green: "#12a150",
  wire: "#8b8a82",
};
const SANS = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif';
const SHOP = '"Do Hyeon", "Apple SD Gothic Neo", sans-serif';

// ── 시간 ──
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const mix2 = (p, q, u) => [lerp(p[0], q[0], u), lerp(p[1], q[1], u)];
const E = {
  out: (u) => 1 - (1 - u) ** 3,
  expo: (u) => (u >= 1 ? 1 : 1 - 2 ** (-10 * u)),
  inOut: (u) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2),
  in: (u) => u * u,
  lin: (u) => u,
};
// t 가 a 에서 a+d 로 가는 동안 0→1
const seg = (t, a, d, e = E.out) => e(clamp((t - a) / d));
// a 에서 들어와 b 에서 나간다
const fade = (t, a, d, b, d2 = 0.3) => seg(t, a, d) * (1 - seg(t, b, d2, E.in));

// ── SVG 글 ──
const n2 = (v) => Math.round(v * 100) / 100;
const dpath = (ps, close = true) => "M" + ps.map((p) => `${n2(p[0])} ${n2(p[1])}`).join("L") + (close ? "Z" : "");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attrs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => `${k}="${typeof v === "number" ? n2(v) : v}"`)
    .join(" ");
const tag = (name, o = {}, inner) => (inner === undefined ? `<${name} ${attrs(o)}/>` : `<${name} ${attrs(o)}>${inner}</${name}>`);
const g = (o, inner) => (o.opacity !== undefined && o.opacity <= 0.002 ? "" : tag("g", o, inner));
const text = (x, y, s, o = {}) => tag("text", { x, y, "font-family": SANS, "dominant-baseline": "central", ...o }, esc(s));
const shadow =
  '<filter id="lift" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#343046" flood-opacity="0.22"/></filter>' +
  '<filter id="curs" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1" stdDeviation="0.9" flood-color="#17171a" flood-opacity="0.32"/></filter>';

const measureCtx = document.createElement("canvas").getContext("2d");
function measure(s, size, weight = 400, family = SANS) {
  measureCtx.font = `${weight} ${size}px ${family}`;
  return measureCtx.measureText(s).width;
}

// 알약 딱지. anchor 는 start|middle|end, y 는 가운데
function chip(x, y, label, o = {}) {
  const { size = 13, weight = 700, fill = C.paper, color = C.ink, stroke = C.ink, sw = 1.5, pad = 9, anchor = "start", family = SANS, opacity = 1 } = o;
  const h = o.h || Math.round(size * 1.9);
  const w = measure(label, size, weight, family) + pad * 2;
  const x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
  return g(
    { opacity },
    tag("rect", { x: x0, y: y - h / 2, width: w, height: h, rx: h / 2, fill, stroke: stroke || "none", "stroke-width": stroke ? sw : 0 }) +
      text(x0 + w / 2, y + size * 0.04, label, { "font-size": size, "font-weight": weight, fill: color, "text-anchor": "middle", "font-family": family }),
  );
}
chip.width = (label, o = {}) => measure(label, o.size || 13, o.weight || 700, o.family || SANS) + (o.pad ?? 9) * 2;

// 흰 카드(구성도의 노드와 같은 모양): 굵은 먹 테두리와 옅은 그림자
const card = (x, y, w, h, o = {}) =>
  tag("rect", { x, y, width: w, height: h, rx: o.rx ?? 14, fill: o.fill || C.paper, stroke: o.stroke || C.ink, "stroke-width": o.sw ?? 2, filter: o.flat ? undefined : "url(#lift)", opacity: o.opacity });

// 체크·엑스 표시
const tick = (x, y, s = 1, color = C.ink) =>
  tag("path", { d: `M${n2(x - 6 * s)} ${n2(y)}l${n2(4 * s)} ${n2(4.5 * s)} ${n2(8.5 * s)} ${n2(-9.5 * s)}`, fill: "none", stroke: color, "stroke-width": 2.6 * s, "stroke-linecap": "round", "stroke-linejoin": "round" });
const cross = (x, y, s = 1, color = C.red) =>
  tag("path", { d: `M${n2(x - 5 * s)} ${n2(y - 5 * s)}l${n2(10 * s)} ${n2(10 * s)}M${n2(x + 5 * s)} ${n2(y - 5 * s)}l${n2(-10 * s)} ${n2(10 * s)}`, fill: "none", stroke: color, "stroke-width": 2.6 * s, "stroke-linecap": "round" });

// 선을 0→1 만큼 그린다(pathLength 로 길이를 1로 본다)
const drawOn = (d, u, o = {}) =>
  u <= 0.001 ? "" : tag("path", { d, fill: "none", pathLength: 1, "stroke-dasharray": u >= 0.999 ? undefined : `${n2(u)} 2`, "stroke-linecap": "round", "stroke-linejoin": "round", ...o });

// 사이트의 레몬 화살표 커서(tool/cursor/arrow.svg). 화살 끝이 x, y
const ARROW = "M6.2 4.6V21.4L10.3 17.6 13.1 23.6 15.9 22.4 13.2 16.6H18.6Z";
function pointer(x, y, o = {}) {
  const s = o.s ?? 1.25;
  return g(
    { transform: `translate(${n2(x - 6.2 * s)} ${n2(y - 4.6 * s)}) scale(${s})`, opacity: o.opacity },
    tag("path", { d: ARROW, fill: "#fff", stroke: "#fff", "stroke-width": 6.3, "stroke-linejoin": "round", filter: "url(#curs)" }) +
      tag("path", { d: ARROW, fill: C.ink, stroke: C.ink, "stroke-width": 2.8, "stroke-linejoin": "round" }) +
      tag("path", { d: ARROW, fill: C.lemon }) +
      tag("path", { d: "M7.7 9.2v6.6", stroke: "#fff", "stroke-width": 1.1, "stroke-linecap": "round", opacity: 0.85 }),
  );
}
// 누른 자리에 퍼지는 고리
const ripple = (x, y, u) => (u <= 0 || u >= 1 ? "" : tag("circle", { cx: x, cy: y, r: 4 + 15 * E.out(u), fill: "none", stroke: C.ink, "stroke-width": 2, opacity: 0.55 * (1 - u) }));
// 시각마다 자리 [[t, x, y]...] 를 따라 움직인다(사이는 부드럽게)
function track(t, keys) {
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2]];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, x0, y0] = keys[i];
    const [t1, x1, y1] = keys[i + 1];
    if (t <= t1) {
      const u = E.inOut(clamp((t - t0) / (t1 - t0)));
      return [lerp(x0, x1, u), lerp(y0, y1, u)];
    }
  }
  const k = keys[keys.length - 1];
  return [k[1], k[2]];
}

// ── 3D: 높은 곳에 단 카메라로 본 바닥 ──
const v3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]);
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  lerp: (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)],
};

// k 가 0 보다 크면 가장자리가 안으로 휘는 어안(배럴) 왜곡
function camera({ pos, target, f, cx = W / 2, cy = H / 2, k = 0 }) {
  const fw = v3.norm(v3.sub(target, pos));
  const rt = v3.norm(v3.cross(fw, [0, 0, 1]));
  const dn = v3.cross(fw, rt);
  const P = (p) => {
    const d = v3.sub(p, pos);
    const z = v3.dot(d, fw);
    let x = v3.dot(d, rt) / z;
    let y = v3.dot(d, dn) / z;
    if (k) {
      const s = 1 / (1 + k * (x * x + y * y));
      x *= s;
      y *= s;
    }
    return [cx + f * x, cy + f * y];
  };
  const steps = k ? 14 : 1;
  const line = (a, b, n = steps) => Array.from({ length: n + 1 }, (_, i) => P(v3.lerp(a, b, i / n)));
  const poly = (ps, n = steps) => ps.flatMap((p, i) => line(p, ps[(i + 1) % ps.length], n).slice(0, -1));
  return { P, line, poly, pos, k };
}

// 바닥 위 상자(차체·지붕). 가운데 c, 앞뒤 방향 yaw(0 이면 +y), 길이 L, 폭 B, 바닥 높이 z0, 높이 h
function boxCorners(c, yaw, L, B, z0, h) {
  const ax = [Math.sin(yaw), Math.cos(yaw)];
  const px = [Math.cos(yaw), -Math.sin(yaw)];
  const at = (a, b, z) => [c[0] + (ax[0] * a * L) / 2 + (px[0] * b * B) / 2, c[1] + (ax[1] * a * L) / 2 + (px[1] * b * B) / 2, z];
  // 바닥 네 꼭짓점: 뒤-왼, 뒤-오, 앞-오, 앞-왼(위에서 보아 시계 반대)
  const base = [
    [-1, -1],
    [-1, 1],
    [1, 1],
    [1, -1],
  ];
  return { bottom: base.map(([a, b]) => at(a, b, z0)), top: base.map(([a, b]) => at(a, b, z0 + h)) };
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(clamp(v * f, 0, 255)));
  return `rgb(${ch.join(",")})`;
}

// 상자의 보이는 면. 옆면의 바깥 방향이 카메라를 보면 보인다
function boxFaces(cam, corners, color) {
  const { bottom: b, top: tp } = corners;
  const light = v3.norm([-0.5, -0.8, 0.6]);
  const faces = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const quad = [b[i], b[j], tp[j], tp[i]];
    const edge = v3.sub(b[j], b[i]);
    const nrm = v3.norm([edge[1], -edge[0], 0]);
    const mid = v3.lerp(b[i], tp[j], 0.5);
    const vis = v3.dot(nrm, v3.sub(cam.pos, mid)) > 0;
    faces.push({ quad, vis, side: i, fill: shade(color, 0.8 + 0.16 * v3.dot(nrm, light)) });
  }
  faces.push({ quad: tp, vis: cam.pos[2] > tp[0][2], side: "top", fill: color });
  return faces;
}

// ── 영상 틀: 위쪽 진행 막대(장마다 한 칸)와 문제·해결 자막 ──
function capLine(label, s, opacity, dy, solve) {
  if (!s || opacity <= 0.002) return "";
  const o = { size: 13, pad: 10, h: 26 };
  const pw = chip.width(label, o);
  const pill = chip(28, 52 + dy, label, { ...o, fill: solve ? C.lemon : C.ink, color: solve ? C.ink : C.paper, stroke: solve ? C.ink : null });
  return g({ opacity }, pill + text(28 + pw + 11, 53 + dy, s, { "font-size": 27, fill: C.ink, "font-family": SHOP }));
}

function chrome(t, sc) {
  const { beats, duration } = sc;
  const P = window.PROBLEMS || [];
  const n = beats.length;
  const x0 = 28;
  const gap = 6;
  const sw = (W - 56 - gap * (n - 1)) / n;
  let out = "";
  beats.forEach((b, i) => {
    const end = i + 1 < n ? beats[i + 1].at : duration;
    const u = clamp((t - b.at) / (end - b.at));
    const x = x0 + i * (sw + gap);
    out += tag("rect", { x, y: 15, width: sw, height: 4, rx: 2, fill: C.ink, opacity: 0.13 });
    if (u > 0) out += tag("rect", { x, y: 15, width: Math.max(4, sw * u), height: 4, rx: 2, fill: C.ink, opacity: 0.72 });
  });
  let i = -1;
  beats.forEach((b, j) => {
    if (t >= b.at) i = j;
  });
  if (i < 0) return out;
  const b = beats[i];
  const len = (i + 1 < n ? beats[i + 1].at : duration) - b.at;
  const lt = t - b.at;
  const p = P[i] || {};
  const k = b.solve;
  const pa = seg(lt, 0.1, 0.45) * (1 - seg(lt, k - 0.1, 0.25, E.in));
  const sa = seg(lt, k + 0.1, 0.45) * (1 - seg(lt, len - 0.4, 0.3, E.in));
  out += capLine("문제", p.problem, pa, lt < k - 0.1 ? (1 - seg(lt, 0.1, 0.45)) * 10 : -seg(lt, k - 0.1, 0.25, E.in) * 8, false);
  out += capLine("해결", p.solution, sa, (1 - seg(lt, k + 0.1, 0.45)) * 10, true);
  return out;
}

// 두 화면 사이: 앞 화면을 바탕색으로 덮었다가 걷으며 뒤 화면을 보인다(겹쳐 비치지 않게)
function dip(u, bg, before, after) {
  if (u < 0.5) return before() + tag("rect", { x: 0, y: 0, width: W, height: H, fill: bg, opacity: E.inOut(u * 2) });
  return after() + tag("rect", { x: 0, y: 0, width: W, height: H, fill: bg, opacity: E.inOut((1 - u) * 2) });
}

// 한 프레임. 끝의 0.7초는 바탕색으로 잠깐 비웠다가 처음 화면으로 돌아가, 되풀이가 이어져 보이게 한다
function frame(t) {
  const sc = window.SCENE;
  const tail = 0.7;
  const body =
    t > sc.duration - tail
      ? dip(clamp((t - (sc.duration - tail)) / tail), sc.bg, () => sc.draw(t) + chrome(t, sc), () => sc.draw(0) + chrome(0, sc))
      : sc.draw(t) + chrome(t, sc);
  document.getElementById("stage").innerHTML = `<defs>${shadow}${sc.defs || ""}</defs>` + body;
}
