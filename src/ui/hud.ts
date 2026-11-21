/** Phase 2: keyboard shortcuts only. Phase 3 adds the icon bar. */
export function initHud(h: { onUndo: () => void; onClear: () => void }): void {
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
    const k = e.key.toLowerCase();
    if (k === "z") h.onUndo();
    else if (k === "c") h.onClear();
  });
}
