import { type WeaponDef } from "../systems/shooting";

const hud = document.createElement("div");
hud.id = "hud";
hud.innerHTML = `
  <div id="hud-hp">
    <span id="hud-hp-label">HP</span>
    <div id="hud-hp-bar-bg"><div id="hud-hp-bar"></div></div>
    <span id="hud-hp-value">100</span>
  </div>
  <div id="hud-kills"><span id="hud-kills-value">0</span></div>
  <div id="hud-grenade">💣 <span id="hud-grenade-label">Q</span><div id="hud-grenade-cd"></div></div>
  <div id="hud-ammo">
    🔫 <span id="hud-ammo-current">20</span><span id="hud-ammo-sep">/</span><span id="hud-ammo-reserve">∞</span>
    <div id="hud-ammo-reload"></div>
  </div>`;
document.body.appendChild(hud);

const hudHpBar = document.getElementById("hud-hp-bar") as HTMLElement;
const hudHpValue = document.getElementById("hud-hp-value") as HTMLElement;
export const hudKillsVal = document.getElementById("hud-kills-value") as HTMLElement;
const hudAmmoCurrent = document.getElementById("hud-ammo-current") as HTMLElement;
const hudAmmoEl = document.getElementById("hud-ammo") as HTMLElement;
const hudAmmoReload = document.getElementById("hud-ammo-reload") as HTMLElement;

export function updateHudHp(hp: number) {
  const pct = Math.max(0, hp);
  hudHpBar.style.width = `${pct}%`;
  hudHpValue.textContent = String(pct);
  if (pct > 50) {
    const g = Math.round(200 + 55 * ((pct - 50) / 50));
    hudHpBar.style.background = `rgb(${Math.round(200 * (1 - (pct - 50) / 50))},${g},0)`;
  } else {
    hudHpBar.style.background = `rgb(220,${Math.round(200 * (pct / 50))},0)`;
  }
}

export function updateHudAmmo(current: number, reloading: boolean) {
  hudAmmoCurrent.textContent = String(current);
  if (reloading) {
    hudAmmoEl.classList.add("reloading");
    hudAmmoReload.textContent = "Recarregando...";
  } else {
    hudAmmoEl.classList.remove("reloading");
    hudAmmoReload.textContent = "";
  }
  // Flash red when low ammo (≤5), normal otherwise
  hudAmmoEl.classList.toggle("low-ammo", !reloading && current <= 5 && current > 0);
  hudAmmoEl.classList.toggle("empty-ammo", !reloading && current === 0);
}

export function updateHudWeapon(w: WeaponDef) {
  hudAmmoCurrent.textContent = String(w.magSize);
}

updateHudHp(100);
