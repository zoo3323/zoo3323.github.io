// 포켓펫 꺼내 보기: 고른 동물이 이 화면 아래쪽을 걷고, 쉬고, 끌려가고, 던져진다.
// 그림은 앱에 든 스프라이트 그대로다(한 칸 192x208, 줄: 쉬기 6 · 오른쪽 8 · 왼쪽 8 · 인사 4 · 뛰기 5).
(() => {
  const demo = document.querySelector("[data-pet-demo]");
  if (!demo) return;

  const stage = demo.querySelector("[data-pet-stage]");
  const nameEl = demo.querySelector("[data-pet-name]");
  const kindEl = demo.querySelector("[data-pet-kind]");
  const toggle = demo.querySelector("[data-pet-toggle]");
  const picks = [...demo.querySelectorAll("[data-pet]")];
  const base = demo.dataset.petDemo;

  const W = 96;
  const H = 104;
  const ROWS = { idle: [0, 6], right: [1, 8], left: [2, 8], wave: [3, 4], jump: [4, 5] };
  const WALK = 64; // 걷는 빠르기(px/초)
  const GRAVITY = 2400;
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  let current = picks.find((pick) => pick.getAttribute("aria-pressed") === "true") || picks[0];
  let roamer = null;
  let pet = null;
  let frame = 0;
  let last = 0;

  const atlas = (id) => `${base}atlas/${id}.webp`;

  const show = (pick) => {
    current = pick;
    for (const other of picks) other.setAttribute("aria-pressed", String(other === pick));
    const { pet: id, breed, kind, style, stage: hasStage } = pick.dataset;
    stage.dataset.style = style;
    stage.src = hasStage === "true" ? `${base}stage/${id}.webp` : `${base}thumb/${id}.webp`;
    stage.width = hasStage === "true" ? 576 : 192;
    stage.height = hasStage === "true" ? 624 : 208;
    stage.alt = `${breed} 그림`;
    nameEl.textContent = breed;
    kindEl.textContent = kind;
    if (roamer) dress();
  };

  const dress = () => {
    const url = atlas(current.dataset.pet);
    const image = new Image();
    image.onload = () => {
      if (roamer) roamer.style.backgroundImage = `url("${url}")`;
    };
    image.src = url;
    roamer.setAttribute("aria-label", `화면 위에 나온 ${current.dataset.breed}`);
  };

  const pose = (row, index) => {
    roamer.style.backgroundPosition = `${-index * W}px ${-ROWS[row][0] * H}px`;
  };

  const place = () => {
    roamer.style.transform = `translate3d(${pet.x.toFixed(1)}px, ${(-pet.alt).toFixed(1)}px, 0)`;
  };

  const rest = () => {
    pet.mode = "idle";
    pet.clock = 0;
    pet.wait = 1.6 + Math.random() * 3.2;
  };

  const tick = (now) => {
    const dt = Math.min(0.034, (now - last) / 1000 || 0.016);
    last = now;
    const maxX = Math.max(0, innerWidth - W);
    pet.clock += dt;

    if (pet.mode === "idle") {
      // 가끔 눈을 깜빡인다
      const blink = pet.clock % 3.4;
      pose("idle", blink > 3 ? Math.min(5, Math.floor((blink - 3) / 0.07)) : 0);
      if (!still.matches && pet.clock > pet.wait) {
        pet.mode = "walk";
        pet.clock = 0;
        pet.target = Math.random() * maxX;
      }
    } else if (pet.mode === "walk") {
      const dir = pet.target > pet.x ? 1 : -1;
      pet.x += dir * WALK * dt;
      pose(dir > 0 ? "right" : "left", Math.floor(pet.clock * 10) % 8);
      if ((pet.target - pet.x) * dir <= 0) rest();
    } else if (pet.mode === "wave") {
      pose("wave", Math.floor(pet.clock * 6) % 4);
      if (pet.clock > 1.3) rest();
    } else if (pet.mode === "fall") {
      pet.vy -= GRAVITY * dt;
      pet.x += pet.vx * dt;
      pet.alt += pet.vy * dt;
      if (pet.x < 0 || pet.x > maxX) {
        pet.x = Math.max(0, Math.min(maxX, pet.x));
        pet.vx *= -0.55;
      }
      pose("jump", pet.vy > 0 ? 1 : 3);
      if (pet.alt <= 0) {
        pet.alt = 0;
        if (pet.vy < -420) {
          pet.vy *= -0.32;
          pet.vx *= 0.6;
        } else rest();
      }
    } else if (pet.mode === "held") {
      pose("jump", 2);
    }

    pet.x = Math.max(0, Math.min(maxX, pet.x));
    place();
    frame = requestAnimationFrame(tick);
  };

  const run = () => {
    if (frame || !roamer || document.hidden) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  };

  const halt = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };

  const grab = (event) => {
    event.preventDefault();
    roamer.setPointerCapture(event.pointerId);
    const start = { x: event.clientX, y: event.clientY, moved: false };
    const offset = { x: event.clientX - pet.x, y: event.clientY - (innerHeight - H - pet.alt) };
    let trail = [{ x: event.clientX, y: event.clientY, t: performance.now() }];
    pet.mode = "held";

    const move = (e) => {
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) start.moved = true;
      pet.x = e.clientX - offset.x;
      pet.alt = Math.max(0, innerHeight - H - (e.clientY - offset.y));
      trail.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (trail.length > 5) trail = trail.slice(-5);
    };
    const drop = () => {
      roamer.removeEventListener("pointermove", move);
      roamer.removeEventListener("pointerup", drop);
      roamer.removeEventListener("pointercancel", drop);
      if (!start.moved) {
        pet.mode = "wave";
        pet.clock = 0;
        return;
      }
      if (still.matches) {
        pet.alt = 0;
        rest();
        return;
      }
      const a = trail[0];
      const b = trail[trail.length - 1];
      const span = Math.max(0.016, (b.t - a.t) / 1000);
      pet.vx = Math.max(-1600, Math.min(1600, (b.x - a.x) / span));
      pet.vy = Math.max(-1600, Math.min(1600, -(b.y - a.y) / span));
      pet.mode = "fall";
    };
    roamer.addEventListener("pointermove", move);
    roamer.addEventListener("pointerup", drop);
    roamer.addEventListener("pointercancel", drop);
  };

  const start = () => {
    roamer = document.createElement("div");
    roamer.className = "roamer";
    roamer.setAttribute("role", "img");
    document.body.append(roamer);
    const from = stage.getBoundingClientRect();
    pet = {
      x: Math.max(0, Math.min(innerWidth - W, from.left + from.width / 2 - W / 2)),
      alt: still.matches ? 0 : Math.max(0, innerHeight - from.bottom),
      vx: 0,
      vy: 0,
      mode: still.matches ? "idle" : "fall",
      clock: 0,
      wait: 2,
      target: 0,
    };
    dress();
    pose("idle", 0);
    place();
    roamer.addEventListener("pointerdown", grab);
    toggle.setAttribute("aria-pressed", "true");
    toggle.querySelector("[data-label]").textContent = "넣기";
    run();
  };

  const stop = () => {
    halt();
    roamer.remove();
    roamer = pet = null;
    toggle.setAttribute("aria-pressed", "false");
    toggle.querySelector("[data-label]").textContent = "꺼내 보기";
  };

  for (const pick of picks) pick.addEventListener("click", () => show(pick));
  toggle.addEventListener("click", () => (roamer ? stop() : start()));
  // 앱에서처럼 화면이 가려지면 쉰다
  document.addEventListener("visibilitychange", () => (document.hidden ? halt() : run()));
})();
