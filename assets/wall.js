// 걸린 봉지의 흔들림. 봉지마다 진자 하나이고, 모두 같은 박자(K, C)로 움직인다.
// 진열대가 길어 봉지가 스무 개 가까이 되므로, 화면에 보이는 봉지만 흔든다. 멈춘 봉지는 값을 다시 쓰지 않는다.
(() => {
  const packs = [...document.querySelectorAll("[data-sway]")];
  if (!packs.length || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const K = 42; // 되돌리는 힘
  const C = 3.4; // 잦아드는 정도
  // 처음 열 때는 첫 화면에 걸린 봉지만 살짝 흔들린 채로 시작한다. 이웃끼리 반대로, 폭은 0.6~1.8도.
  const bobs = packs.map((el, i) => ({
    el,
    angle: el.getBoundingClientRect().top < innerHeight ? (i % 2 ? 1 : -1) * (1.8 - (i % 5) * 0.3) : 0,
    speed: 0,
    shown: "",
    seen: true,
  }));
  let frame = 0;
  let last = 0;

  const step = (now) => {
    const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
    last = now;
    let moving = false;
    for (const bob of bobs) {
      if (!bob.angle && !bob.speed) continue;
      bob.speed += (-K * bob.angle - C * bob.speed) * dt;
      bob.angle += bob.speed * dt;
      if (Math.abs(bob.angle) > 0.01 || Math.abs(bob.speed) > 0.05) moving = true;
      else bob.angle = bob.speed = 0;
      const value = `${bob.angle.toFixed(3)}deg`;
      if (value !== bob.shown) {
        bob.shown = value;
        bob.el.style.setProperty("--sway", value);
      }
    }
    frame = moving ? requestAnimationFrame(step) : 0;
  };

  const wake = () => {
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(step);
  };

  const push = (bob, amount) => {
    bob.speed = Math.max(-60, Math.min(60, bob.speed + amount));
    wake();
  };

  for (const bob of bobs) {
    bob.el.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse") push(bob, (event.movementX < 0 ? -1 : 1) * 22);
    });
  }

  if ("IntersectionObserver" in window) {
    const byEl = new Map(bobs.map((bob) => [bob.el, bob]));
    const watch = new IntersectionObserver((entries) => {
      for (const entry of entries) byEl.get(entry.target).seen = entry.isIntersecting;
    });
    for (const bob of bobs) watch.observe(bob.el);
  }

  // 화면을 굴리면 보이는 봉지들이 굴린 쪽으로 흔들린다
  let lastY = scrollY;
  addEventListener(
    "scroll",
    () => {
      const delta = Math.max(-10, Math.min(10, (scrollY - lastY) * 0.2));
      lastY = scrollY;
      bobs.forEach((bob, i) => {
        if (bob.seen) push(bob, delta * (1 - (i % 5) * 0.12));
      });
    },
    { passive: true },
  );

  wake();
})();
