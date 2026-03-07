// Hit marker
const hitMarker = document.createElement("div");
hitMarker.id = "hit-marker";
document.body.appendChild(hitMarker);
let hitTimeout: ReturnType<typeof setTimeout> | null = null;

export function showHitMarker(headshot = false) {
  hitMarker.classList.remove("headshot");
  hitMarker.classList.add("active");
  if (headshot) hitMarker.classList.add("headshot");
  if (hitTimeout) clearTimeout(hitTimeout);
  hitTimeout = setTimeout(
    () => {
      hitMarker.classList.remove("active", "headshot");
    },
    headshot ? 200 : 120,
  );
}

// Damage overlay
const damageOverlay = document.createElement("div");
damageOverlay.id = "damage-overlay";
document.body.appendChild(damageOverlay);
let dmgTimeout: ReturnType<typeof setTimeout> | null = null;

export function flashDamage() {
  damageOverlay.classList.add("active");
  if (dmgTimeout) clearTimeout(dmgTimeout);
  dmgTimeout = setTimeout(() => damageOverlay.classList.remove("active"), 300);
}

// ─── Damage direction indicator ───────────────────────────────────────────────
const dmgIndicatorContainer = document.createElement("div");
dmgIndicatorContainer.id = "damage-direction";
document.body.appendChild(dmgIndicatorContainer);

interface ActiveIndicator {
  el: HTMLElement;
  timer: ReturnType<typeof setTimeout>;
}
const activeIndicators: ActiveIndicator[] = [];

/**
 * Show a red arrow around the crosshair pointing toward the attacker.
 * @param angleDeg  Angle in degrees (0 = top / north on screen). Caller
 *                  computes this from world positions + camera yaw.
 */
export function showDamageDirection(angleDeg: number) {
  const el = document.createElement("div");
  el.className = "dmg-arrow";
  el.style.transform = `rotate(${angleDeg}deg) translateY(-40px)`;
  dmgIndicatorContainer.appendChild(el);

  // Trigger enter animation
  requestAnimationFrame(() => el.classList.add("active"));

  const timer = setTimeout(() => {
    el.classList.add("fade-out");
    setTimeout(() => {
      dmgIndicatorContainer.removeChild(el);
      const idx = activeIndicators.findIndex((a) => a.el === el);
      if (idx !== -1) activeIndicators.splice(idx, 1);
    }, 300);
  }, 800);

  activeIndicators.push({ el, timer });
}

// Invincibility overlay (local player) — steady blue border
const invincibleOverlay = document.createElement("div");
invincibleOverlay.id = "invincible-overlay";
invincibleOverlay.style.cssText =
  "display:none;position:fixed;inset:0;border:4px solid rgba(34,153,255,0.6);box-shadow:inset 0 0 40px rgba(34,153,255,0.15);pointer-events:none;z-index:40;border-radius:4px;";
document.body.appendChild(invincibleOverlay);

let invincibleTimeout: ReturnType<typeof setTimeout> | null = null;

export function startLocalInvincibleBlink(duration: number) {
  stopLocalInvincibleBlink();
  invincibleOverlay.style.display = "block";
  invincibleTimeout = setTimeout(() => stopLocalInvincibleBlink(), duration);
}

export function stopLocalInvincibleBlink() {
  if (invincibleTimeout) {
    clearTimeout(invincibleTimeout);
    invincibleTimeout = null;
  }
  invincibleOverlay.style.display = "none";
}

// AWP scope overlay
const scopeOverlay = document.createElement("div");
scopeOverlay.id = "scope-overlay";
document.body.appendChild(scopeOverlay);

export function showScope() {
  scopeOverlay.classList.add("active");
}
export function hideScope() {
  scopeOverlay.classList.remove("active");
}

// Kill feed
const killFeed = document.createElement("div");
killFeed.id = "kill-feed";
document.body.appendChild(killFeed);

export function showKillFeedEntry(
  killerName: string,
  victimName: string,
  isMyKill: boolean,
  weapon: string = "ar",
  assistName?: string,
) {
  const el = document.createElement("div");
  el.className = "kill-feed-item" + (isMyKill ? " my-kill" : "");

  const weaponIcon =
    weapon === "awp"
      ? `<svg class="kf-weapon-icon" viewBox="0 0 80 20" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><rect x="2" y="8" width="38" height="4" rx="1"/><rect x="40" y="6" width="22" height="3" rx="1"/><rect x="62" y="5" width="14" height="2" rx="1"/><rect x="12" y="12" width="6" height="5" rx="1"/><rect x="8" y="9" width="3" height="7" rx="1"/><polygon points="40,6 44,3 44,6"/></g></svg>`
      : `<svg class="kf-weapon-icon" viewBox="0 0 80 20" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><rect x="2" y="8" width="46" height="4" rx="1"/><rect x="48" y="7" width="18" height="3" rx="1"/><rect x="66" y="6" width="10" height="2" rx="1"/><rect x="12" y="12" width="8" height="5" rx="1"/><rect x="8" y="9" width="4" height="7" rx="1"/><rect x="20" y="7" width="2" height="5" rx="0.5"/></g></svg>`;

  const assistPart = assistName
    ? ` <span class="kf-plus">+</span> <span class="kf-assist">${assistName}</span>`
    : "";

  el.innerHTML = `<span class="kf-killer">${killerName}</span>${assistPart}${weaponIcon}<span class="kf-victim">${victimName}</span>`;
  killFeed.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 500);
  }, 4000);
}
