// Highlights the landing page's step strip from the real recording's playhead. Offsets come from
// persisted step timestamps relative to the attempt start, so they are approximate by design.
const replay = document.querySelector("[data-replay]");
const video = replay?.querySelector("video");
const items = [...(replay?.querySelectorAll("[data-offset-ms]") ?? [])];

function update() {
  const t = (video?.currentTime ?? 0) * 1000;
  let now = -1;
  items.forEach((li, i) => {
    if (t >= Number(li.dataset.offsetMs)) now = i;
  });
  items.forEach((li, i) => {
    const failed = li.dataset.result === "FAIL";
    li.classList.toggle("is-done", i < now || (i === now && !failed));
    li.classList.toggle("is-now", i === now);
    li.classList.toggle("is-fail", i <= now && failed);
  });
}

if (video && items.length) {
  video.addEventListener("timeupdate", update);
  video.addEventListener("seeked", update);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    video.removeAttribute("autoplay");
    video.pause();
  }
  update();
}
