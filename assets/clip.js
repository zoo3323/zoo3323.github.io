// 「풀어야 했던 문제」 설명 영상. 화면에 보일 때만 소리 없이 되풀이하고, 지금 장(章)의 줄을 밝힌다. 줄을 누르면 그 장으로 건너뛴다.
// 영상 모서리의 단추로 멈추고 다시 튼다. 움직임 줄이기를 켠 기기에서는 저절로 틀지 않고 브라우저 재생 단추를 그대로 둔다.
// 스크립트가 없으면 영상은 기본 재생 단추(controls)로 볼 수 있고, 목록은 글로 읽힌다.
(() => {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const icon = (d) => `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${d}" fill="currentColor"/></svg>`;
  const PAUSE = icon("M4 2.5h3v11H4zM9 2.5h3v11H9z");
  const PLAY = icon("M4.5 2.2v11.6L13.6 8z");

  for (const box of document.querySelectorAll(".clip")) {
    const video = box.querySelector("video");
    if (!video) continue;
    const rows = [...box.querySelectorAll("[data-at]")];
    const at = rows.map((r) => Number(r.dataset.at) || 0);

    const mark = () => {
      const t = video.currentTime;
      let on = 0;
      at.forEach((a, i) => {
        if (t >= a - 0.05) on = i;
      });
      rows.forEach((r, i) => {
        r.classList.toggle("is-on", i === on);
        const b = r.querySelector("button");
        if (b) b.toggleAttribute("aria-current", i === on);
      });
    };
    video.addEventListener("timeupdate", mark);
    video.addEventListener("seeked", mark);
    mark();

    // 사람이 멈췄으면, 화면을 오가도 다시 틀지 않는다
    let held = still;
    let seen = false;
    const play = () => video.play().catch(() => (video.controls = true));

    rows.forEach((r, i) =>
      r.querySelector("button")?.addEventListener("click", () => {
        video.currentTime = at[i] + 0.02;
        mark();
        held = false;
        play();
      }),
    );

    if (still) continue;
    video.controls = false;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "clip__toggle";
    const sync = () => {
      const paused = video.paused;
      toggle.innerHTML = paused ? PLAY : PAUSE;
      toggle.setAttribute("aria-label", paused ? "영상 재생" : "영상 멈추기");
    };
    toggle.addEventListener("click", () => {
      if (video.paused) {
        held = false;
        play();
      } else {
        held = true;
        video.pause();
      }
    });
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    video.parentElement.append(toggle);
    sync();

    new IntersectionObserver(
      ([e]) => {
        seen = e.isIntersecting;
        if (seen && !held && !document.hidden) play();
        else if (!seen) video.pause();
      },
      { threshold: 0.35 },
    ).observe(video);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) video.pause();
      else if (seen && !held) play();
    });
  }
})();
