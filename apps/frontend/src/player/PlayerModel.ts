import * as THREE from "three";
import { scene } from "../scene/setup";
import { syncNameSprite } from "./NameSprite";

export const otherPlayers: Record<string, THREE.Group> = {};
export const playerOriginalMaterial: Record<string, THREE.MeshStandardMaterial> = {};
export const playerCurrentNames: Record<string, string> = {};

export function makeWeapon(firstPerson: boolean): THREE.Group {
  const g = new THREE.Group();
  const m = (c: number, r = 0.5) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const barrel = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.6),
    m(0x333333),
  );
  barrel.position.set(0, 0, -0.2);
  g.add(barrel);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.15, 0.4),
    m(0x555555, 0.8),
  );
  body.position.set(0, -0.05, 0.1);
  g.add(body);
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.2, 0.1),
    m(0x222222, 0.9),
  );
  grip.position.set(0, -0.2, 0.2);
  grip.rotation.x = -Math.PI / 8;
  g.add(grip);
  if (firstPerson) g.position.set(0.3, -0.3, -0.5);
  return g;
}

export function makeAwpModel(firstPerson: boolean): THREE.Group {
  const g = new THREE.Group();
  const m = (c: number, r = 0.5) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: r });
  // Long barrel
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 1.1), m(0x222222));
  barrel.position.set(0, 0.02, -0.35);
  g.add(barrel);
  // Scope body
  const scope = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.3), m(0x111111, 0.9));
  scope.position.set(0, 0.1, -0.1);
  g.add(scope);
  // Scope lens (cyan tint)
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.05, 12),
    new THREE.MeshStandardMaterial({ color: 0x00ffff, roughness: 0.1, metalness: 0.5 }),
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0.1, -0.26);
  g.add(lens);
  // Stock / body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.5), m(0x8b5a2b, 0.9));
  body.position.set(0, -0.03, 0.2);
  g.add(body);
  // Grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.09), m(0x222222, 0.9));
  grip.position.set(0, -0.18, 0.1);
  grip.rotation.x = -Math.PI / 10;
  g.add(grip);
  if (firstPerson) g.position.set(0.3, -0.32, -0.5);
  return g;
}

export function addOtherPlayer(player: { id: string; name: string; color: string; position: { x: number; y: number; z: number }; isDead: boolean }) {
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: player.color });
  playerOriginalMaterial[player.id] = mat;
  const cap = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1, 4, 16), mat);
  cap.castShadow = cap.receiveShadow = true;
  grp.add(cap);

  const headGrp = new THREE.Group();
  headGrp.name = "headGroup";
  headGrp.position.set(0, 0.4, 0);
  const face = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.3, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x111111 }),
  );
  face.position.set(0, 0, -0.3);
  headGrp.add(face);
  headGrp.add(makeWeapon(false));
  grp.add(headGrp);

  grp.position.set(player.position.x, 1, player.position.z);
  grp.visible = !player.isDead;
  scene.add(grp);
  otherPlayers[player.id] = grp;

  syncNameSprite(grp, player.id, player.name, player.color);
}

const HIT_MAT = new THREE.MeshStandardMaterial({
  color: 0xff2222,
  emissive: 0xff0000,
  emissiveIntensity: 0.8,
});

export function flashPlayerHit(id: string) {
  const g = otherPlayers[id];
  if (!g) return;
  const cap = g.children.find(
    (c) =>
      c instanceof THREE.Mesh &&
      (c as THREE.Mesh).geometry.type === "CapsuleGeometry",
  ) as THREE.Mesh | undefined;
  if (!cap) return;
  const orig = playerOriginalMaterial[id];
  if (!orig) return;
  cap.material = HIT_MAT;
  setTimeout(() => {
    cap.material = orig;
  }, 150);
}

const blinkingPlayers: Record<string, { interval: number; toggle: boolean }> = {};

const INVINCIBLE_MAT = new THREE.MeshStandardMaterial({
  color: 0x66ccff,
  emissive: 0x3399ff,
  emissiveIntensity: 0.6,
});

export function startInvincibleBlink(id: string, duration: number) {
  stopInvincibleBlink(id);
  let toggle = false;
  const interval = setInterval(() => {
    const g = otherPlayers[id];
    if (!g) { stopInvincibleBlink(id); return; }
    const cap = g.children.find(
      (c) => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry.type === "CapsuleGeometry",
    ) as THREE.Mesh | undefined;
    if (!cap) return;
    toggle = !toggle;
    cap.material = toggle ? INVINCIBLE_MAT : (playerOriginalMaterial[id] ?? cap.material);
  }, 150);
  blinkingPlayers[id] = { interval: interval as unknown as number, toggle: false };
  setTimeout(() => stopInvincibleBlink(id), duration);
}

function stopInvincibleBlink(id: string) {
  const entry = blinkingPlayers[id];
  if (entry != null) {
    clearInterval(entry.interval);
    delete blinkingPlayers[id];
    const g = otherPlayers[id];
    if (g) {
      const cap = g.children.find(
        (c) => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry.type === "CapsuleGeometry",
      ) as THREE.Mesh | undefined;
      if (cap && playerOriginalMaterial[id]) cap.material = playerOriginalMaterial[id];
    }
  }
}

export function removeOtherPlayer(id: string) {
  stopInvincibleBlink(id);
  if (otherPlayers[id]) {
    scene.remove(otherPlayers[id]);
    delete otherPlayers[id];
  }
  delete playerOriginalMaterial[id];
  delete playerCurrentNames[id];
}
