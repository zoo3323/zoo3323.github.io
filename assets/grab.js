// 옆으로 미는 줄을 마우스로 잡아 끈다. 진열대 줄(.hooks)과 앱 화면 줄(.shots)이 대상이다.
// 손가락·트랙패드는 원래대로 밀고, 이 파일은 마우스만 맡는다. 넘치는 줄에서만 손 모양(grab)이 되고, 끄는 동안은 쥔 손(grabbing)이다.
// 끄는 동안에는 scroll-snap 을 잠시 끈다. 놓으면 던진 빠르기만큼 더 가서 가장 가까운 멈춤 자리(물건의 시작)로 부드럽게 들어가고,
//   그 자리에 닿으면 scroll-snap 을 되살린다. 진열대 줄에서는 그 자리가 곧 고리의 두 다리가 벽 구멍에 꽂히는 자리다.
// 조금이라도 끌었으면 놓을 때의 누르기(링크 이동·크게 보기)는 막는다. 끌지 않고 누르면 원래대로 간다.
(() => {
  const scrollers = [...document.querySelectorAll(".hooks, .shots")];
  if (!scrollers.length) return;
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const START = 5; // 이만큼(px) 움직여야 끌기로 본다. 그 전에 놓으면 그냥 누르기다
  const THROW = 200; // 놓을 때의 빠르기(px/ms)에 이 시간(ms)을 곱한 만큼 더 간다
  const root = document.documentElement;
  // 손 커서 그림은 처음 잡는 순간에 받으면 한 번 기본 손이 보이므로 미리 받아 둔다
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    const r = devicePixelRatio > 1 ? "@2x" : "";
    for (const name of ["open", "fist"]) new Image().src = `/assets/cursor/${name}${r}.png`;
  }

  // 다음 한 번의 누르기를 막는다(끈 뒤 손을 뗀 자리의 링크·단추). 누르기가 안 오면 곧 푼다.
  const swallow = () => {
    const stop = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    addEventListener("click", stop, { capture: true, once: true });
    setTimeout(() => removeEventListener("click", stop, { capture: true }), 0);
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

    let press = null; // 누른 순간의 자리와 최근 움직임
    let settle = null; // 놓은 뒤 들어가는 멈춤 자리 { to, timer }

    const settled = () => {
      if (settle) clearTimeout(settle.timer);
      settle = null;
      el.style.removeProperty("scroll-snap-type");
    };
    el.addEventListener(
      "scroll",
      () => {
        if (settle && Math.abs(el.scrollLeft - settle.to) < 1) settled();
      },
      { passive: true },
    );

    el.addEventListener("dragstart", (event) => {
      if (el.classList.contains("is-grabbable")) event.preventDefault();
    });

    el.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0 || !el.classList.contains("is-grabbable")) return;
      if (event.target.closest("video, input, textarea, select")) return;
      press = { id: event.pointerId, x: event.clientX, left: el.scrollLeft, moving: false, trail: [] };
    });

    el.addEventListener("pointermove", (event) => {
      if (!press || event.pointerId !== press.id) return;
      const dx = event.clientX - press.x;
      if (!press.moving) {
        if (Math.abs(dx) < START) return;
        press.moving = true;
        // 들어가던 중에 다시 잡으면 그 자리에서 이어 끈다
        if (settle) {
          clearTimeout(settle.timer);
          settle = null;
          press.left = el.scrollLeft + dx;
        }
        el.style.scrollSnapType = "none";
        el.classList.add("is-grabbing");
        root.classList.add("is-grabbing");
        try {
          el.setPointerCapture(event.pointerId);
        } catch {}
      }
      el.scrollLeft = press.left - dx;
      press.trail.push([event.timeStamp, event.clientX]);
      while (press.trail.length > 2 && event.timeStamp - press.trail[0][0] > 90) press.trail.shift();
    });

    const end = (event) => {
      if (!press || event.pointerId !== press.id) return;
      const { moving, trail } = press;
      press = null;
      if (!moving) return;
      el.classList.remove("is-grabbing");
      root.classList.remove("is-grabbing");
      if (event.type === "pointerup") swallow();

      // 놓기 직전 90ms 의 빠르기로 얼마나 더 갈지 정하고, 그 근처의 멈춤 자리로 들어간다
      const [t0, x0] = trail[0];
      const [t1, x1] = trail[trail.length - 1];
      const speed = event.timeStamp - t1 < 60 && t1 > t0 ? (x1 - x0) / (t1 - t0) : 0;
      const aim = el.scrollLeft - speed * THROW;
      const spots = stops();
      const to = spots.length ? spots.reduce((a, b) => (Math.abs(b - aim) < Math.abs(a - aim) ? b : a)) : el.scrollLeft;
      if (Math.abs(to - el.scrollLeft) < 1 || still.matches) {
        el.scrollLeft = to;
        settled();
        return;
      }
      // 그 자리에 닿으면(scroll) scroll-snap 을 되살린다. 닿지 못하고 멈춰도 잠시 뒤에는 되살린다.
      settle = { to, timer: setTimeout(settled, 1200) };
      el.scrollTo({ left: to, behavior: "smooth" });
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("lostpointercapture", end);
  }
})();
