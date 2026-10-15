// 빛. 마우스가 있으면 마우스가, 폰에서는 폰의 기울기가 빛을 움직인다.
//
// 마우스: 마우스는 벽 앞에 든 작은 등이다. 등 가까이의 구멍은 깊어 보이고, 걸린 봉지의 그림자는 등 반대쪽으로 진다.
//   봉지에 손을 대면 고리를 축으로 살짝 돌며 앞으로 나오고, 비닐 위로 빛과 옅은 무지개 결이 번진다.
//   봉지에 손이 가 있는 동안 벽의 등빛은 거의 꺼진다(봉지 하나에만 눈이 가게).
// 기울기(안드로이드 폰): 폰을 기울이면 걸린 봉지들이 그만큼 살짝 돌고, 반사와 무지개 결이 기운 쪽으로 흐른다.
//   들고 있는 자세가 곧 가운데라서, 가만히 들고 있으면 빛은 천천히 사라진다. 벽의 등빛은 쓰지 않는다.
//   허락 창은 띄우지 않는다. 허락이 있어야 기울기를 주는 아이폰에서는 그래서 이 효과가 없다.
(() => {
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  if (still.matches) return;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const settled = (a, b) => Math.abs(a - b) < 0.01;

  // ── 폰의 기울기 ──
  const tilt = () => {
    const packs = [...document.querySelectorAll(".pack")];
    if (!packs.length || !("DeviceOrientationEvent" in window)) return;
    // 허락을 묻지 않는다. 허락이 있어야 신호가 오는 폰(아이폰)에서는 신호가 오지 않으니 아무 일도 없다.

    const RANGE = 18; // 이만큼(도) 기울이면 끝까지 돈다
    const SETTLE = 1.4; // 들고 있는 자세를 새 가운데로 받아들이는 시간(초)
    let base = null;
    let lastT = 0;
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let frame = 0;
    let last = 0;

    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      const k = 1 - Math.exp(-dt * 9);
      x += (tx - x) * k;
      y += (ty - y) * k;
      const lift = Math.min(1, Math.hypot(x, y)) * 0.85;
      for (const el of packs) {
        const s = el.style;
        s.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
        s.setProperty("--ry", `${(x * 8).toFixed(2)}deg`);
        s.setProperty("--lift", lift.toFixed(3));
        s.setProperty("--gx", `${(50 + x * 45).toFixed(1)}%`);
        s.setProperty("--gy", `${(50 + y * 45).toFixed(1)}%`);
        s.setProperty("--hx", (50 + x * 45).toFixed(1));
        s.setProperty("--hy", (50 + y * 45).toFixed(1));
        s.setProperty("--shx", `${(x * 7).toFixed(1)}px`);
      }
      frame = settled(x, tx) && settled(y, ty) ? 0 : requestAnimationFrame(step);
    };
    const wake = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(step);
    };

    addEventListener("deviceorientation", (event) => {
      if (event.beta == null || event.gamma == null) return;
      let b = event.beta;
      let g = event.gamma;
      // 가로로 돌려 쥐면 축이 바뀐다
      const angle = (screen.orientation && screen.orientation.angle) || 0;
      if (angle === 90) [b, g] = [-g, b];
      else if (angle === 270) [b, g] = [g, -b];
      else if (angle === 180) [b, g] = [-b, -g];

      const t = event.timeStamp / 1000;
      if (!base) {
        base = { b, g };
        lastT = t;
        return;
      }
      const a = 1 - Math.exp(-clamp(t - lastT, 0, 0.2) / SETTLE);
      lastT = t;
      base.b += (b - base.b) * a;
      base.g += (g - base.g) * a;
      const nx = clamp((g - base.g) / RANGE, -1, 1);
      const ny = clamp((b - base.b) / RANGE, -1, 1);
      // 손떨림만큼의 작은 흔들림으로는 다시 그리지 않는다
      if (Math.abs(nx - tx) < 0.01 && Math.abs(ny - ty) < 0.01) return;
      tx = nx;
      ty = ny;
      wake();
    });
    // 다른 앱에 갔다 오면 그때 쥔 자세를 새 가운데로 삼는다
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) base = null;
    });
  };

  if (!fine.matches) {
    tilt();
    return;
  }

  // ── 마우스 ──
  // 등은 등 크기의 층 하나다. 따라갈 때는 다시 그리지 않고 자리(transform)와 밝기(opacity)만 바꾼다.
  // 예전처럼 페이지 전체 크기의 층을 마우스가 움직일 때마다 다시 그리면, 펫을 끌어 던질 때 프레임이 반으로 줄었다.
  const shade = document.createElement("div");
  shade.className = "lamp";
  shade.setAttribute("aria-hidden", "true");
  shade.innerHTML = '<div class="lamp__light"><div class="lamp__pit"><div class="lamp__holes"></div></div><div class="lamp__glow"></div></div>';
  document.body.append(shade);
  const light = shade.firstElementChild;
  const pit = light.firstElementChild;
  const holes = pit.firstElementChild;
  // 벽의 구멍 자리: 가로는 body 가운데에서, 세로는 body 위에서 p 간격(--p)으로 놓인다
  const grid = { left: 0, top: 0, mid: 0, r: 0, p: 1 };
  const mod = (a, n) => ((a % n) + n) % n;

  const lamp = { x: 0, y: 0, tx: 0, ty: 0, lit: 0, tlit: 0, placed: false };
  let touching = 0; // 손이 올라가 있는 봉지 수
  const LIT_ON_CARD = 0.08;
  const cards = [...document.querySelectorAll(".pack")].map((el) => ({
    el,
    rx: 0, ry: 0, trx: 0, try_: 0,
    gx: 50, gy: 50, tgx: 50, tgy: 50,
    lift: 0, tlift: 0,
    cx: 0, cy: 0, box: null,
    css: {}, // 마지막으로 쓴 값. 같으면 다시 쓰지 않는다
  }));
  const put = (card, name, value) => {
    if (card.css[name] === value) return;
    card.css[name] = value;
    card.el.style.setProperty(name, value);
  };
  // 화면 밖의 봉지는 등이 움직여도 그림자를 다시 계산하지 않는다(진열대가 길어 봉지가 스무 개 가까이 된다).
  // 화면에 들어오면 그때 한 번 맞춘다.
  if ("IntersectionObserver" in window) {
    const byEl = new Map(cards.map((card) => [card.el, card]));
    const watch = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) byEl.get(entry.target).seen = entry.isIntersecting;
        wake();
      },
      { rootMargin: "120px 0px" },
    );
    for (const card of cards) {
      card.seen = false;
      watch.observe(card.el);
    }
  }

  const measure = () => {
    const body = document.body.getBoundingClientRect();
    grid.left = body.left + scrollX;
    grid.top = body.top + scrollY;
    grid.mid = body.width / 2;
    grid.r = pit.getBoundingClientRect().width / 2;
    grid.p = holes.getBoundingClientRect().width - grid.r * 2 || 1;
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
    const x = Math.round((lamp.x - grid.left) * 10) / 10;
    const y = Math.round((lamp.y - grid.top) * 10) / 10;
    light.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    light.style.opacity = lamp.lit.toFixed(3);
    holes.style.transform = `translate3d(${(-mod(x - grid.r - grid.mid, grid.p)).toFixed(2)}px, ${(-mod(y - grid.r, grid.p)).toFixed(2)}px, 0)`;

    for (const card of cards) {
      if (card.seen === false) continue;
      card.rx += (card.trx - card.rx) * k;
      card.ry += (card.try_ - card.ry) * k;
      card.gx += (card.tgx - card.gx) * k;
      card.gy += (card.tgy - card.gy) * k;
      card.lift += (card.tlift - card.lift) * k;
      if (!near(card.rx, card.trx) || !near(card.ry, card.try_) || !near(card.lift, card.tlift)) moving = true;
      const shx = Math.max(-16, Math.min(16, (card.cx - lamp.x) * 0.03)) * lamp.lit;
      const shy = Math.max(-8, Math.min(14, (card.cy - lamp.y) * 0.022)) * lamp.lit;
      put(card, "--rx", `${card.rx.toFixed(2)}deg`);
      put(card, "--ry", `${card.ry.toFixed(2)}deg`);
      put(card, "--lift", card.lift.toFixed(3));
      put(card, "--gx", `${card.gx.toFixed(1)}%`);
      put(card, "--gy", `${card.gy.toFixed(1)}%`);
      put(card, "--hx", card.gx.toFixed(1));
      put(card, "--hy", card.gy.toFixed(1));
      put(card, "--shx", `${shx.toFixed(1)}px`);
      put(card, "--shy", `${shy.toFixed(1)}px`);
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
  // 진열대 줄을 옆으로 밀면 봉지 자리가 바뀌므로 그림자 방향을 다시 잰다
  for (const row of document.querySelectorAll(".hooks")) {
    row.addEventListener(
      "scroll",
      () => {
        measure();
        wake();
      },
      { passive: true },
    );
  }

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
