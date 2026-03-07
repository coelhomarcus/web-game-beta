import { socket } from "../network/socket";

// ─── FPS / Ping HUD (top-centre) ────────────────────────────────────────────

let _el: HTMLDivElement | null = null;
let _frames = 0;
let _elapsed = 0;
let _fps = 0;
let _ping = 0;

function _ensureEl(): HTMLDivElement {
  if (_el) return _el;
  _el = document.createElement("div");
  _el.id = "hud-stats";
  _el.innerHTML = `<span id="hud-fps">0 FPS</span> | <span id="hud-ping">0 ms</span>`;
  document.body.appendChild(_el);

  // Measure ping via socket.io volatile emit + ack round-trip
  setInterval(() => {
    const start = performance.now();
    socket.volatile.emit("ping_check", () => {
      _ping = Math.round(performance.now() - start);
    });
  }, 2_000);

  return _el;
}

export function updateStats(delta: number): void {
  _ensureEl();
  _frames++;
  _elapsed += delta;
  if (_elapsed >= 0.5) {
    _fps = Math.round(_frames / _elapsed);
    _frames = 0;
    _elapsed = 0;

    const fpsEl = document.getElementById("hud-fps");
    const pingEl = document.getElementById("hud-ping");
    if (fpsEl) fpsEl.textContent = `${_fps} FPS`;
    if (pingEl) pingEl.textContent = `${_ping} ms`;
  }
}
