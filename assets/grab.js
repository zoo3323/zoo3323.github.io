// 옆으로 미는 줄을 마우스로 잡아 끈다. 진열대 줄(.hooks)과 앱 화면 줄(.shots)이 대상이다.
// 손가락·트랙패드는 원래대로 밀고, 이 파일은 마우스만 맡는다. 넘치는 줄에서만 편 손 커서이고, 끄는 동안은 쥔 손이다.
// 던지면 관성으로 미끄러진다: 놓은 순간의 빠르기 그대로 출발해 서서히 느려지고, 그 빠르기로 갈 만큼 간 근처의
//   멈춤 자리(물건의 시작)에 정확히 선다. 진열대 줄에서는 그 자리가 곧 고리의 두 다리가 벽 구멍에 꽂히는 자리다.
//   끄는 동안과 미끄러지는 동안에는 scroll-snap 을 끄고, 서면 되살린다.
// 줄이 움직이는 동안(끄는 중·미끄러지는 중)에는 줄 안의 봉지·그림이 누르기를 받지 않는다. 그래서 던지고 손을 떼도,
//   미끄러지는 줄을 눌러 세워도 카드가 열리지 않는다. 끌지 않고 가만히 누르면 원래대로 열린다.
(() => {
  const scrollers = [...document.querySelectorAll(".hooks, .shots")];
  if (!scrollers.length) return;
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const START = 5; // 이만큼(px) 움직여야 끌기로 본다. 그 전에 놓으면 그냥 누르기다
  const GLIDE = 380; // 관성: 빠르기가 이 시간(ms)마다 e 분의 1 로 준다. 미끄러지는 거리 ≈ 놓은 빠르기 × 이 시간
  const FLING = 0.12; // 이보다 느리게(px/ms) 놓으면 던진 게 아니라 내려놓은 것: 가장 가까운 자리로 들어간다
  const root = document.documentElement;
  // 손 커서 그림은 처음 잡는 순간에 받으면 한 번 기본 손이 보이므로 미리 받아 둔다
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    const r = devicePixelRatio > 1 ? "@2x" : "";
    for (const name of ["open", "fist"]) new Image().src = `/assets/cursor/${name}${r}.png`;
  }

  // 끈 뒤에 오는 누르기를 막는다. 브라우저마다 누르기가 오는 때가 달라, 다음에 새로 누를 때(또는 1초)까지 기다린다.
  let unswallow = null;
  const swallow = () => {
    if (unswallow) return;
    const stop = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      unswallow();
    };
    const timer = setTimeout(() => unswallow(), 1000);
    unswallow = () => {
      removeEventListener("click", stop, true);
      removeEventListener("pointerdown", unswallow, true);
      clearTimeout(timer);
      unswallow = null;
    };
    addEventListener("click", stop, true);
    addEventListener("pointerdown", unswallow, true);
  };

  for (const el of scrollers) {
    const items = el.matches(".hooks") ? () => el.querySelectorAll(".peg") : () => el.children;
    const mark = () => el.classList.toggle("is-grabbable", el.scrollWidth - el.clientWidth > 1);
    if ("ResizeObserver" in window) new ResizeObserver(mark).observe(el);
    addEventListener("load", mark);
    mark();

    // 멈춤 자리: 물건의 왼쪽 끝이 scroll-padding 만큼 들어온 곳. 끝을 넘는 자리는 끝으로 모은다(브라우저의 scroll-snap 과 같다).
    const stops = () => {
      const box = el.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0;
      const end = el.scrollWidth - el.clientWidth;
      return [...items()].map((item) =>
        Math.max(0, Math.min(end, el.scrollLeft + item.getBoundingClientRect().left - box.left - el.clientLeft - pad)),
      );
    };
    const nearest = (list, x) => list.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));

    // 빠르기 v(px/ms, 스크롤 방향)로 놓았을 때 설 자리. 던졌으면 가는 쪽의 자리 가운데 관성으로 닿을 곳에 가장 가까운 것.
    const target = (v) => {
      const spots = stops();
      const x = el.scrollLeft;
      if (!spots.length) return x;
      if (Math.abs(v) < FLING) return nearest(spots, x);
      const ahead = spots.filter((s) => (v > 0 ? s > x + 0.5 : s < x - 0.5));
      if (!ahead.length) return v > 0 ? Math.max(...spots) : Math.min(...spots);
      return nearest(ahead, x + v * GLIDE);
    };

    let press = null; // 누른 순간의 자리와 최근 움직임
    let frame = 0; // 미끄러지는 중이면 다음 그림 번호
    let lastSet = 0; // 마지막으로 넣은 scrollLeft. 다른 것이 줄을 움직였는지 보는 데 쓴다

    // 움직임이 끝나면 scroll-snap 과 카드의 누르기를 되돌린다(누르기는 다음 그림에서: 이번 손떼기의 누르기가 먼저 지나가게)
    const rest = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      el.style.removeProperty("scroll-snap-type");
      requestAnimationFrame(() => {
        if (!frame && !press?.moving) el.classList.remove("is-moving");
      });
    };

    // 지금 자리에서 to 까지, 처음 빠르기 v 로 출발해 지수로 느려지며 간다(시간 상수의 K 배에서 끝: 끝 빠르기는 처음의 2%).
    // 시간 상수는 놓은 빠르기와 이어지게 정하고, 너무 짧거나 길면 자른다. v 가 없으면 짧게 들어간다.
    const K = 4;
    const glide = (to, v) => {
      if (frame) cancelAnimationFrame(frame);
      const from = el.scrollLeft;
      const gap = to - from;
      if (Math.abs(gap) < 0.5 || still.matches) {
        el.scrollLeft = to;
        rest();
        return;
      }
      const norm = 1 - Math.exp(-K);
      const tau = v && Math.sign(v) === Math.sign(gap) ? Math.max(70, Math.min(420, gap / (v * norm))) : 100;
      const span = tau * K;
      const begin = performance.now();
      lastSet = from;
      const step = (now) => {
        // 휠·트랙패드·화살표 단추가 줄을 움직였으면 손을 뗀다
        if (Math.abs(el.scrollLeft - lastSet) > 2) {
          frame = 0;
          rest();
          return;
        }
        const u = Math.min(1, (now - begin) / span);
        if (u >= 1) {
          el.scrollLeft = to;
          frame = 0;
          rest();
          return;
        }
        el.scrollLeft = from + (gap * (1 - Math.exp(-K * u))) / norm;
        lastSet = el.scrollLeft;
        frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    el.addEventListener("dragstart", (event) => {
      if (el.classList.contains("is-grabbable")) event.preventDefault();
    });
    el.addEventListener(
      "wheel",
      () => {
        if (frame) rest();
      },
      { passive: true },
    );

    el.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0 || !el.classList.contains("is-grabbable")) return;
      if (event.target.closest("video, input, textarea, select")) return;
      // 미끄러지던 줄을 누르면 그 자리에 세운다(누르기로 치지 않는다)
      const caught = Boolean(frame);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      press = { id: event.pointerId, x: event.clientX, left: el.scrollLeft, moving: false, caught, trail: [] };
    });

    el.addEventListener("pointermove", (event) => {
      if (!press || event.pointerId !== press.id) return;
      const dx = event.clientX - press.x;
      if (!press.moving) {
        if (Math.abs(dx) < START) return;
        press.moving = true;
        press.left = el.scrollLeft + dx;
        el.style.scrollSnapType = "none";
        el.classList.add("is-grabbing", "is-moving");
        root.classList.add("is-grabbing");
        try {
          el.setPointerCapture(event.pointerId);
        } catch {}
      }
      el.scrollLeft = press.left - dx;
      const samples = event.getCoalescedEvents ? event.getCoalescedEvents() : [];
      for (const e of samples.length ? samples : [event]) press.trail.push([e.timeStamp, e.clientX]);
      while (press.trail.length > 2 && event.timeStamp - press.trail[0][0] > 80) press.trail.shift();
    });

    const end = (event) => {
      if (!press || event.pointerId !== press.id) return;
      const { moving, caught, trail } = press;
      press = null;
      if (!moving) {
        // 미끄러지던 줄을 눌러 세웠으면 누르기를 막고 가까운 자리로 들어간다
        if (caught) {
          if (event.type === "pointerup") swallow();
          glide(target(0), 0);
        }
        return;
      }
      el.classList.remove("is-grabbing");
      root.classList.remove("is-grabbing");
      if (event.type === "pointerup") swallow();

      // 놓기 직전 80ms 의 빠르기(멈췄다 놓았으면 0)로 관성을 정한다. 손이 오른쪽으로 가면 줄은 왼쪽으로 간다.
      const [t0, x0] = trail[0];
      const [t1, x1] = trail[trail.length - 1];
      const hand = event.timeStamp - t1 < 50 && t1 > t0 ? (x1 - x0) / (t1 - t0) : 0;
      const v = Math.max(-8, Math.min(8, -hand));
      glide(target(v), Math.abs(v) < FLING ? 0 : v);
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("lostpointercapture", end);
  }
})();
