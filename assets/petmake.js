// 스크린펫 「사진으로 새 펫 만들기」 시연: 반려동물 사진을 고르고 만들기를 누르면, 사진이 점점 도트로 바뀐 뒤
// 그 동물을 닮은 펫이 「사진으로 만든 펫」 줄에 더해지고 바로 골라진다. 꺼내 보기도 된다(pet.js 가 새 단추도 받는다).
// 시연이라 실제로 만들지 않는다: 펫은 앱에 이미 있는 그림이다. 움직임 줄이기를 켠 기기에서는 장면 없이 바로 더한다.
(() => {
  const demo = document.querySelector("[data-pet-demo]");
  const box = demo && demo.querySelector("[data-petmake]");
  if (!box) return;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const base = demo.dataset.petDemo;
  const MADE = {
    cat: { pet: "cheese-tabby", name: "치즈", style: "pixel", stage: false, kind: "사진으로 만든 펫 · 도트" },
    dog: { pet: "golden-retriever-soft", name: "보리", style: "soft", stage: true, kind: "사진으로 만든 펫 · 큐티" },
    hamster: { pet: "golden-syrian-soft", name: "도토리", style: "soft", stage: true, kind: "사진으로 만든 펫 · 큐티" },
  };
  const photos = [...box.querySelectorAll("[data-photo]")];
  const go = box.querySelector("[data-make]");
  const note = box.querySelector("[data-make-note]");
  const group = demo.querySelector("[data-made-group]");
  const row = demo.querySelector("[data-made-row]");
  const stage = demo.querySelector(".petbox__stage");
  let chosen = null;
  let busy = false;

  const load = (src) =>
    new Promise((ok) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = () => ok(null);
      im.src = src;
    });
  const wait = (ms) => new Promise((ok) => setTimeout(ok, still ? 0 : ms));
  const madePick = (k) => row.querySelector(`[data-from="${k}"]`);
  const obj = (w) => {
    const c = w.charCodeAt(w.length - 1) - 0xac00;
    return w + (c >= 0 && c <= 11171 && c % 28 ? "을" : "를");
  };

  function choose(button) {
    if (busy) return;
    chosen = button.dataset.photo;
    photos.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    const made = madePick(chosen);
    go.disabled = !!made;
    note.textContent = made
      ? `이 사진으로는 「${MADE[chosen].name}」${obj(MADE[chosen].name).slice(-1)} 이미 만들었어요. 위 목록에서 골라 꺼내 보세요.`
      : "만들기를 누르면 이 사진 속 동물을 닮은 펫을 만들어요.";
    if (made) made.click();
  }

  // 사진을 무대 크기에 맞춰(가득 채워) 그린다. cells 가 있으면 그 칸 수로 줄였다 키워 도트처럼
  function paint(ctx, img, cells) {
    const { width: W, height: H } = ctx.canvas;
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    if (!cells) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      return;
    }
    const tiny = document.createElement("canvas");
    tiny.width = cells;
    tiny.height = Math.max(1, Math.round((cells * H) / W));
    const t = tiny.getContext("2d");
    t.drawImage(img, ((W - w) / 2) * (cells / W), ((H - h) / 2) * (tiny.height / H), w * (cells / W), h * (tiny.height / H));
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(tiny, 0, 0, W, H);
  }

  async function make() {
    if (busy || !chosen || madePick(chosen)) return;
    const k = chosen;
    const m = MADE[k];
    busy = true;
    go.disabled = true;
    photos.forEach((b) => (b.disabled = true));
    note.textContent = "펫을 만드는 중…";
    const img = await load(`${base}make/pet-${k}.webp`);
    await load(`${base}${m.stage ? "stage" : "thumb"}/${m.pet}.webp`);
    let canvas = null;
    let label = null;
    if (img && !still) {
      stage.scrollIntoView({ block: "nearest", behavior: "smooth" });
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas = document.createElement("canvas");
      canvas.className = "petbox__make";
      canvas.width = Math.round(stage.clientWidth * dpr);
      canvas.height = Math.round(stage.clientHeight * dpr);
      label = document.createElement("span");
      label.className = "petbox__busy";
      label.textContent = "펫 만드는 중";
      stage.append(canvas, label);
      const ctx = canvas.getContext("2d");
      paint(ctx, img, 0);
      await wait(650);
      for (const cells of [56, 36, 24, 16, 11]) {
        paint(ctx, img, cells);
        await wait(230);
      }
    }
    // 새 펫 단추를 「사진으로 만든 펫」 줄에 넣고 고른다(pet.js 가 이름·그림을 바꾼다)
    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "pick pick--new";
    Object.assign(pick.dataset, { pet: m.pet, breed: m.name, kind: m.kind, style: m.style, stage: String(m.stage), from: k });
    pick.setAttribute("aria-pressed", "false");
    pick.setAttribute("aria-label", `${m.name}, 사진으로 만든 펫`);
    pick.innerHTML = `<img src="${base}thumb/${m.pet}.webp" width="192" height="208" alt="">`;
    row.append(pick);
    group.hidden = false;
    pick.click();
    if (canvas) {
      label.remove();
      canvas.classList.add("is-done");
      await wait(450);
      canvas.remove();
    }
    note.textContent = `「${m.name}」${obj(m.name).slice(-1)} 만들었어요. 꺼내 보기를 눌러 화면 위로 꺼내 보세요.`;
    photos.forEach((b) => (b.disabled = false));
    busy = false;
  }

  photos.forEach((b) => b.addEventListener("click", () => choose(b)));
  go.addEventListener("click", make);
})();
