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

// Scope overlay (AWP)
const scopeOverlay = document.createElement("div");
scopeOverlay.id = "scope-overlay";
scopeOverlay.style.cssText = "display:none;position:fixed;inset:0;border:3px solid rgba(0,0,0,0.8);border-radius:50%;background:radial-gradient(circle,transparent 30%,rgba(0,0,0,0.7) 70%);pointer-events:none;z-index:50;";
document.body.appendChild(scopeOverlay);

export function showScope() {
  scopeOverlay.style.display = "block";
}

export function hideScope() {
  scopeOverlay.style.display = "none";
}

// Kill feed
const killFeed = document.createElement("div");
killFeed.id = "kill-feed";
document.body.appendChild(killFeed);

export function showKillFeedEntry(
  killerName: string,
  victimName: string,
  isMyKill: boolean,
) {
  const el = document.createElement("div");
  el.className = "kill-feed-item" + (isMyKill ? " my-kill" : "");
  el.innerHTML = `<span class="kf-killer">${killerName}</span> <span class="kf-icon">☠</span> <span class="kf-victim">${victimName}</span>`;
  killFeed.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 500);
  }, 2500);
}
