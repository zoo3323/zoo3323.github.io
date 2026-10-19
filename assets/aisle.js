// 진열대 줄 밀기. 손가락이나 트랙패드로는 그냥 밀고, 마우스가 있는 화면에서는 줄 양 끝의 화살표 단추로도 민다.
// 줄 아래에는 지금 어디쯤인지 보여 주는 짧은 막대를 둔다.
// 멈추는 자리는 물건의 시작(scroll-snap)이라, 멈추면 고리의 두 다리가 늘 벽의 구멍에 꽂힌다.
(() => {
  const lines = [...document.querySelectorAll(".line")];
  if (!lines.length) return;
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const icon = (d) =>
    '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" ' +
    `stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;

  for (const line of lines) {
    const row = line.querySelector(".hooks");
    const name =
      line.dataset.name || line.closest(".aisle")?.querySelector(".aisle__name")?.firstChild?.textContent.trim() || "진열대";

    const button = (dir, label, d) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `line__go line__go--${dir}`;
      el.setAttribute("aria-label", `${name} ${label}`);
      el.innerHTML = icon(d);
      el.hidden = true;
      el.addEventListener("click", () => {
        // 보이는 폭의 8할만큼 민다. 멈추는 자리는 scroll-snap 이 물건의 시작으로 맞춘다.
        const step = row.clientWidth * 0.8 * (dir === "prev" ? -1 : 1);
        row.scrollBy({ left: step, behavior: still.matches ? "auto" : "smooth" });
      });
      line.append(el);
      return el;
    };
    const prev = button("prev", "앞으로 밀기", "M12 7H2.5M6.5 3 2.5 7l4 4");
    const next = button("next", "뒤로 밀기", "M2 7h9.5M7.5 3l4 4-4 4");

    // 줄이 얼마나 길고 지금 어디쯤인지: 줄 아래 가운데의 짧은 막대. 짙은 칸의 길이가 보이는 몫, 자리가 민 정도다.
    // 손가락으로 미는 폰에는 화살표 단추가 없어서 이것이 「옆에 더 있다」를 알려 준다.
    const track = document.createElement("div");
    track.className = "line__track";
    track.setAttribute("aria-hidden", "true");
    track.innerHTML = '<span class="line__thumb"></span>';
    line.append(track);
    const thumb = track.firstElementChild;

    const update = () => {
      const end = row.scrollWidth - row.clientWidth;
      prev.hidden = row.scrollLeft <= 1;
      next.hidden = row.scrollLeft >= end - 1;
      track.hidden = end <= 1;
      if (end > 1) {
        const shown = row.clientWidth / row.scrollWidth;
        const at = Math.min(1, Math.max(0, row.scrollLeft / end));
        thumb.style.width = `${(shown * 100).toFixed(2)}%`;
        thumb.style.transform = `translateX(${(((at * (1 - shown)) / shown) * 100).toFixed(2)}%)`;
      }
    };
    row.addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    addEventListener("load", update);
    update();
  }

  // 처음 온 사람에게 줄을 옆으로 밀 수 있다는 것을 한 번 보여 준다: 넘치는 줄이 처음 화면에 들어오면 살짝 밀렸다 돌아온다.
  // 이 브라우저에서 한 번 보여 주면 다시 하지 않는다. 움직임 줄이기 설정이면 하지 않고, 그 사이 손을 대면 바로 멈춘다.
  const KEY = "zoo3323:peek";
  let seen = false;
  try {
    seen = localStorage.getItem(KEY) === "1";
  } catch {}
  if (seen || still.matches || !("IntersectionObserver" in window)) return;
  const peek = (row) => {
    const far = Math.min(64, row.scrollWidth - row.clientWidth);
    if (row.scrollLeft > 1 || far < 24) return;
    let stop = false;
    const quit = () => {
      stop = true;
      row.style.removeProperty("scroll-snap-type");
    };
    for (const type of ["pointerdown", "wheel", "touchstart"]) row.addEventListener(type, quit, { once: true, passive: true });
    row.style.scrollSnapType = "none";
    const begin = performance.now();
    const step = (now) => {
      if (stop) return;
      const u = Math.min(1, (now - begin) / 1100);
      row.scrollLeft = far * Math.sin(Math.PI * u) ** 2;
      if (u < 1) requestAnimationFrame(step);
      else {
        row.scrollLeft = 0;
        row.style.removeProperty("scroll-snap-type");
      }
    };
    requestAnimationFrame(step);
  };
  const watch = new IntersectionObserver(
    (entries) => {
      const hit = entries.find((e) => e.isIntersecting && e.target.scrollWidth - e.target.clientWidth > 24 && e.target.scrollLeft <= 1);
      if (!hit) return;
      watch.disconnect();
      try {
        localStorage.setItem(KEY, "1");
      } catch {}
      setTimeout(() => peek(hit.target), 450);
    },
    { threshold: 0.3 },
  );
  for (const line of lines) {
    const row = line.querySelector(".hooks");
    if (row) watch.observe(row);
  }
})();
