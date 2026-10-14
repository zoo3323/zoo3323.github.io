// 마이리틀클로젯 스티커 시트: 분류 딱지를 누르면 그 분류의 옷만 남는다.
(() => {
  const sheet = document.querySelector("[data-sheet]");
  if (!sheet) return;

  const chips = [...sheet.querySelectorAll("[data-filter]")];
  const items = [...sheet.querySelectorAll("[data-kind]")];
  const count = sheet.querySelector("[data-count]");

  const apply = (chip) => {
    const kind = chip.dataset.filter;
    let shown = 0;
    for (const item of items) {
      item.hidden = kind !== "all" && item.dataset.kind !== kind;
      if (!item.hidden) shown += 1;
    }
    for (const other of chips) other.setAttribute("aria-pressed", String(other === chip));
    count.textContent = `${kind === "all" ? "옷" : chip.textContent.trim()} ${shown}벌`;
  };

  for (const chip of chips) chip.addEventListener("click", () => apply(chip));
})();
