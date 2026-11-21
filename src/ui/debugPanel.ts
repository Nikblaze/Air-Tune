import GUI from "lil-gui";
import type { config as Config } from "../config";

/** Live tuning panel. Hidden by default; press D to toggle. */
export function createDebugPanel(config: typeof Config): GUI {
  const gui = new GUI({ title: "Debug (D)" });
  gui.hide();
  let visible = false;
  const pinch = gui.addFolder("Pinch");
  pinch.add(config.pinch, "on", 0.1, 0.6, 0.01);
  pinch.add(config.pinch, "off", 0.1, 0.8, 0.01);
  const euro = gui.addFolder("One Euro");
  euro.add(config.oneEuro, "minCutoff", 0.01, 5, 0.01);
  euro.add(config.oneEuro, "beta", 0, 0.05, 0.0005);
  euro.add(config.oneEuro, "dCutoff", 0.1, 5, 0.1);
  const debug = gui.addFolder("Debug");
  debug.add(config.debug, "showSkeleton");
  debug.add(config, "mirror");

  window.addEventListener("keydown", (e) => {
    const el = e.target as HTMLElement;
    if (el.closest("input, textarea, select, [contenteditable]")) return;
    if (e.key.toLowerCase() === "d") gui.show((visible = !visible));
  });
  return gui;
}
