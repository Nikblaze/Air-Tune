const HIDE_AFTER_MS = 3000;

/** Top-right icon bar (DOM, not canvas, so recordings stay clean) + keyboard shortcuts. */
export function initHud(h: { onUndo: () => void; onClear: () => void; onSettings: () => void; onHelp: () => void }) {
  const bar = document.createElement("div");
  bar.id = "hud";
  bar.innerHTML = `
    <span id="hud-label"></span>
    <button type="button" data-act="undo" aria-label="Undo (Z)" title="Undo (Z)">↶</button>
    <button type="button" data-act="clear" aria-label="Clear all (C)" title="Clear all (C)">✕</button>
    <button type="button" data-act="settings" aria-label="Settings" title="Settings">⚙</button>
    <button type="button" data-act="help" aria-label="Help (?)" title="Help (?)">?</button>`;
  document.body.append(bar);
  const labelEl = bar.querySelector<HTMLElement>("#hud-label")!;
  bar.querySelector('[data-act="undo"]')!.addEventListener("click", h.onUndo);
  bar.querySelector('[data-act="clear"]')!.addEventListener("click", h.onClear);

  bar.querySelector('[data-act="settings"]')!.addEventListener("click", h.onSettings);
  bar.querySelector('[data-act="help"]')!.addEventListener("click", h.onHelp);

  let hidden = false; // H toggle: fully off
  let idle: number;
  const wake = () => {
    bar.classList.add("show");
    clearTimeout(idle);
    idle = window.setTimeout(() => bar.classList.remove("show"), HIDE_AFTER_MS);
  };
  window.addEventListener("mousemove", wake);
  wake();

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
    const k = e.key.toLowerCase();
    if (k === "z") h.onUndo();
    else if (k === "c") h.onClear();
    else if (k === "?") h.onHelp(); // Shift+/ ; "?" has no letter case to worry about
    else if (k === "h") bar.hidden = hidden = !hidden;
  });

  return {
    setLabel(text: string) {
      if (labelEl.textContent !== text) labelEl.textContent = text;
    },
  };
}
