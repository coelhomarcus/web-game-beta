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
    <div class="settings-title">⚙️ CONFIGURAÇÕES</div>

    <label class="settings-label">
      Sensibilidade Normal
      <div class="settings-row">
        <input id="sens-normal" type="range" min="0.1" max="3.0" step="0.05" />
        <span id="sens-normal-val" class="settings-val"></span>
      </div>
    </label>

    <label class="settings-label">
      Sensibilidade Mira (Scope)
      <div class="settings-row">
        <input id="sens-scope" type="range" min="0.05" max="1.5" step="0.05" />
        <span id="sens-scope-val" class="settings-val"></span>
      </div>
    </label>

    <button id="settings-resume" class="settings-btn">▶ VOLTAR AO JOGO</button>
  </div>
`;
document.body.appendChild(overlay);

const normalSlider = overlay.querySelector("#sens-normal") as HTMLInputElement;
const scopeSlider = overlay.querySelector("#sens-scope") as HTMLInputElement;
const normalVal = overlay.querySelector("#sens-normal-val") as HTMLSpanElement;
const scopeVal = overlay.querySelector("#sens-scope-val") as HTMLSpanElement;
const resumeBtn = overlay.querySelector(
  "#settings-resume",
) as HTMLButtonElement;

// Init slider values
normalSlider.value = String(normalSensitivity);
scopeSlider.value = String(scopeSensitivity);
normalVal.textContent = normalSensitivity.toFixed(2);
scopeVal.textContent = scopeSensitivity.toFixed(2);

normalSlider.addEventListener("input", () => {
  normalSensitivity = parseFloat(normalSlider.value);
  normalVal.textContent = normalSensitivity.toFixed(2);
  localStorage.setItem("sens_normal", JSON.stringify(normalSensitivity));
});

scopeSlider.addEventListener("input", () => {
  scopeSensitivity = parseFloat(scopeSlider.value);
  scopeVal.textContent = scopeSensitivity.toFixed(2);
  localStorage.setItem("sens_scope", JSON.stringify(scopeSensitivity));
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
