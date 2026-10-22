// 주차폴 점유 판정 엔진: 세 장(낮은 폴 카메라에서 2D 상자가 옆 칸까지 덮음 → 하단면 바닥 덮임 비율,
// 초당 1~2장에서 ID 가 자꾸 바뀌어 주차가 쪼개짐 → 하단면 트래커 · 앞뒤 카메라 ID 로 차량 교체, 라즈베리파이 처리 속도 → 엔진 최적화)
"use strict";
window.SCENE = (() => {
  const BG = "#d6ecff";
  const SPW = 6; // 평행주차 칸 길이(도로 방향)
  const S = 5; // 폴 바로 앞 칸(차가 선 칸)
  const N = 4; // 그 너머 빈 칸
  // 폴 카메라: 보도 위 2.6 m 에서 도로를 따라 칸들을 비스듬히 본다
  const lot = makeLot({
    bg: "#dfe7ee",
    sp: SPW,
    depth: 2.5,
    first: 0,
    last: 5,
    cam: { pos: [SPW * 6 + 3, 8.0, 5.5], target: [SPW * 4.3, 0.5, 0], f: 580, cx: 480, cy: 212 },
    focus: 1,
    cars: [
      { space: 2, dx: 0.3, dy: 0.05, yaw: Math.PI / 2 + 0.012, color: "#f7f6f1" },
      { space: S, dx: -0.35, dy: 0.02, yaw: Math.PI / 2 - 0.015, color: C.lilac },
    ],
  });
  const { cars, FOCUS, world } = lot;
  const beats = [
    { at: 0, solve: 2.8 },
    { at: 5.8, solve: 3.0 },
    { at: 11.8, solve: 2.8 },
  ];
  const duration = 17.6;
  const RED = C.red;
  const GREEN = C.green;
  const PEACH = "#ffd8a8";

  // 진한 띠 판(2·3장): 카드 하나를 깔고 그 위에 그린다
  const CX = 34;
  const CY = 96;
  const CW = 732;
  const CH = 316;

  // ── 1장: 폴 카메라 화면 ──
  function chapter1(t) {
    const lt = t;
    const out = 1 - seg(lt, 5.4, 0.3, E.in);
    const st = { tint: [], fp: [0, 0], box2d: null };
    st.box2d = [seg(lt, 0.4, 0.7, E.inOut), 1 - seg(lt, 2.7, 0.35, E.in)];
    const wrong = seg(lt, 1.15, 0.4) * (1 - seg(lt, 2.7, 0.3, E.in));
    const fix = seg(lt, 3.15, 0.45);
    const a = Math.max(wrong, fix) * out;
    st.tint[S] = [RED, 0.32 * a];
    st.tint[N] = [mixColor(RED, GREEN, fix), 0.32 * a];
    st.fp[FOCUS] = seg(lt, 2.95, 0.5) * out;
    // 칸 이름표: 칸의 도로 쪽 가장자리 위에
    const label = (cam, i, txt, fill, color, o) => {
      const p = cam.P([SPW * (i + 0.5), -1.1, 0]);
      return chip(p[0], p[1], txt, { size: 13, anchor: "middle", fill, color, stroke: fill === C.paper ? RED : null, opacity: o });
    };
    st.extra = (cam) =>
      label(cam, S, "점유?", C.paper, RED, seg(lt, 1.3, 0.35) * (1 - seg(lt, 2.7, 0.3, E.in))) +
      label(cam, N, "점유?", C.paper, RED, seg(lt, 1.45, 0.35) * (1 - seg(lt, 2.7, 0.3, E.in))) +
      label(cam, S, "점유", RED, C.paper, seg(lt, 3.6, 0.35) * out) +
      label(cam, N, "빈 칸", GREEN, C.paper, seg(lt, 3.75, 0.35) * out);
    let s = world(st);
    s += chip(28, 108, "폴 앞 카메라", { size: 13, fill: C.paper, opacity: seg(lt, 0.1, 0.3) * out });
    // 오른쪽 위: 주차면 바닥을 하단면이 덮은 비율과 기준
    const pa = seg(lt, 3.3, 0.35) * out;
    if (pa > 0.002) {
      const px = 560;
      const py = 98;
      let p = card(px, py, 212, 128, { opacity: 1 });
      p += text(px + 16, py + 22, "주차면 바닥 덮임", { "font-size": 13.5, "font-weight": 700, fill: C.sub });
      const BX = px + 60;
      const BW = 108;
      const rows = [
        ["이 칸", 0.55, RED, "55%"],
        ["옆 칸", 0, GREEN, "0%"],
      ];
      rows.forEach(([name, v, col, val], i) => {
        const y = py + 56 + i * 34;
        const u = seg(lt, 3.5 + i * 0.12, 0.45, E.inOut);
        p += text(px + 16, y, name, { "font-size": 14, "font-weight": 700, fill: C.ink });
        p += tag("rect", { x: BX, y: y - 7, width: BW, height: 14, rx: 7, fill: C.mute });
        if (v > 0) p += tag("rect", { x: BX, y: y - 7, width: Math.max(14, BW * v * u), height: 14, rx: 7, fill: col });
        p += text(BX + BW + 6, y, val, { "font-size": 12.5, "font-weight": 700, fill: col === RED ? RED : C.sub, opacity: u });
      });
      // 기준 25%
      const tx = BX + BW * 0.25;
      p += tag("path", { d: `M${tx} ${py + 40}V${py + 104}`, stroke: C.ink, "stroke-width": 1.6, "stroke-dasharray": "3 3" });
      p += text(tx, py + 116, "기준 25%", { "font-size": 11.5, "font-weight": 700, fill: C.sub, "text-anchor": "middle" });
      s += g({ opacity: pa }, p);
    }
    return s;
  }

  // ── 2장: 초당 1~2장 프레임과 추적 ID, 주차 기록 ──
  const FR = 7; // 프레임 수(앞 5장 같은 차, 뒤 2장 다른 차)
  const SWAP = 5;
  const OLD = [
    [12, 13, 13, 14, 15, 16, 16],
    [8, 9, 9, 9, 10, 11, 11],
  ];
  const NEW = [
    [12, 12, 12, 12, 12, 27, 27],
    [8, 8, 8, 8, 8, 31, 31],
  ];
  function chapter2(lt) {
    const k = beats[1].solve;
    const solve = seg(lt, k + 0.15, 0.5);
    let s = card(CX, CY, CW, CH);
    s += chip(CX + 16, CY + 24, "초당 1~2장", { size: 13, fill: C.paper });
    const FX = CX + 112;
    const TW = 74;
    const GAP = 6;
    const TH = 50;
    const rowsY = [CY + 58, CY + 120];
    const fx = (i) => FX + i * (TW + GAP);
    ["앞 카메라", "뒤 카메라"].forEach((name, r) => {
      s += text(CX + 16, rowsY[r] + TH / 2, name, { "font-size": 14, "font-weight": 700, fill: C.ink, opacity: seg(lt, 0.15, 0.3) });
    });
    for (let i = 0; i < FR; i++) {
      const a = seg(lt, 0.3 + i * 0.17, 0.3);
      if (a <= 0.002) continue;
      const carCol = i < SWAP ? C.lilac : PEACH;
      for (let r = 0; r < 2; r++) {
        const x = fx(i);
        const y = rowsY[r];
        let f = tag("rect", { x, y, width: TW, height: TH, rx: 8, fill: "#eef3f7", stroke: C.rule, "stroke-width": 1.4 });
        // 칸과 차(위에서 본 모양)
        f += tag("path", { d: `M${x + 8} ${y + TH - 9}H${x + TW - 8}`, stroke: "#c4ced8", "stroke-width": 2 });
        f += tag("rect", { x: x + 14, y: y + 20, width: TW - 28, height: 18, rx: 6, fill: carCol, stroke: C.ink, "stroke-width": 1.4 });
        // ID: 문제 동안은 옛 추적, 해결에서 하단면 트래커로 바뀐다
        const oldId = OLD[r][i];
        const newId = NEW[r][i];
        const changedOld = i > 0 && OLD[r][i] !== OLD[r][i - 1];
        const changedNew = i > 0 && NEW[r][i] !== NEW[r][i - 1];
        const o = { size: 11.5, h: 18, pad: 6, anchor: "end" };
        f += chip(x + TW - 4, y + 10, `#${oldId}`, { ...o, fill: changedOld ? RED : C.paper, color: changedOld ? C.paper : C.ink, stroke: changedOld ? null : C.ink, opacity: 1 - solve });
        f += chip(x + TW - 4, y + 10, `#${newId}`, { ...o, fill: changedNew ? C.lemon : C.paper, stroke: C.ink, opacity: solve });
        s += g({ opacity: a }, f);
      }
    }
    // 차량 교체: 앞뒤 카메라 ID 가 같은 때 함께 바뀐다
    const sw = seg(lt, k + 1.05, 0.35);
    if (sw > 0.002) {
      const x = fx(SWAP) - GAP / 2;
      s += tag("path", { d: `M${x} ${rowsY[0] - 8}V${rowsY[1] + TH + 8}`, stroke: C.ink, "stroke-width": 2.2, "stroke-dasharray": "5 4", opacity: sw });
      s += chip(x, rowsY[0] - 20, "앞뒤 ID 함께 바뀜", { size: 12, h: 22, pad: 8, anchor: "middle", fill: C.lemon, opacity: sw });
    }
    // 주차 기록: 문제 동안은 ID 가 바뀔 때마다 끊긴다
    const TY = CY + 214;
    s += text(CX + 16, TY + 12, "주차 기록", { "font-size": 14, "font-weight": 700, fill: C.ink, opacity: seg(lt, 0.15, 0.3) });
    const segsOld = [[0, 1], [1, 3], [3, 4], [4, 5], [5, 7]];
    const segsNew = [[0, 5], [5, 7]];
    const grow = (i) => seg(lt, 0.3 + i * 0.17, 0.3);
    const bar = (lo, hi, fill, stroke, opacity) => {
      const x0 = fx(lo) + 1;
      const shown = Math.max(lo, Math.min(hi, lo + (hi - lo) * 1));
      const x1 = fx(shown - 1) + TW - 1;
      return tag("rect", { x: x0, y: TY, width: Math.max(0, x1 - x0), height: 24, rx: 8, fill, stroke, "stroke-width": 1.6, opacity });
    };
    segsOld.forEach(([lo, hi], j) => {
      const a = grow(hi - 1) * (1 - solve);
      s += bar(lo, hi, j % 2 ? "#f6c9cf" : "#fbe3e6", RED, a);
    });
    segsNew.forEach(([lo, hi], j) => {
      const a = solve * (j === 0 ? 1 : sw);
      s += bar(lo, hi, j === 0 ? C.lilac : PEACH, C.ink, a);
    });
    s += chip(fx(FR - 1) + TW, TY + 46, "주차 쪼갬 · 5건", { size: 12.5, fill: RED, color: C.paper, stroke: null, anchor: "end", opacity: seg(lt, 1.9, 0.3) * (1 - solve) });
    s += chip(fx(0), TY + 46, "같은 차 1건", { size: 12.5, fill: C.paper, opacity: seg(lt, k + 0.55, 0.3) });
    s += chip(fx(SWAP), TY + 46, "차량 교체 → 새 주차", { size: 12.5, fill: C.lemon, opacity: seg(lt, k + 1.35, 0.3) });
    return s;
  }

  // ── 3장: 라즈베리파이 처리 시간을 구간별로 나눠 줄인다 ──
  function chapter3(lt) {
    const VX = CX + 16;
    const VY = CY + 50;
    const VW = 304;
    const VH = 171;
    const mini = g({ transform: `translate(${VX} ${VY}) scale(${n2(VW / W)})` }, world({ tint: [, , , , [GREEN, 0.3], [RED, 0.32]], fp: [0, 1] }));
    let s = card(CX, CY, CW, 284);
    s += chip(CX + 16, CY + 26, "라즈베리파이 5 · CPU 상한 80%", { size: 13, fill: C.paper });
    s += `<clipPath id="pemini"><rect x="${VX}" y="${VY}" width="${VW}" height="${VH}" rx="10"/></clipPath>` + g({ "clip-path": "url(#pemini)" }, mini);
    s += tag("rect", { x: VX, y: VY, width: VW, height: VH, rx: 10, fill: "none", stroke: C.ink, "stroke-width": 1.5 });
    const BX = 376;
    const BY = 166;
    const BH = 30;
    // 한 프레임 처리 시간(그림 길이). 합이 0.77 → 2.12 fps 비율(약 2.75배)이 되게 잡았다
    const PARTS = [
      { name: "하단면 모델", fill: C.lilac, w0: 120, w1: 58, fix: "INT8 · fp16", at: 3.35 },
      { name: "옛 검출기", fill: "#cfe3f3", w0: 90, w1: 28, fix: "1 스레드", at: 3.6 },
      { name: "화질 검사", fill: "#d4f2e1", w0: 45, w1: 8, fix: "정수 연산", at: 3.85 },
      { name: "디코더", fill: "#ffd8a8", w0: 40, w1: 12, fix: "연산 순서 변경", at: 4.1 },
      { name: "저장 · 기타", fill: C.mute, w0: 35, w1: 14, fix: "변할 때만 저장", at: 4.35 },
    ];
    const total0 = PARTS.reduce((a, p) => a + p.w0, 0);
    const grow = seg(lt, 0.7, 1.5, E.inOut);
    const split = seg(lt, 2.95, 0.4);
    s += text(BX, BY - 22, "한 프레임 처리 시간", { "font-size": 13.5, "font-weight": 700, fill: C.sub });
    if (grow > 0 && split < 1) s += tag("rect", { x: BX, y: BY, width: Math.max(BH, total0 * grow), height: BH, rx: 8, fill: "#f6c9cf", stroke: RED, "stroke-width": 1.8, opacity: 1 - split });
    s += chip(BX + total0, BY + BH + 22, "0.77 fps", { size: 13, fill: RED, color: C.paper, stroke: null, anchor: "end", opacity: seg(lt, 1.9, 0.3) * (1 - seg(lt, 2.75, 0.25, E.in)) });
    if (split > 0) {
      s += tag("rect", { x: BX, y: BY, width: total0, height: BH, rx: 8, fill: "none", stroke: C.wire, "stroke-width": 1.5, "stroke-dasharray": "5 4", opacity: split });
      let x = BX;
      let bar = "";
      let seams = "";
      PARTS.forEach((p, i) => {
        const w = lerp(p.w0, p.w1, seg(lt, p.at, 0.5, E.inOut));
        bar += tag("rect", { x, y: BY, width: w + 0.5, height: BH, fill: p.fill });
        x += w;
        if (i < PARTS.length - 1) seams += `M${n2(x)} ${BY}V${BY + BH}`;
      });
      const end = x;
      s += `<clipPath id="pebar"><rect x="${BX}" y="${BY}" width="${n2(end - BX)}" height="${BH}" rx="8"/></clipPath>`;
      s += g(
        { opacity: split },
        g({ "clip-path": "url(#pebar)" }, bar + tag("path", { d: seams, stroke: C.ink, "stroke-width": 1.2 })) +
          tag("rect", { x: BX, y: BY, width: end - BX, height: BH, rx: 8, fill: "none", stroke: C.ink, "stroke-width": 1.8 }),
      );
      s += chip(end + 12, BY + BH / 2, "2.12 fps", { size: 13.5, fill: C.lemon, opacity: seg(lt, 4.7, 0.3) });
      PARTS.forEach((p, i) => {
        const y = BY + 62 + i * 28;
        s += g(
          { opacity: split * seg(lt, 3.0 + i * 0.07, 0.3) },
          tag("rect", { x: BX, y: y - 8, width: 16, height: 16, rx: 4, fill: p.fill, stroke: C.ink, "stroke-width": 1.4 }) +
            text(BX + 26, y + 0.5, p.name, { "font-size": 14, "font-weight": 700, fill: C.ink }),
        );
        s += chip(BX + total0, y, p.fix, { size: 12, h: 22, pad: 8, fill: C.lemon, anchor: "end", opacity: seg(lt, p.at + 0.05, 0.3) });
      });
    }
    return s;
  }

  const plain = () => tag("rect", { x: 0, y: 0, width: W, height: H, fill: BG });

  function draw(t) {
    if (t < beats[1].at) return chapter1(t);
    if (t < beats[2].at) {
      const lt = t - beats[1].at;
      const m = seg(lt, 0.0, 0.7, E.lin);
      return dip(m, BG, () => chapter1(beats[1].at - 0.01), () => plain() + chapter2(lt));
    }
    const lt = t - beats[2].at;
    const m = seg(lt, 0.0, 0.6, E.lin);
    return dip(m, BG, () => plain() + chapter2(beats[2].at - beats[1].at - 0.01), () => plain() + chapter3(lt));
  }

  return { beats, duration, draw, bg: BG, poster: 4.6 };
})();
