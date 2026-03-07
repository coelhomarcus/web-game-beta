// ─── Settings menu (ESC) with sensitivity config saved to localStorage ────────

const DEFAULTS = {
  normalSensitivity: 1.0,
  scopeSensitivity: 0.3,
};

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

let normalSensitivity = load("sens_normal", DEFAULTS.normalSensitivity);
let scopeSensitivity = load("sens_scope", DEFAULTS.scopeSensitivity);

export function getNormalSensitivity() {
  return normalSensitivity;
}
export function getScopeSensitivity() {
  return scopeSensitivity;
}

// ─── Build DOM ───────────────────────────────────────────────────────────────
const overlay = document.createElement("div");
overlay.id = "settings-overlay";
overlay.innerHTML = `
  <div class="settings-card">
    <!-- Tab bar -->
    <div class="rbx-tabs">
      <div class="rbx-tab active">
        <span class="rbx-tab-icon">⚙️</span>
        <span class="rbx-tab-label">Settings</span>
      </div>
    </div>

    <!-- Settings rows -->
    <div class="rbx-body">
      <div class="rbx-row">
        <span class="rbx-row-label">Sensibilidade Normal</span>
        <div class="rbx-slider-group">
          <button class="rbx-step-btn" data-target="sens-normal" data-dir="-1">⊖</button>
          <div class="rbx-bar-track" id="sens-normal-track"></div>
          <button class="rbx-step-btn" data-target="sens-normal" data-dir="1">⊕</button>
          <span id="sens-normal-val" class="rbx-val"></span>
        </div>
      </div>
      <div class="rbx-row alt">
        <span class="rbx-row-label">Sensibilidade Mira</span>
        <div class="rbx-slider-group">
          <button class="rbx-step-btn" data-target="sens-scope" data-dir="-1">⊖</button>
          <div class="rbx-bar-track" id="sens-scope-track"></div>
          <button class="rbx-step-btn" data-target="sens-scope" data-dir="1">⊕</button>
          <span id="sens-scope-val" class="rbx-val"></span>
        </div>
      </div>
    </div>

    <!-- Hidden range inputs (drive the logic) -->
    <input id="sens-normal" type="range" min="0.1" max="3.0" step="0.05" style="display:none" />
    <input id="sens-scope" type="range" min="0.05" max="1.5" step="0.05" style="display:none" />

    <!-- Bottom action bar -->
    <div class="rbx-actions">
      <button id="settings-resume" class="rbx-action-btn">
        <span class="rbx-key teal">ESC</span>
        <span>Resume Game</span>
      </button>
    </div>
  </div>
`;
document.body.appendChild(overlay);

const normalSlider = overlay.querySelector("#sens-normal") as HTMLInputElement;
const scopeSlider = overlay.querySelector("#sens-scope") as HTMLInputElement;
const normalVal = overlay.querySelector("#sens-normal-val") as HTMLSpanElement;
const scopeVal = overlay.querySelector("#sens-scope-val") as HTMLSpanElement;
const normalTrack = overlay.querySelector("#sens-normal-track") as HTMLDivElement;
const scopeTrack = overlay.querySelector("#sens-scope-track") as HTMLDivElement;
const resumeBtn = overlay.querySelector(
  "#settings-resume",
) as HTMLButtonElement;

const SEGMENTS = 12;

function renderBar(
  track: HTMLDivElement,
  slider: HTMLInputElement,
  valEl: HTMLSpanElement,
) {
  const min = parseFloat(slider.min);
  const max = parseFloat(slider.max);
  const val = parseFloat(slider.value);
  const pct = (val - min) / (max - min);
  const filled = Math.round(pct * SEGMENTS);

  valEl.textContent = val.toFixed(1);

  track.innerHTML = "";
  for (let i = 0; i < SEGMENTS; i++) {
    const seg = document.createElement("div");
    seg.className = "rbx-seg" + (i < filled ? " on" : "");
    track.appendChild(seg);
  }
}

function stepSlider(slider: HTMLInputElement, dir: number) {
  const step = parseFloat(slider.step) || 0.05;
  const min = parseFloat(slider.min);
  const max = parseFloat(slider.max);
  let newVal = parseFloat(slider.value) + step * dir * 3;
  newVal = Math.min(max, Math.max(min, newVal));
  slider.value = String(newVal);
  slider.dispatchEvent(new Event("input"));
}

// Init slider values
normalSlider.value = String(normalSensitivity);
scopeSlider.value = String(scopeSensitivity);
renderBar(normalTrack, normalSlider, normalVal);
renderBar(scopeTrack, scopeSlider, scopeVal);

normalSlider.addEventListener("input", () => {
  normalSensitivity = parseFloat(normalSlider.value);
  localStorage.setItem("sens_normal", JSON.stringify(normalSensitivity));
  renderBar(normalTrack, normalSlider, normalVal);
});

scopeSlider.addEventListener("input", () => {
  scopeSensitivity = parseFloat(scopeSlider.value);
  localStorage.setItem("sens_scope", JSON.stringify(scopeSensitivity));
  renderBar(scopeTrack, scopeSlider, scopeVal);
});

// Step buttons (⊖ / ⊕)
overlay.querySelectorAll<HTMLButtonElement>(".rbx-step-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.target!;
    const dir = parseInt(btn.dataset.dir!, 10);
    const slider =
      target === "sens-normal" ? normalSlider : scopeSlider;
    stepSlider(slider, dir);
  });
});

// Click on bar track to set value
[
  { track: normalTrack, slider: normalSlider },
  { track: scopeTrack, slider: scopeSlider },
].forEach(({ track, slider }) => {
  track.addEventListener("click", (e: MouseEvent) => {
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    slider.value = String(min + pct * (max - min));
    slider.dispatchEvent(new Event("input"));
  });
});

// ─── Show / Hide ─────────────────────────────────────────────────────────────
let onResumeCallback: (() => void) | null = null;

export function showSettings(onResume: () => void) {
  onResumeCallback = onResume;
  overlay.classList.add("active");
}

export function hideSettings() {
  overlay.classList.remove("active");
  if (onResumeCallback) {
    onResumeCallback();
    onResumeCallback = null;
  }
}

export function isSettingsOpen() {
  return overlay.classList.contains("active");
}

resumeBtn.addEventListener("click", () => hideSettings());
