const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();

const hero = document.querySelector("[data-hero]");
const visual = document.querySelector("[data-hero-visual]");
const portrait = document.querySelector("[data-character-parallax]");

if (hero && visual && portrait) {
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const toggle = document.querySelector("[data-motion-toggle]");
  const state = document.querySelector("[data-motion-state]");
  // A deliberate choice overrides the system preference for this visit only.
  let choice = null;
  const motionEnabled = () => choice ?? !motion.matches;
  let visible = true;
  let frame = 0;
  let position = null;

  const enabled = () => motionEnabled() && pointer.matches && visible && !document.hidden;
  const reset = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    position = null;
    portrait.style.setProperty("--parallax-x", "0px");
    portrait.style.setProperty("--parallax-y", "0px");
    portrait.style.setProperty("--tilt-x", "0deg");
    portrait.style.setProperty("--tilt-y", "0deg");
    visual.style.setProperty("--light-x", "0px");
    visual.style.setProperty("--light-y", "0px");
  };
  const sync = () => {
    const active = motionEnabled();
    hero.classList.toggle("motion-enabled", active);
    hero.classList.toggle("motion-disabled", !active);
    hero.classList.toggle("is-paused", !active || !visible || document.hidden);
    if (toggle) {
      toggle.hidden = false;
      toggle.setAttribute("aria-pressed", String(active));
      toggle.title = choice === null && motion.matches
        ? "已跟随系统减少动画，可点击主动开启"
        : "切换人物浮动、光效和鼠标跟随";
    }
    if (state) state.textContent = active ? "已开启" : "已关闭";
    if (!enabled()) reset();
  };
  const render = () => {
    frame = 0;
    if (!enabled() || !position) return;
    const rect = visual.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const clamp = value => Math.max(-1, Math.min(1, value));
    const x = clamp((position.x - rect.left) / rect.width * 2 - 1);
    const y = clamp((position.y - rect.top) / rect.height * 2 - 1);
    portrait.style.setProperty("--parallax-x", `${x * 8}px`);
    portrait.style.setProperty("--parallax-y", `${y * 5}px`);
    portrait.style.setProperty("--tilt-x", `${-y * 1.2}deg`);
    portrait.style.setProperty("--tilt-y", `${x * 1.6}deg`);
    visual.style.setProperty("--light-x", `${x * 18}px`);
    visual.style.setProperty("--light-y", `${y * 12}px`);
  };

  hero.addEventListener("pointermove", event => {
    if (!enabled() || event.pointerType !== "mouse") return;
    position = { x: event.clientX, y: event.clientY };
    if (!frame) frame = requestAnimationFrame(render);
  }, { passive: true });
  hero.addEventListener("pointerleave", reset);
  hero.addEventListener("pointercancel", reset);
  toggle?.addEventListener("click", () => {
    choice = !motionEnabled();
    sync();
  });
  motion.addEventListener("change", sync);
  pointer.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  // Reset stale coordinates when the page moves underneath the pointer.
  document.addEventListener("scroll", reset, { passive: true });
  if (typeof IntersectionObserver !== "undefined") {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      sync();
    }).observe(hero);
  }
  sync();
}
