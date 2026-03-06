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

function stopLocalInvincibleBlink() {
  if (invincibleInterval) { clearInterval(invincibleInterval); invincibleInterval = null; }
  if (invincibleTimeout) { clearTimeout(invincibleTimeout); invincibleTimeout = null; }
  invincibleOverlay.style.display = "none";
}

// Kill feed
const killFeed = document.createElement("div");
killFeed.id = "kill-feed";
document.body.appendChild(killFeed);

export function showKillFeedEntry(
  killerName: string,
  victimName: string,
  isMyKill: boolean,
  assistName?: string,
) {
  const el = document.createElement("div");
  el.className = "kill-feed-item" + (isMyKill ? " my-kill" : "");
  const killersPart = assistName
    ? `<span class="kf-killer">${killerName}</span> <span class="kf-plus">+</span> <span class="kf-assist">${assistName}</span>`
    : `<span class="kf-killer">${killerName}</span>`;
  el.innerHTML = `${killersPart} <span class="kf-icon">☠</span> <span class="kf-victim">${victimName}</span>`;
  killFeed.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 500);
  }, 2500);
}

// AWP scope overlay
const scopeOverlay = document.createElement("div");
scopeOverlay.id = "scope-overlay";
scopeOverlay.innerHTML = `
  <div class="scope-ring"></div>
  <div class="scope-cross scope-h"></div>
  <div class="scope-cross scope-v"></div>
  <div class="scope-lens-shade scope-top"></div>
  <div class="scope-lens-shade scope-bottom"></div>
  <div class="scope-lens-shade scope-left"></div>
  <div class="scope-lens-shade scope-right"></div>
`;
scopeOverlay.style.display = "none";
document.body.appendChild(scopeOverlay);

export function showScope() { scopeOverlay.style.display = "flex"; }
export function hideScope() { scopeOverlay.style.display = "none"; }
