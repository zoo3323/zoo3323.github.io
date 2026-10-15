// 진열대 줄 밀기. 손가락이나 트랙패드로는 그냥 밀고, 마우스가 있는 화면에서는 줄 양 끝의 화살표 단추로도 민다.
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
    const name = line.closest(".aisle")?.querySelector(".aisle__name")?.firstChild?.textContent.trim() || "진열대";

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

    const update = () => {
      const end = row.scrollWidth - row.clientWidth;
      prev.hidden = row.scrollLeft <= 1;
      next.hidden = row.scrollLeft >= end - 1;
    };
    row.addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    addEventListener("load", update);
    update();
  }
})();
