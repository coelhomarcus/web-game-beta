// Hit marker
const hitMarker = document.createElement("div");
hitMarker.id = "hit-marker";
document.body.appendChild(hitMarker);
let hitTimeout: ReturnType<typeof setTimeout> | null = null;

export function showHitMarker() {
  hitMarker.classList.add("active");
  if (hitTimeout) clearTimeout(hitTimeout);
  hitTimeout = setTimeout(() => hitMarker.classList.remove("active"), 120);
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

// Invincibility overlay (local player)
const invincibleOverlay = document.createElement("div");
invincibleOverlay.id = "invincible-overlay";
invincibleOverlay.style.cssText = "display:none;position:fixed;inset:0;border:3px solid rgba(255,255,255,0.6);pointer-events:none;z-index:40;";
document.body.appendChild(invincibleOverlay);

let invincibleInterval: ReturnType<typeof setInterval> | null = null;
let invincibleTimeout: ReturnType<typeof setTimeout> | null = null;

export function startLocalInvincibleBlink(duration: number) {
  stopLocalInvincibleBlink();
  invincibleOverlay.style.display = "block";
  invincibleInterval = setInterval(() => {
    invincibleOverlay.style.display =
      invincibleOverlay.style.display === "none" ? "block" : "none";
  }, 100);
  invincibleTimeout = setTimeout(() => stopLocalInvincibleBlink(), duration);
}

export function stopLocalInvincibleBlink() {
  if (invincibleInterval) { clearInterval(invincibleInterval); invincibleInterval = null; }
  if (invincibleTimeout) { clearTimeout(invincibleTimeout); invincibleTimeout = null; }
  invincibleOverlay.style.display = "none";
}

// AWP scope overlay
const scopeOverlay = document.createElement("div");
scopeOverlay.id = "scope-overlay";
document.body.appendChild(scopeOverlay);

export function showScope() { scopeOverlay.classList.add("active"); }
export function hideScope() { scopeOverlay.classList.remove("active"); }

// Kill feed
const killFeed = document.createElement("div");
killFeed.id = "kill-feed";
document.body.appendChild(killFeed);

export function showKillFeedEntry(
  killerName: string,
  victimName: string,
  isMyKill: boolean,
  weapon: string = 'ar',
  assistName?: string,
) {
  const el = document.createElement("div");
  el.className = "kill-feed-item" + (isMyKill ? " my-kill" : "");

  const weaponIcon = weapon === 'awp'
    ? `<svg class="kf-weapon-icon" viewBox="0 0 80 20" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><rect x="2" y="8" width="38" height="4" rx="1"/><rect x="40" y="6" width="22" height="3" rx="1"/><rect x="62" y="5" width="14" height="2" rx="1"/><rect x="12" y="12" width="6" height="5" rx="1"/><rect x="8" y="9" width="3" height="7" rx="1"/><polygon points="40,6 44,3 44,6"/></g></svg>`
    : `<svg class="kf-weapon-icon" viewBox="0 0 80 20" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><rect x="2" y="8" width="46" height="4" rx="1"/><rect x="48" y="7" width="18" height="3" rx="1"/><rect x="66" y="6" width="10" height="2" rx="1"/><rect x="12" y="12" width="8" height="5" rx="1"/><rect x="8" y="9" width="4" height="7" rx="1"/><rect x="20" y="7" width="2" height="5" rx="0.5"/></g></svg>`;

  const assistPart = assistName
    ? ` <span class="kf-plus">+</span> <span class="kf-assist">${assistName}</span>`
    : '';

  el.innerHTML = `<span class="kf-killer">${killerName}</span>${assistPart}${weaponIcon}<span class="kf-victim">${victimName}</span>`;
  killFeed.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 500);
  }, 4000);
}


