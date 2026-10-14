// 빛. 마우스는 벽 앞에 든 작은 등이다.
// 등 가까이의 구멍은 깊어 보이고, 걸린 봉지의 그림자는 등 반대쪽으로 진다.
// 봉지에 손을 대면 고리를 축으로 살짝 돌며 앞으로 나오고, 비닐 위로 빛과 옅은 무지개 결이 번진다.
// 봉지에 손이 가 있는 동안 벽의 등빛은 거의 꺼진다(봉지 하나에만 눈이 가게).
(() => {
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  if (!fine.matches || still.matches) return;

  const root = document.documentElement;
  const lamp = { x: 0, y: 0, tx: 0, ty: 0, lit: 0, tlit: 0, placed: false };
  let touching = 0; // 손이 올라가 있는 봉지 수
  const LIT_ON_CARD = 0.08;
  const cards = [...document.querySelectorAll(".pack")].map((el) => ({
    el,
    rx: 0, ry: 0, trx: 0, try_: 0,
    gx: 50, gy: 50, tgx: 50, tgy: 50,
    lift: 0, tlift: 0,
    cx: 0, cy: 0, box: null,
  }));

  const measure = () => {
    for (const card of cards) {
      const r = card.el.getBoundingClientRect();
      card.cx = r.left + r.width / 2 + scrollX;
      card.cy = r.top + r.height / 2 + scrollY;
    }
  };

  let frame = 0;
  let last = 0;
  const near = (a, b) => Math.abs(a - b) < 0.01;

  const step = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    const k = 1 - Math.exp(-dt * 11); // 따라가는 빠르기(초당)
    let moving = false;

    lamp.x += (lamp.tx - lamp.x) * k;
    lamp.y += (lamp.ty - lamp.y) * k;
    lamp.lit += (lamp.tlit - lamp.lit) * k;
    if (!near(lamp.x, lamp.tx) || !near(lamp.y, lamp.ty) || !near(lamp.lit, lamp.tlit)) moving = true;
    root.style.setProperty("--mx", `${lamp.x.toFixed(1)}px`);
    root.style.setProperty("--my", `${lamp.y.toFixed(1)}px`);
    root.style.setProperty("--lit", lamp.lit.toFixed(3));

    for (const card of cards) {
      card.rx += (card.trx - card.rx) * k;
      card.ry += (card.try_ - card.ry) * k;
      card.gx += (card.tgx - card.gx) * k;
      card.gy += (card.tgy - card.gy) * k;
      card.lift += (card.tlift - card.lift) * k;
      if (!near(card.rx, card.trx) || !near(card.ry, card.try_) || !near(card.lift, card.tlift)) moving = true;
      const shx = Math.max(-16, Math.min(16, (card.cx - lamp.x) * 0.03)) * lamp.lit;
      const shy = Math.max(-8, Math.min(14, (card.cy - lamp.y) * 0.022)) * lamp.lit;
      const s = card.el.style;
      s.setProperty("--rx", `${card.rx.toFixed(2)}deg`);
      s.setProperty("--ry", `${card.ry.toFixed(2)}deg`);
      s.setProperty("--lift", card.lift.toFixed(3));
      s.setProperty("--gx", `${card.gx.toFixed(1)}%`);
      s.setProperty("--gy", `${card.gy.toFixed(1)}%`);
      s.setProperty("--hx", card.gx.toFixed(1));
      s.setProperty("--hy", card.gy.toFixed(1));
      s.setProperty("--shx", `${shx.toFixed(1)}px`);
      s.setProperty("--shy", `${shy.toFixed(1)}px`);
    }
    frame = moving ? requestAnimationFrame(step) : 0;
  };

  const wake = () => {
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(step);
  };

  addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType !== "mouse") return;
      lamp.tx = event.clientX + scrollX;
      lamp.ty = event.clientY + scrollY;
      if (!lamp.placed) {
        lamp.x = lamp.tx;
        lamp.y = lamp.ty;
        lamp.placed = true;
      }
      lamp.tlit = touching ? LIT_ON_CARD : 1;
      wake();
    },
    { passive: true },
  );
  document.addEventListener("mouseleave", () => {
    lamp.tlit = 0;
    wake();
  });
  // 화면을 굴려도 등은 손에 든 자리에 그대로 있다
  let lastY = scrollY;
  addEventListener(
    "scroll",
    () => {
      lamp.ty += scrollY - lastY;
      lamp.y += scrollY - lastY;
      lastY = scrollY;
      wake();
    },
    { passive: true },
  );
  addEventListener("resize", () => {
    measure();
    wake();
  });

  for (const card of cards) {
    const { el } = card;
    el.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "mouse") return;
      card.box = el.getBoundingClientRect();
      touching += 1;
      lamp.tlit = LIT_ON_CARD;
      wake();
    });
    el.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      const box = card.box || el.getBoundingClientRect();
      const px = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
      const py = Math.max(0, Math.min(1, (event.clientY - box.top) / box.height));
      card.try_ = (px - 0.5) * 10;
      card.trx = (0.5 - py) * 8;
      card.tgx = px * 100;
      card.tgy = py * 100;
      card.tlift = 1;
      wake();
    });
    el.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "mouse") return;
      card.box = null;
      touching = Math.max(0, touching - 1);
      if (!touching) lamp.tlit = 1;
      card.trx = card.try_ = 0;
      card.tgx = card.tgy = 50;
      card.tlift = 0;
      wake();
    });
  }

  measure();
  addEventListener("load", measure);
})();
