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

// Resume overlay
const resumeOverlay = document.createElement("div");
resumeOverlay.id = "resume-overlay";
resumeOverlay.innerHTML =
  '<div id="resume-card"><div id="resume-icon">🖱️</div><div id="resume-text">Clique para continuar</div></div>';
resumeOverlay.style.display = "none";
document.body.appendChild(resumeOverlay);

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
