// 2.5D 차량 하단면 검출: 높이 단 CCTV 로 본 주차 줄. 네 장(2D 상자 → 하단면, 가려진 꼭짓점 → CFQ, 보정값 → 보정 없이, 엣지 장비)
"use strict";
window.SCENE = (() => {
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
  const { cars, FOCUS, occupied, parts, footprint, hiddenCorner, world, spaceChip } = lot;
  const BG = lot.bg;
  const SHOW = [1, 6]; // 화면에 온전히 보이는 주차면
  const beats = [
    { at: 0, solve: 2.7 },
    { at: 5.3, solve: 2.9 },
    { at: 11.1, solve: 2.7 },
    { at: 16.4, solve: 2.8 },
  ];
  const duration = 22;

  function draw(t) {
    const RED = C.red;
    const GREEN = C.green;
    const st = { k: 0, zoom: 0, tint: [], fp: [0, 0, 0], box2d: null, dots: 0 };
    let over = "";

    // 1장: 2D 상자는 옆 칸까지 덮는다 → 하단면만 검출
    if (t < beats[1].at) {
      const lt = t;
      const out = 1 - seg(lt, 4.85, 0.4, E.in);
      st.box2d = [seg(lt, 0.55, 0.75, E.inOut), 1 - seg(lt, 2.75, 0.35, E.in)];
      const wrong = seg(lt, 1.3, 0.4) * out;
      const fix = seg(lt, 3.55, 0.5, E.inOut);
      st.tint[FOCUS] = [RED, 0.34 * wrong];
      st.tint[FOCUS + 1] = [mixColor(RED, GREEN, fix), 0.34 * wrong];
      st.fp[FOCUS] = seg(lt, 3.0, 0.55) * out;
      st.extra = (cam) =>
        spaceChip(cam, FOCUS, "점유?", C.paper, RED, seg(lt, 1.45, 0.35) * (1 - seg(lt, 2.75, 0.3, E.in))) +
        spaceChip(cam, FOCUS + 1, "점유?", C.paper, RED, seg(lt, 1.6, 0.35) * (1 - seg(lt, 2.75, 0.3, E.in))) +
        spaceChip(cam, FOCUS, "점유", RED, C.paper, seg(lt, 3.7, 0.35) * out) +
        spaceChip(cam, FOCUS + 1, "빈 칸", GREEN, C.paper, seg(lt, 3.85, 0.35) * out);
    }

    // 2장: 하단면은 대부분 가려진다(따로 맞힌 꼭짓점은 꼬인다) → 가려진 꼭짓점까지, 늘 볼록한 CFQ
    st.zoom = seg(t, beats[1].at + 0.05, 0.85, E.inOut) * (1 - seg(t, beats[2].at - 0.6, 0.75, E.inOut));
    if (t >= beats[1].at && t < beats[2].at) {
      const lt = t - beats[1].at;
      const out = 1 - seg(lt, 5.15, 0.4, E.in);
      const car = cars[FOCUS];
      st.extra = (cam) => {
        const { body } = parts(car);
        const ring = body.bottom;
        const faces = boxFaces(cam, body, car.color);
        const hc = hiddenCorner(cam, car);
        const red = 1 - seg(lt, 2.85, 0.3, E.in);
        let s = "";
        // 보이는 변은 먹 실선, 가려진 변은 빨간 점선
        for (let i = 0; i < 4; i++) {
          const d = dpath(cam.line(ring[i], ring[(i + 1) % 4]), false);
          if (faces[i].vis) s += drawOn(d, seg(lt, 0.95, 0.45), { stroke: C.ink, "stroke-width": 2.6, opacity: red });
          else s += tag("path", { d, fill: "none", stroke: C.red, "stroke-width": 2.4, "stroke-dasharray": "5 5", opacity: seg(lt, 1.35, 0.4) * red });
        }
        const hp = cam.P(ring[hc]);
        s += chip(hp[0] + 16, hp[1] - 14, "?", { size: 13, fill: C.paper, color: C.red, stroke: C.red, pad: 7, opacity: seg(lt, 1.55, 0.3) * red });
        // 꼭짓점을 따로 맞히면: 가려진 꼭짓점이 엉뚱한 데로 가 사각형이 꼬인다
        const guess = ring.map((p, i) => {
          const q = cam.P(p);
          return i === hc ? [q[0] - 58, q[1] + 34] : [q[0] + [3, -4, 5, -3][i], q[1] + [-3, 4, 2, -4][i]];
        });
        const bow = [guess[0], guess[1], guess[3], guess[2]];
        const bu = seg(lt, 1.95, 0.6, E.inOut);
        s += tag("path", { d: dpath(bow), fill: C.red, opacity: 0.16 * bu * red });
        s += drawOn(dpath(bow), bu, { stroke: C.red, "stroke-width": 2.4, opacity: red });
        guess.forEach((q, i) => {
          s += tag("circle", { cx: q[0], cy: q[1], r: 4, fill: C.red, opacity: seg(lt, 1.8 + i * 0.06, 0.25) * red });
        });
        const bc = mix2(guess[hc], guess[(hc + 1) % 4], 0.5);
        s += chip(bc[0] - 10, bc[1] + 30, "꼬인 사각형", { size: 12.5, fill: C.red, color: C.paper, stroke: null, anchor: "end", opacity: seg(lt, 2.45, 0.3) * red });

        // CFQ: 차의 축을 잡고 앞뒤 변의 폭으로 사각형을 짓는다
        const mid = (a, b) => v3.lerp(a, b, 0.5);
        const backC = mid(ring[0], ring[1]);
        const frontC = mid(ring[2], ring[3]);
        const ext = (a, b, u) => v3.lerp(a, b, u);
        const axisD = dpath(cam.line(ext(backC, frontC, -0.12), ext(backC, frontC, 1.12), 8), false);
        s += drawOn(axisD, seg(lt, 3.05, 0.55, E.inOut), { stroke: C.ink, "stroke-width": 2, "stroke-dasharray": seg(lt, 3.05, 0.55) >= 0.999 ? "7 6" : undefined, opacity: out });
        for (const [a, b] of [
          [ring[0], ring[1]],
          [ring[3], ring[2]],
        ]) {
          const c = mid(a, b);
          const u = seg(lt, 3.5, 0.45, E.inOut);
          s += tag("path", { d: dpath([cam.P(v3.lerp(c, a, u)), cam.P(v3.lerp(c, b, u))], false), stroke: C.ink, "stroke-width": 4.5, "stroke-linecap": "round", opacity: out * (u > 0 ? 1 : 0) });
        }
        s += footprint(cam, car, seg(lt, 3.9, 0.5) * out, { dots: seg(lt, 4.1, 0.3) });
        // 무엇으로 짓는지: 차량 축과 앞뒤 변
        const axEnd = cam.P(ext(backC, frontC, -0.2));
        s += chip(axEnd[0], axEnd[1] + 16, "차량 축", { size: 12.5, fill: C.paper, anchor: "middle", opacity: seg(lt, 3.35, 0.3) * out });
        const be = cam.P(ring[1]);
        s += chip(be[0] + 14, be[1] + 4, "앞뒤 변 폭·기울기", { size: 12.5, fill: C.paper, opacity: seg(lt, 3.75, 0.3) * out });
        const fc = cam.P(ring[2]);
        s += chip(fc[0] + 14, fc[1] + 4, "CFQ · 볼록 보장", { size: 13, fill: C.lemon, opacity: seg(lt, 4.35, 0.35) * out });
        return s;
      };
    }

    // 3장: 카메라마다 보정값이 필요하다 → 보정 없이 원본 영상에서 바로
    st.k = seg(t, beats[2].at + 0.25, 1.1, E.inOut);
    let panel = "";
    if (t >= beats[2].at) {
      const lt = t - beats[2].at;
      const on = t < beats[3].at + 1 ? 1 : 0;
      const shown = cars.map((c, i) => (c.space >= SHOW[0] && c.space <= SHOW[1] ? seg(lt, 3.0 + i * 0.14, 0.45) : 0));
      st.fp = shown;
      const occ = seg(lt, 3.6, 0.45);
      for (let i = SHOW[0]; i <= SHOW[1]; i++) st.tint[i] = [occupied(i) ? RED : GREEN, 0.3 * occ];
      if (on && lt < 4.2) {
        const pin = seg(lt, 0.85, 0.5) * (1 - seg(lt, 3.35, 0.4, E.in));
        const dx = (1 - seg(lt, 0.85, 0.5)) * 30 + seg(lt, 3.35, 0.4, E.in) * 30;
        const rows = ["초점거리", "카메라 높이", "어안 왜곡 계수"];
        let p = card(560, 92, 212, 150, { opacity: 1 });
        p += text(578, 116, "카메라별 보정값", { "font-size": 13.5, "font-weight": 700, fill: C.sub });
        rows.forEach((r, i) => {
          const y = 146 + i * 30;
          const a = seg(lt, 1.15 + i * 0.18, 0.3);
          p += g({ opacity: a }, text(578, y, r, { "font-size": 15.5, "font-weight": 700, fill: C.ink }) + chip(752, y, "?", { size: 13, fill: C.paper, color: C.red, stroke: C.red, pad: 7, anchor: "end" }));
          p += drawOn(`M572 ${y}H760`, seg(lt, 2.85 + i * 0.12, 0.3, E.inOut), { stroke: C.red, "stroke-width": 2.6 });
        });
        panel = g({ opacity: pin, transform: `translate(${n2(dx)} 0)` }, p);
      }
    }

    // 4장: 라즈베리파이에서 결과가 달라진다 → 실제 장비에서 채점, 지식 증류로 보완
    if (t >= beats[3].at) {
      const lt = t - beats[3].at;
      const m = seg(lt, 0.05, 0.75, E.lin);
      // 작은 화면: 주차 줄 가운데만 잘라 크게 본다
      const mini = (fp) => g({ transform: "scale(1.42) translate(-118 -112)" }, world({ ...st, fp, zoom: 0 }));
      const box = (x, label, fp, status) => {
        const w = 336;
        const y = 104;
        const sx = 308 / W;
        return (
          card(x, y, w, 290) +
          chip(x + 16, y + 26, label, { size: 13, fill: C.paper }) +
          `<clipPath id="mini${x}"><rect x="${x + 14}" y="${y + 48}" width="308" height="173.25" rx="10"/></clipPath>` +
          g({ "clip-path": `url(#mini${x})` }, g({ transform: `translate(${x + 14} ${y + 48}) scale(${n2(sx)})` }, mini(fp))) +
          tag("rect", { x: x + 14, y: y + 48, width: 308, height: 173.25, rx: 10, fill: "none", stroke: C.ink, "stroke-width": 1.5 }) +
          status
        );
      };
      const piGone = seg(lt, 1.15, 0.5, E.in);
      const piBack = seg(lt, 3.55, 0.45);
      const piFp = cars.map((c) => (c.space >= SHOW[0] && c.space <= SHOW[1] ? (1 - piGone) * (lt < 3 ? 1 : 0) + piBack : 0));
      const fp32 = chip(50, 360, "학습 모델", { size: 13, fill: C.paper });
      const bad = 1 - seg(lt, 2.85, 0.25, E.in);
      const piStatus =
        chip(446, 360, "fp16", { size: 13, fill: C.paper, color: C.red, stroke: C.red, opacity: seg(lt, 0.95, 0.3) * bad }) +
        chip(446 + chip.width("fp16") + 8, 360, "검출 소실", { size: 13, fill: C.red, color: C.paper, stroke: null, opacity: seg(lt, 1.75, 0.3) * bad }) +
        chip(446, 360, "INT8 · NCNN", { size: 13, fill: C.lemon, opacity: seg(lt, 3.2, 0.3) }) +
        g({ opacity: seg(lt, 4.0, 0.3) }, chip(446 + chip.width("INT8 · NCNN") + 8, 360, "실기기 채점 완료", { size: 13, fill: C.paper, pad: 9 }));
      const cards =
        box(34, "학습 GPU", cars.map((c) => (c.space >= SHOW[0] && c.space <= SHOW[1] ? 1 : 0)), fp32) +
        box(430, "라즈베리파이", piFp, piStatus) +
        drawOn("M378 236C392 214 408 214 422 236", seg(lt, 2.95, 0.45, E.inOut), { stroke: C.ink, "stroke-width": 2.6 }) +
        tag("path", { d: "M414.5 235l7.5 1.5 0.5-7.5", fill: "none", stroke: C.ink, "stroke-width": 2.6, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: seg(lt, 3.35, 0.15) }) +
        chip(400, 196, "지식 증류", { size: 13, fill: C.lemon, anchor: "middle", opacity: seg(lt, 3.05, 0.3) });
      return dip(m, BG, () => world(st), () => tag("rect", { x: 0, y: 0, width: W, height: H, fill: BG }) + cards);
    }
    return world(st) + over + panel;
  }

  return { beats, duration, draw, bg: BG, poster: 4.4 };
})();
