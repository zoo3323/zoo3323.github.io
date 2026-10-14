// 미리보기의 앱 화면을 누르면 크게 본다. 옆으로 넘기거나 화살표·←→ 키로 다음 화면, Esc 나 바깥을 누르면 닫힌다.
(() => {
  const lists = [...document.querySelectorAll(".shots")];
  if (!lists.length) return;

  // 움직임 줄이기를 켠 기기에서는 영상을 멈춰 두고, 누르면 재생한다
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    for (const video of document.querySelectorAll(".shots video")) {
      video.removeAttribute("autoplay");
      video.pause();
      video.controls = true;
    }
  }
  if (typeof HTMLDialogElement !== "function") return;

  const arrow = (d) =>
    `<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
  const dialog = document.createElement("dialog");
  dialog.className = "zoom";
  dialog.setAttribute("aria-label", "화면 크게 보기");
  dialog.innerHTML = `
    <div class="zoom__bar"><p class="zoom__count" aria-live="polite"></p><button type="button" class="btn" data-close>닫기</button></div>
    <div class="zoom__stage"><img class="zoom__img" alt=""></div>
    <p class="zoom__caption"></p>
    <button type="button" class="btn zoom__prev" aria-label="이전 화면">${arrow("M12 7H2.5M6.5 3 2.5 7l4 4")}</button>
    <button type="button" class="btn zoom__next" aria-label="다음 화면">${arrow("M2 7h9.5M7.5 3l4 4-4 4")}</button>`;
  document.body.append(dialog);

  const stage = dialog.querySelector(".zoom__stage");
  const big = dialog.querySelector(".zoom__img");
  const count = dialog.querySelector(".zoom__count");
  const caption = dialog.querySelector(".zoom__caption");
  const prev = dialog.querySelector(".zoom__prev");
  const next = dialog.querySelector(".zoom__next");
  let items = [];
  let index = 0;

  const show = (n) => {
    index = (n + items.length) % items.length;
    const img = items[index];
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    caption.textContent = img.alt;
    count.textContent = `${index + 1} / ${items.length}`;
    prev.hidden = next.hidden = items.length < 2;
  };

  for (const list of lists) {
    const imgs = [...list.querySelectorAll("img")];
    imgs.forEach((img, n) => {
      const open = document.createElement("button");
      open.type = "button";
      open.className = "shots__open";
      open.setAttribute("aria-label", `크게 보기: ${img.alt}`);
      img.replaceWith(open);
      open.append(img);
      open.addEventListener("click", () => {
        items = imgs;
        show(n);
        document.documentElement.style.overflow = "hidden";
        dialog.showModal();
      });
    });
  }

  prev.addEventListener("click", () => show(index - 1));
  next.addEventListener("click", () => show(index + 1));
  dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => document.documentElement.style.removeProperty("overflow"));
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") show(index - 1);
    if (event.key === "ArrowRight") show(index + 1);
  });
  // 그림 밖을 누르면 닫는다
  stage.addEventListener("click", (event) => {
    if (event.target === stage) dialog.close();
  });
  // 옆으로 밀어 넘기기
  let startX = null;
  stage.addEventListener("pointerdown", (event) => (startX = event.clientX));
  stage.addEventListener("pointerup", (event) => {
    if (startX === null) return;
    const dx = event.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 50 && items.length > 1) show(index + (dx < 0 ? 1 : -1));
  });
})();
