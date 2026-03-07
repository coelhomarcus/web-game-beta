import type { WeaponDef } from "../systems/shooting";

const hud = document.createElement("div");
hud.id = "hud";
hud.innerHTML = `
  <div id="hud-left">
    <div id="hud-abilities">
      <div id="hud-grenade">
        <span id="hud-grenade-icon">💣</span>
        <span id="hud-grenade-label">Q</span>
      </div>
    </div>
    <div id="hud-hp">
      <div id="hud-hp-bottom">
        <span id="hud-hp-value">100</span>
        <span id="hud-hp-label">HP</span>
      </div>
    </div>
  </div>
  <div id="hud-right">
    <div id="hud-weapon">
      <div id="hud-weapon-keys">
        <span class="wkey active" id="wkey-1">1 FAL</span>
        <span class="wkey" id="wkey-2">2 AWP</span>
      </div>
      <span id="hud-weapon-name">FAL</span>
    </div>
    <div id="hud-ammo">
      <span id="hud-ammo-current">30</span><span id="hud-ammo-sep"> / </span><span id="hud-ammo-reserve">90</span>
    </div>
  </div>`;
document.body.appendChild(hud);

const hudHpValue = document.getElementById("hud-hp-value") as HTMLElement;
const hudAmmoCurrent = document.getElementById(
  "hud-ammo-current",
) as HTMLElement;
const hudAmmoReserve = document.getElementById(
  "hud-ammo-reserve",
) as HTMLElement;
const hudAmmoEl = document.getElementById("hud-ammo") as HTMLElement;
const hudWeaponName = document.getElementById("hud-weapon-name") as HTMLElement;

// ── Reload ring ───────────────────────────────────────────────────────────────
const RING_R = 24;
const RING_C = +(2 * Math.PI * RING_R).toFixed(2); // circumference ≈ 150.8

const reloadRingEl = document.createElement("div");
reloadRingEl.id = "reload-ring";
reloadRingEl.innerHTML = `
  <svg width="56" height="56" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
    <circle
      id="reload-ring-circle"
      cx="28" cy="28" r="${RING_R}"
      fill="none"
      stroke="rgba(255,255,255,0.9)"
      stroke-width="2.5"
      stroke-linecap="round"
      transform="rotate(-90 28 28)"
      stroke-dasharray="${RING_C}"
      stroke-dashoffset="${RING_C}"
    />
  </svg>`;
document.body.appendChild(reloadRingEl);

export function startReloadRing(duration: number) {
  reloadRingEl.classList.remove("active");
  void reloadRingEl.offsetWidth; // force reflow to restart animation
  reloadRingEl.style.setProperty("--reload-dur", `${duration}s`);
  reloadRingEl.classList.add("active");
}

export function stopReloadRing() {
  reloadRingEl.classList.remove("active");
}
const wkey1 = document.getElementById("wkey-1") as HTMLElement;
const wkey2 = document.getElementById("wkey-2") as HTMLElement;

export function updateHudHp(hp: number) {
  const pct = Math.max(0, hp);
  hudHpValue.textContent = String(pct);
  if (pct > 70) {
    hudHpValue.style.color = "#ffffff";
  } else if (pct > 30) {
    hudHpValue.style.color = "#fbbf24";
  } else {
    hudHpValue.style.color = "#ff4655";
  }
}

export function updateHudAmmo(
  current: number,
  reloading: boolean,
  reserve?: number | null,
) {
  hudAmmoCurrent.textContent = String(current);
  if (reserve !== undefined) {
    hudAmmoReserve.textContent = reserve === null ? "∞" : String(reserve);
  }
  if (reloading) {
    hudAmmoEl.classList.add("reloading");
  } else {
    hudAmmoEl.classList.remove("reloading");
  }
  hudAmmoEl.classList.toggle(
    "low-ammo",
    !reloading && current <= 5 && current > 0,
  );
  hudAmmoEl.classList.toggle("empty-ammo", !reloading && current === 0);
}

export function updateHudWeapon(w: WeaponDef) {
  hudWeaponName.textContent = w.name;
  hudWeaponName.dataset.weapon = w.id;
  wkey1.classList.toggle("active", w.id === "ar");
  wkey2.classList.toggle("active", w.id === "awp");
  hudAmmoEl.classList.toggle("awp-ammo", w.id === "awp");
}

updateHudHp(100);
