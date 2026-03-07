import * as THREE from "three";
import { scene } from "../scene/setup";
import { otherPlayers, playerOriginalMaterial } from "./playerState";

// ─── Hit flash ────────────────────────────────────────────────────────────────

export function flashPlayerHit(id: string): void {
  const orig = playerOriginalMaterial[id];
  if (!orig) return;
  // Mutate the shared material so every body part flashes simultaneously.
  orig.emissive.setHex(0xff0000);
  orig.emissiveIntensity = 0.8;
  setTimeout(() => {
    orig.emissive.setHex(0x000000);
    orig.emissiveIntensity = 0;
  }, 150);
}

// ─── Invincibility shield ─────────────────────────────────────────────────────

const shieldMeshes: Record<string, THREE.Mesh> = {};

export function isPlayerInvincible(id: string): boolean {
  return id in shieldMeshes;
}

export function startInvincibleBlink(id: string, duration: number): void {
  stopInvincibleBlink(id);
  const grp = otherPlayers[id];
  if (!grp) return;

  const capsule = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.55, 1.2, 8, 16),
    new THREE.MeshStandardMaterial({
      color: 0x2299ff,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: 0x2299ff,
      emissiveIntensity: 0.4,
    }),
  );
  capsule.name = "invincible-shield";
  capsule.position.set(0, 0.1, 0);
  grp.add(capsule);
  shieldMeshes[id] = capsule;

  setTimeout(() => stopInvincibleBlink(id), duration);
}

export function stopInvincibleBlink(id: string): void {
  const capsule = shieldMeshes[id];
  if (capsule) {
    const grp = otherPlayers[id];
    if (grp) grp.remove(capsule);
    capsule.geometry.dispose();
    (capsule.material as THREE.Material).dispose();
    delete shieldMeshes[id];
  }
}

// ─── Floating damage numbers ──────────────────────────────────────────────────

interface FloatingNumber {
  sprite: THREE.Sprite;
  velY: number;
  elapsed: number;
  lifetime: number;
}

const activeFloats: FloatingNumber[] = [];

function makeDamageSprite(damage: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 128, 64);
  ctx.font = "bold 44px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "rgba(0,0,0,0.9)";
  ctx.lineWidth = 6;
  ctx.strokeText(`-${damage}`, 64, 34);
  ctx.fillStyle =
    damage >= 100 ? "#ff3300" : damage >= 50 ? "#ff7700" : "#ffdd00";
  ctx.fillText(`-${damage}`, 64, 34);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.9, 0.45, 1);
  return sprite;
}

export function showDamageNumber(id: string, damage: number): void {
  const grp = otherPlayers[id];
  if (!grp || !grp.visible) return;

  const sprite = makeDamageSprite(damage);
  sprite.position.set(
    grp.position.x + (Math.random() - 0.5) * 0.5,
    grp.position.y + 1,
    grp.position.z + (Math.random() - 0.5) * 0.3,
  );
  scene.add(sprite);

  activeFloats.push({
    sprite,
    velY: 2.0 + Math.random() * 0.6,
    elapsed: 0,
    lifetime: 1.1,
  });
}

export function updateFloatingDamageNumbers(delta: number): void {
  for (let i = activeFloats.length - 1; i >= 0; i--) {
    const f = activeFloats[i];
    f.elapsed += delta;

    f.sprite.position.y += f.velY * delta;
    f.velY = Math.max(0, f.velY - 3 * delta);

    // Fade out in last 50% of lifetime
    const fadeStart = f.lifetime * 0.5;
    if (f.elapsed >= fadeStart) {
      const t = (f.elapsed - fadeStart) / (f.lifetime - fadeStart);
      (f.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - t);
    }

    if (f.elapsed >= f.lifetime) {
      scene.remove(f.sprite);
      const mat = f.sprite.material as THREE.SpriteMaterial;
      mat.map?.dispose();
      mat.dispose();
      activeFloats.splice(i, 1);
    }
  }
}
