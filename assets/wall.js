// 걸린 봉지의 흔들림. 봉지마다 진자 하나이고, 모두 같은 박자(K, C)로 움직인다.
(() => {
  const packs = [...document.querySelectorAll("[data-sway]")];
  if (!packs.length || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const K = 42; // 되돌리는 힘
  const C = 3.4; // 잦아드는 정도
  const bobs = packs.map((el, i) => ({ el, angle: (i % 2 ? 1 : -1) * (1.8 - i * 0.3), speed: 0 }));
  let frame = 0;
  let last = 0;

  const step = (now) => {
    const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
    last = now;
    let moving = false;
    for (const bob of bobs) {
      bob.speed += (-K * bob.angle - C * bob.speed) * dt;
      bob.angle += bob.speed * dt;
      if (Math.abs(bob.angle) > 0.01 || Math.abs(bob.speed) > 0.05) moving = true;
      else bob.angle = bob.speed = 0;
      bob.el.style.setProperty("--sway", `${bob.angle.toFixed(3)}deg`);
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

  let lastY = scrollY;
  addEventListener(
    "scroll",
    () => {
      const delta = Math.max(-10, Math.min(10, (scrollY - lastY) * 0.2));
      lastY = scrollY;
      bobs.forEach((bob, i) => push(bob, delta * (1 - i * 0.12)));
    },
    { passive: true },
  );

  wake();
})();
