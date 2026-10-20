// 마이리틀클로젯 체험 칸: 옷 고르기 → 배경 지우기 → 내 사진 고르기 → AI로 입혀 보기.
// 시연이라 AI를 실제로 돌리지 않는다. 배경을 지운 그림과 입힌 결과는 미리 만들어 둔 견본이다(assets/img/mylittlecloset/try).
// 움직임 줄이기를 켠 기기에서는 쓸어내림·기다림 없이 바로 바뀐다.
(() => {
  const root = document.querySelector("[data-try]");
  if (!root) return;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DIR = "/assets/img/mylittlecloset/try/";
  const NAME = { shirt: "체크 셔츠", knit: "니트", denim: "데님 재킷" };
  const WHO = { a: "인물 A", b: "인물 B" };
  const $ = (s) => root.querySelector(s);
  const frame = $("[data-frame]");
  const photo = $("[data-photo]");
  const sheet = $("[data-sheet-layer]");
  const cut = $("[data-cut]");
  const personImg = $("[data-person-img]");
  const result = $("[data-result]");
  const sweep = $("[data-sweep]");
  const busy = $("[data-busy]");
  const mini = $("[data-mini]");
  const compare = $("[data-compare]");
  const labels = $("[data-labels]");
  const cap = $("[data-cap]");
  const cutGo = $("[data-cut-go]");
  const wearGo = $("[data-wear-go]");
  const reset = $("[data-reset]");
  const garments = [...root.querySelectorAll("[data-garment]")];
  const people = [...root.querySelectorAll("[data-person]")];
  const steps = [...root.querySelectorAll("[data-step]")];

  const state = { garment: "shirt", cut: false, person: null, worn: false, busy: false };
  const load = (src) =>
    new Promise((ok) => {
      const im = new Image();
      im.onload = im.onerror = () => ok();
      im.src = src;
    });
  const wait = (ms) => new Promise((ok) => setTimeout(ok, still ? Math.min(ms, 120) : ms));
  // 받침이 있으면 「을」, 없으면 「를」
  const obj = (w) => {
    const c = w.charCodeAt(w.length - 1) - 0xac00;
    return w + (c >= 0 && c <= 11171 && c % 28 ? "을" : "를");
  };

  function paint() {
    const { garment, cut: isCut, person, worn } = state;
    garments.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.garment === garment)));
    people.forEach((b) => {
      b.disabled = !isCut || state.busy;
      b.setAttribute("aria-pressed", String(b.dataset.person === person));
    });
    cutGo.disabled = isCut || state.busy;
    wearGo.disabled = !isCut || !person || worn || state.busy;
    reset.hidden = !worn;
    const now = !isCut ? (garment ? 2 : 1) : !person ? 3 : 4;
    steps.forEach((li) => {
      const n = Number(li.dataset.step);
      li.classList.toggle("is-now", n === now && !worn);
      li.classList.toggle("is-done", n < now || worn);
    });
    // 무대: 옷 사진 → (배경 지운) 스티커 → 인물 + 작은 스티커 → 비교 막대
    const showPerson = isCut && person;
    photo.hidden = isCut;
    sheet.hidden = !isCut || showPerson;
    personImg.hidden = !showPerson;
    mini.hidden = !showPerson || worn;
    result.hidden = !worn;
    compare.hidden = !worn;
    labels.hidden = !worn;
    frame.classList.toggle("is-person", !!showPerson);
  }

  function say(text) {
    cap.textContent = text;
  }

  // 폰처럼 단계 칸이 무대 아래에 있으면, 움직임이 시작될 때 무대가 다 보이도록 옮겨 준다
  function show() {
    const r = frame.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= innerHeight) return;
    frame.scrollIntoView({ block: r.height > innerHeight ? "start" : "center", behavior: still ? "auto" : "smooth" });
  }

  function pickGarment(g) {
    if (state.busy) return;
    Object.assign(state, { garment: g, cut: false, worn: false });
    photo.src = `${DIR}garment-${g}.webp`;
    photo.alt = { shirt: "나무 바닥에 펼쳐 둔 체크 셔츠 사진", knit: "침대 시트 위에 펼쳐 둔 아이보리 니트 사진", denim: "러그 위에 펼쳐 둔 데님 재킷 사진" }[g];
    cut.src = `${DIR}garment-${g}-cut.webp`;
    mini.querySelector("img").src = cut.src;
    load(cut.src);
    say(`${NAME[g]} 사진이에요. 배경을 지워 보세요.`);
    paint();
  }

  async function removeBackground() {
    if (state.busy || state.cut) return;
    state.busy = true;
    paint();
    await load(cut.src);
    sheet.hidden = false;
    photo.hidden = false;
    show();
    frame.classList.add("is-cutting");
    say("배경을 지우는 중…");
    await wait(1250);
    frame.classList.remove("is-cutting");
    Object.assign(state, { cut: true, busy: false });
    cut.alt = `배경을 지운 ${NAME[state.garment]} 스티커`;
    say(`배경을 지워 ${NAME[state.garment]} 스티커로 남겼어요. 이제 내 사진을 골라 보세요.`);
    paint();
    people[0]?.focus({ preventScroll: true });
  }

  async function pickPerson(p) {
    if (state.busy || !state.cut) return;
    const again = state.worn;
    Object.assign(state, { person: p, worn: false });
    personImg.src = `${DIR}person-${p}.webp`;
    personImg.alt = `${WHO[p]}(견본 인물) 사진`;
    load(`${DIR}result-${p}-${state.garment}.webp`);
    paint();
    show();
    if (again) return wear();
    say(`${WHO[p]} 사진에 ${obj(NAME[state.garment])} 입혀 볼게요. 입혀 보기를 누르세요.`);
  }

  async function wear() {
    if (state.busy || !state.cut || !state.person) return;
    state.busy = true;
    paint();
    const src = `${DIR}result-${state.person}-${state.garment}.webp`;
    busy.hidden = false;
    show();
    say("AI가 입혀 보는 중…");
    await Promise.all([load(src), wait(1900)]);
    busy.hidden = true;
    result.src = src;
    result.alt = `${WHO[state.person]}에게 ${obj(NAME[state.garment])} 입힌 결과`;
    compare.value = "50";
    frame.style.setProperty("--split", "50%");
    Object.assign(state, { worn: true, busy: false });
    say("막대를 옆으로 끌어 원래 사진과 비교해 보세요. 다른 인물을 고르면 바로 입혀 봅니다.");
    paint();
  }

  compare.addEventListener("input", () => frame.style.setProperty("--split", `${compare.value}%`));
  garments.forEach((b) => b.addEventListener("click", () => pickGarment(b.dataset.garment)));
  people.forEach((b) => b.addEventListener("click", () => pickPerson(b.dataset.person)));
  cutGo.addEventListener("click", removeBackground);
  wearGo.addEventListener("click", wear);
  reset.addEventListener("click", () => {
    Object.assign(state, { person: null });
    pickGarment("shirt");
    say("옷 사진을 고른 뒤 배경을 지워 보세요.");
  });
  pickGarment("shirt");
  say("옷 사진을 고른 뒤 배경을 지워 보세요.");
})();
