// Help overlay (SPEC §10.9). An overlay on PLAYING, not an app state: tracking keeps running under it.
export function createHelp() {
  const el = document.createElement("div");
  el.id = "help";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Help");
  el.innerHTML = `<div class="panel">
    <header><h2>How to play</h2><button type="button" data-close aria-label="Close help">×</button></header>
    <h3>Gestures</h3>
    <ul>
      <li><b>Draw:</b> pinch with both hands, then pull them apart.</li>
      <li><b>Pluck:</b> swipe a fingertip through a string.</li>
      <li><b>Strum:</b> sweep across several strings.</li>
      <li><b>Clear all:</b> press C or the Clear button.</li>
    </ul>
    <h3>Keyboard</h3>
    <ul>
      <li><kbd>Z</kbd> undo · <kbd>C</kbd> clear · <kbd>R</kbd> record</li>
      <li><kbd>H</kbd> hide HUD · <kbd>D</kbd> debug panel</li>
      <li><kbd>?</kbd> help · <kbd>Esc</kbd> close</li>
    </ul>
    <h3>Play in a meeting</h3>
    <p>In Google Meet or Teams, choose Present / Share → this tab → turn on <i>Also share tab audio</i>.</p>
  </div>`;
  document.body.append(el);
  const close = () => (el.hidden = true);
  el.querySelector("[data-close]")!.addEventListener("click", close);
  el.addEventListener("pointerdown", (e) => e.target === el && close()); // click on the backdrop
  return { close, toggle: () => (el.hidden = !el.hidden), isOpen: () => !el.hidden };
}
