import './style.css';
import * as THREE from 'three';
import { io } from 'socket.io-client';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

const socket = io('http://localhost:3005');

interface PlayerState {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  color: string;
  hp: number;
  isDead: boolean;
}

const otherPlayers: Record<string, THREE.Group> = {};
const playerOriginalMaterial: Record<string, THREE.MeshStandardMaterial> = {};
const playerCurrentNames: Record<string, string> = {};

let myId = '';
let isDead = false;
let playerName = '';
let gameStarted = false;

// ─── Stats (session only) ─────────────────────────────────────────────────────
interface Stats { name: string; kills: number; deaths: number; color: string; }
const allStats: Record<string, Stats> = {};

// ─── HUD ─────────────────────────────────────────────────────────────────────
const hud = document.createElement('div');
hud.id = 'hud';
hud.innerHTML = `
  <div id="hud-hp">
    <span id="hud-hp-label">HP</span>
    <div id="hud-hp-bar-bg"><div id="hud-hp-bar"></div></div>
    <span id="hud-hp-value">100</span>
  </div>
  <div id="hud-kills"><span id="hud-kills-value">0</span></div>`;
document.body.appendChild(hud);

const hudHpBar = document.getElementById('hud-hp-bar') as HTMLElement;
const hudHpValue = document.getElementById('hud-hp-value') as HTMLElement;
const hudKillsVal = document.getElementById('hud-kills-value') as HTMLElement;

function updateHudHp(hp: number) {
  const pct = Math.max(0, hp);
  hudHpBar.style.width = `${pct}%`;
  hudHpValue.textContent = String(pct);
  // Green → Yellow → Red like Roblox health bar
  if (pct > 50) {
    const g = Math.round(200 + 55 * ((pct - 50) / 50));
    hudHpBar.style.background = `rgb(${Math.round(200 * (1 - (pct - 50) / 50))},${g},0)`;
  } else {
    hudHpBar.style.background = `rgb(220,${Math.round(200 * (pct / 50))},0)`;
  }
}
updateHudHp(100);

// Hit marker
const hitMarker = document.createElement('div');
hitMarker.id = 'hit-marker';
document.body.appendChild(hitMarker);
let hitTimeout: ReturnType<typeof setTimeout> | null = null;
function showHitMarker() {
  hitMarker.classList.add('active');
  if (hitTimeout) clearTimeout(hitTimeout);
  hitTimeout = setTimeout(() => hitMarker.classList.remove('active'), 120);
}

// Resume overlay (shown on ESC — click anywhere to re-lock pointer)
const resumeOverlay = document.createElement('div');
resumeOverlay.id = 'resume-overlay';
resumeOverlay.innerHTML = '<div id="resume-card"><div id="resume-icon">🖱️</div><div id="resume-text">Clique para continuar</div></div>';
resumeOverlay.style.display = 'none';
document.body.appendChild(resumeOverlay);


// ─── Bullets ─────────────────────────────────────────────────────────────────
const activeBullets: { mesh: THREE.Mesh; dir: THREE.Vector3; lifeTime: number }[] = [];
const bulletGeo = new THREE.SphereGeometry(0.06, 6, 6);
const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffe000 });

function createVisualBullet(origin: THREE.Vector3, dir: THREE.Vector3) {
  const mesh = new THREE.Mesh(bulletGeo, bulletMat);
  mesh.position.copy(origin);
  scene.add(mesh);
  activeBullets.push({ mesh, dir: dir.clone().normalize(), lifeTime: 0 });
}

// ─── Audio ────────────────────────────────────────────────────────────────────
const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
function playShootSound() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.1);
}

// ─── Scene ────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 0, 60);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const PLAYER_HEIGHT = 1.6;
camera.position.set(0, PLAYER_HEIGHT, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('app')!.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(20, 50, 20); sun.castShadow = true;
sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 100;
sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
scene.add(sun);

const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({ color: 0x90ee90, roughness: 0.8, metalness: 0.2 })
);
plane.rotation.x = -Math.PI / 2; plane.receiveShadow = true; scene.add(plane);

// Cover blocks — deterministic seed
const mapBlocks: THREE.Mesh[] = [];
const rng = (() => { let s = 42; return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 2 ** 32; }; })();
for (let i = 0; i < 20; i++) {
  const h = rng() * 4 + 1;
  const box = new THREE.Mesh(new THREE.BoxGeometry(2, h, 2), new THREE.MeshStandardMaterial({ color: 0x888888 }));
  box.position.set((rng() - 0.5) * 40, h / 2, (rng() - 0.5) * 40);
  box.castShadow = box.receiveShadow = true;
  scene.add(box); mapBlocks.push(box);
}

// ─── Controls ─────────────────────────────────────────────────────────────────
const controls = new PointerLockControls(camera, document.body);
const startScreen = document.getElementById('start-screen')!;
const deathScreen = document.getElementById('death-screen')!;
const nameInput = document.getElementById('name-input') as HTMLInputElement;
const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
const scoreboard = document.getElementById('scoreboard')!;
const scoreBody = document.getElementById('scoreboard-body')!;

function startGame() {
  playerName = nameInput.value.trim().slice(0, 16) || 'Anônimo';
  if (myId) {
    socket.emit('set_name', { name: playerName });
    if (allStats[myId]) allStats[myId].name = playerName;
  }
  gameStarted = true;
  startScreen.style.display = 'none';
  controls.lock();
}
playBtn.addEventListener('click', startGame);
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') startGame(); });

controls.addEventListener('lock', () => {
  if (myId && playerName) {
    socket.emit('set_name', { name: playerName });
    if (allStats[myId]) allStats[myId].name = playerName;
  }
});
controls.addEventListener('unlock', () => {
  if (isDead || !gameStarted) return;
  // Show resume overlay — click on the overlay itself to re-lock
  resumeOverlay.style.display = 'flex';
});
scene.add(controls.object);

// ─── Weapon ───────────────────────────────────────────────────────────────────
function makeWeapon(firstPerson: boolean) {
  const g = new THREE.Group();
  const m = (c: number, r = 0.5) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.6), m(0x333333));
  barrel.position.set(0, 0, -0.2); g.add(barrel);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.4), m(0x555555, 0.8));
  body.position.set(0, -0.05, 0.1); g.add(body);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1), m(0x222222, 0.9));
  grip.position.set(0, -0.2, 0.2); grip.rotation.x = -Math.PI / 8; g.add(grip);
  if (firstPerson) g.position.set(0.3, -0.3, -0.5);
  return g;
}
camera.add(makeWeapon(true));

// ─── Shooting ─────────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
raycaster.near = 0.1;

function findPlayerGroup(o: THREE.Object3D): THREE.Group | null {
  let cur: THREE.Object3D | null = o;
  while (cur) {
    if (cur instanceof THREE.Group && Object.values(otherPlayers).includes(cur as THREE.Group)) return cur;
    cur = cur.parent;
  }
  return null;
}

window.addEventListener('mousedown', e => {
  if (e.button !== 0 || !controls.isLocked || isDead) return;
  playShootSound();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects(Object.values(otherPlayers), true);
  if (hits.length > 0) {
    const grp = findPlayerGroup(hits[0].object);
    if (grp) {
      const tid = Object.keys(otherPlayers).find(id => otherPlayers[id] === grp);
      if (tid) { socket.emit('hit_player', { targetId: tid }); showHitMarker(); }
    }
  }
  const orig = new THREE.Vector3(); camera.getWorldPosition(orig); orig.y -= 0.1;
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  createVisualBullet(orig, dir);
  socket.emit('shoot', { origin: { x: orig.x, y: orig.y, z: orig.z }, direction: { x: dir.x, y: dir.y, z: dir.z } });
});

// ─── Physics ──────────────────────────────────────────────────────────────────
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let wantsJump = false, isOnGround = false;
const velocity = new THREE.Vector3();
const moveDir = new THREE.Vector3();
let prevTime = performance.now();

const GRAVITY = -25, JUMP_FORCE = 8, PLAYER_RADIUS = 0.4;
const ACCELERATION = 100, FRICTION = 12;

function resolveBoxCollision(pos: THREE.Vector3, box: THREE.Mesh) {
  const geo = box.geometry as THREE.BoxGeometry;
  const hw = geo.parameters.width / 2 + PLAYER_RADIUS;
  const hh = geo.parameters.height / 2;
  const hd = geo.parameters.depth / 2 + PLAYER_RADIUS;
  const { x: bx, y: by, z: bz } = box.position;
  const pBot = pos.y - PLAYER_HEIGHT, pTop = pos.y;
  const bBot = by - hh, bTop = by + hh;
  const ox = hw - Math.abs(pos.x - bx);
  const oy = Math.min(pTop, bTop) - Math.max(pBot, bBot);
  const oz = hd - Math.abs(pos.z - bz);
  if (ox > 0 && oy > 0 && oz > 0) {
    if (ox < oz && ox < oy) { pos.x += ox * Math.sign(pos.x - bx); velocity.x = 0; }
    else if (oz < ox && oz < oy) { pos.z += oz * Math.sign(pos.z - bz); velocity.z = 0; }
    else if (pos.y > by) { pos.y = bTop + PLAYER_HEIGHT; if (velocity.y < 0) { velocity.y = 0; isOnGround = true; } }
    else { pos.y = bBot - 0.01; if (velocity.y > 0) velocity.y = 0; }
  }
}

// ─── Scoreboard ───────────────────────────────────────────────────────────────
function renderScoreboard() {
  const rows = Object.entries(allStats).sort((a, b) => b[1].kills - a[1].kills);
  scoreBody.innerHTML = '';
  for (const [id, s] of rows) {
    const kd = s.deaths > 0 ? (s.kills / s.deaths).toFixed(2) : s.kills.toString();
    const tr = document.createElement('tr');
    if (id === myId) tr.classList.add('my-row');
    tr.innerHTML = `<td><span class="player-dot" style="background:${s.color}"></span>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${kd}</td>`;
    scoreBody.appendChild(tr);
  }
}

// ─── Name sprites ─────────────────────────────────────────────────────────────
function createNameSprite(name: string, _color: string): THREE.Sprite {
  const w = 512, h = 96;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d')!;
  // Text only — no background, no pill
  ctx.font = 'bold 52px "Nunito", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Black outline for readability against any background
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.lineWidth = 10;
  ctx.lineJoin = 'round';
  ctx.strokeText(name.slice(0, 16), w / 2, h / 2);
  // White fill
  ctx.fillStyle = '#ffffff';
  ctx.fillText(name.slice(0, 16), w / 2, h / 2);
  const tex = new THREE.CanvasTexture(cv);
  // depthTest: true → sprite is hidden behind walls/blocks
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.6, 0.49, 1);
  sprite.name = 'nameSprite';
  return sprite;
}

function syncNameSprite(group: THREE.Group, id: string, name: string, color: string) {
  if (playerCurrentNames[id] === name) return;
  const old = group.getObjectByName('nameSprite') as THREE.Sprite | undefined;
  if (old) { ((old.material as THREE.SpriteMaterial).map)?.dispose(); group.remove(old); }
  const sprite = createNameSprite(name, color);
  sprite.position.set(0, 1.7, 0);
  group.add(sprite);
  playerCurrentNames[id] = name;
}

// ─── Input ────────────────────────────────────────────────────────────────────

// Keys that can steal focus from the browser window and release pointer lock
const SUPPRESS_KEYS = new Set([
  'AltLeft', 'AltRight',
  'MetaLeft', 'MetaRight',
  'ContextMenu',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
]);

window.addEventListener('keydown', e => {
  if (SUPPRESS_KEYS.has(e.code)) { e.preventDefault(); return; }
  switch (e.code) {
    case 'KeyW': moveForward = true; break;
    case 'KeyA': moveLeft = true; break;
    case 'KeyS': moveBackward = true; break;
    case 'KeyD': moveRight = true; break;
    case 'Space': if (isOnGround) wantsJump = true; break;
    case 'Tab':
      e.preventDefault(); renderScoreboard();
      scoreboard.classList.add('visible'); break;
  }
});
window.addEventListener('keyup', e => {
  switch (e.code) {
    case 'KeyW': moveForward = false; break;
    case 'KeyA': moveLeft = false; break;
    case 'KeyS': moveBackward = false; break;
    case 'KeyD': moveRight = false; break;
    case 'Tab': e.preventDefault(); scoreboard.classList.remove('visible'); break;
  }
});

// Click on the resume overlay to re-lock the pointer (shown after ESC)
resumeOverlay.addEventListener('mousedown', (e) => {
  e.stopPropagation();
  resumeOverlay.style.display = 'none';
  controls.lock();
});


window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Socket events ────────────────────────────────────────────────────────────
socket.on('init', (data: { id: string; players: Record<string, PlayerState> }) => {
  myId = data.id;
  if (playerName) {
    socket.emit('set_name', { name: playerName });
  }
  const me = data.players[myId];
  if (me) {
    camera.position.set(me.position.x, PLAYER_HEIGHT, me.position.z);
    updateHudHp(me.hp);
    // Use the locally typed name — it's already known before init arrives
    allStats[myId] = { name: playerName || me.name, kills: 0, deaths: 0, color: me.color };
  }
  for (const id in data.players) {
    if (id !== myId) {
      const p = data.players[id];
      addOtherPlayer(p);
      allStats[id] = { name: p.name, kills: 0, deaths: 0, color: p.color };
    }
  }
});

socket.on('player_joined', (p: PlayerState) => {
  if (p.id === myId) return;
  addOtherPlayer(p);
  allStats[p.id] = { name: p.name, kills: 0, deaths: 0, color: p.color };
});

socket.on('player_left', (id: string) => {
  if (otherPlayers[id]) { scene.remove(otherPlayers[id]); delete otherPlayers[id]; }
  delete playerOriginalMaterial[id];
  delete playerCurrentNames[id];
  delete allStats[id];
});

socket.on('game_state', (players: Record<string, PlayerState>) => {
  for (const id in players) {
    if (id === myId) continue;
    const mesh = otherPlayers[id];
    if (!mesh) continue;
    const p = players[id];
    mesh.visible = !p.isDead;
    if (!p.isDead) {
      mesh.position.lerp(new THREE.Vector3(p.position.x, p.position.y, p.position.z), 0.3);
      mesh.rotation.y = p.rotation.y;
      const hg = mesh.getObjectByName('headGroup');
      if (hg) hg.rotation.x = p.rotation.x;
      syncNameSprite(mesh, id, p.name, p.color);
    }
    if (allStats[id]) allStats[id].name = p.name;
  }
});

const HIT_MAT = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 0.8 });
function flashPlayerHit(id: string) {
  const g = otherPlayers[id]; if (!g) return;
  const cap = g.children.find(c => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry.type === 'CapsuleGeometry') as THREE.Mesh | undefined;
  if (!cap) return;
  const orig = playerOriginalMaterial[id]; if (!orig) return;
  cap.material = HIT_MAT;
  setTimeout(() => { cap.material = orig; }, 150);
}

socket.on('player_hit', (data: { id: string; hp: number }) => {
  if (data.id === myId) { updateHudHp(data.hp); flashDamage(); }
  else flashPlayerHit(data.id);
});

socket.on('player_killed', (data: { victim: string; killer: string }) => {
  if (allStats[data.killer]) allStats[data.killer].kills++;
  if (allStats[data.victim]) allStats[data.victim].deaths++;

  const killerName = allStats[data.killer]?.name ?? 'Desconhecido';
  const victimName = allStats[data.victim]?.name ?? 'Desconhecido';

  // Show kill feed to EVERYONE
  showKillFeedEntry(killerName, victimName, data.killer === myId);

  if (data.victim === myId) {
    isDead = true;
    updateHudHp(0); controls.unlock();
    deathScreen.style.display = 'flex';
  } else {
    if (otherPlayers[data.victim]) otherPlayers[data.victim].visible = false;
    if (data.killer === myId) {
      const kills = (allStats[myId]?.kills ?? 0);
      hudKillsVal.textContent = String(kills);
    }
  }
});

socket.on('player_respawned', (p: PlayerState) => {
  if (p.id === myId) {
    isDead = false;
    camera.position.set(p.position.x, PLAYER_HEIGHT, p.position.z);
    velocity.set(0, 0, 0);
    updateHudHp(100);
    deathScreen.style.display = 'none';
    controls.lock();
  } else if (otherPlayers[p.id]) {
    otherPlayers[p.id].position.set(p.position.x, p.position.y, p.position.z);
    otherPlayers[p.id].visible = true;
  }
});

socket.on('shoot_bullet', (data: { origin: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number } }) => {
  createVisualBullet(new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z),
    new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z));
});

socket.on('server_full', (data: { message: string }) => { alert(data.message); });

// ─── Visual feedback ──────────────────────────────────────────────────────────
const damageOverlay = document.createElement('div');
damageOverlay.id = 'damage-overlay';
document.body.appendChild(damageOverlay);
let dmgTimeout: ReturnType<typeof setTimeout> | null = null;
function flashDamage() {
  damageOverlay.classList.add('active');
  if (dmgTimeout) clearTimeout(dmgTimeout);
  dmgTimeout = setTimeout(() => damageOverlay.classList.remove('active'), 300);
}

const killFeed = document.createElement('div');
killFeed.id = 'kill-feed';
document.body.appendChild(killFeed);

function showKillFeedEntry(killerName: string, victimName: string, iMyKill: boolean) {
  const el = document.createElement('div');
  el.className = 'kill-feed-item' + (iMyKill ? ' my-kill' : '');
  el.innerHTML = `<span class="kf-killer">${killerName}</span> <span class="kf-icon">☠</span> <span class="kf-victim">${victimName}</span>`;
  killFeed.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 500); }, 2500);
}

// ─── Player model ─────────────────────────────────────────────────────────────
function addOtherPlayer(player: PlayerState) {
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: player.color });
  playerOriginalMaterial[player.id] = mat;
  const cap = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1, 4, 16), mat);
  cap.castShadow = cap.receiveShadow = true;
  grp.add(cap);

  const headGrp = new THREE.Group();
  headGrp.name = 'headGroup';
  headGrp.position.set(0, 0.4, 0);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  face.position.set(0, 0, -0.3); headGrp.add(face);
  headGrp.add(makeWeapon(false));
  grp.add(headGrp);

  grp.position.set(player.position.x, 1, player.position.z);
  grp.visible = !player.isDead;
  scene.add(grp);
  otherPlayers[player.id] = grp;

  // Name sprite
  syncNameSprite(grp, player.id, player.name, player.color);
}

// ─── Game loop ────────────────────────────────────────────────────────────────
const BULLET_SPEED = 60.0, BULLET_MAX_LIFETIME = 2.0;

function animate() {
  requestAnimationFrame(animate);
  const time = performance.now();
  const delta = Math.min((time - prevTime) / 1000, 0.05);
  prevTime = time;

  if (controls.isLocked && !isDead) {
    velocity.x -= velocity.x * FRICTION * delta;
    velocity.z -= velocity.z * FRICTION * delta;
    moveDir.z = Number(moveForward) - Number(moveBackward);
    moveDir.x = Number(moveRight) - Number(moveLeft);
    moveDir.normalize();
    if (moveForward || moveBackward) velocity.z -= moveDir.z * ACCELERATION * delta;
    if (moveLeft || moveRight) velocity.x -= moveDir.x * ACCELERATION * delta;

    if (wantsJump && isOnGround) { velocity.y = JUMP_FORCE; isOnGround = false; wantsJump = false; }
    isOnGround = false;
    velocity.y += GRAVITY * delta;
    camera.position.y += velocity.y * delta;
    if (camera.position.y <= PLAYER_HEIGHT) {
      camera.position.y = PLAYER_HEIGHT; velocity.y = 0; isOnGround = true;
    }

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);
    for (const box of mapBlocks) resolveBoxCollision(camera.position, box);
    camera.position.x = Math.max(-49, Math.min(49, camera.position.x));
    camera.position.z = Math.max(-49, Math.min(49, camera.position.z));

    if (myId) {
      const bodyY = camera.position.y - PLAYER_HEIGHT + 1;
      socket.emit('update_state', {
        position: { x: camera.position.x, y: bodyY, z: camera.position.z },
        rotation: { x: camera.rotation.x, y: camera.rotation.y, z: 0 },
      });
    }
  }

  for (let i = activeBullets.length - 1; i >= 0; i--) {
    const b = activeBullets[i];
    b.mesh.position.addScaledVector(b.dir, BULLET_SPEED * delta);
    b.lifeTime += delta;
    if (b.lifeTime > BULLET_MAX_LIFETIME || b.mesh.position.y <= 0) {
      scene.remove(b.mesh); activeBullets.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
}
animate();
