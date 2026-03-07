import * as THREE from "three";
import { scene } from "../scene/setup";
import { syncNameSprite } from "./NameSprite";
import { getFaceTexture, disposeFaceTexture } from "../utils/faceTexture";
import {
  otherPlayers,
  playerOriginalMaterial,
  playerCurrentNames,
  networkTargets,
} from "./playerState";
import { FAL_3P, AWP_3P, KATANA_3P } from "./weaponConfig";
import { makeWeapon, makeAwpModel, makeKatanaModel } from "./weaponModels";
import { ARM_HOLD_LEFT, ARM_HOLD_RIGHT, walkState } from "./walkAnimation";
import { cleanupRagdoll, triggerRagdoll } from "./ragdollSystem";
import { stopInvincibleBlink } from "./playerEffects";

// ─── Private body helpers ─────────────────────────────────────────────────────

function makeLimb(
  name: string,
  w: number,
  h: number,
  d: number,
  mat: THREE.MeshStandardMaterial,
  px: number,
  py: number,
  pz: number,
  meshOffY: number,
): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(px, py, pz);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = m.receiveShadow = true;
  m.position.y = meshOffY;
  g.add(m);
  return g;
}

function applyFaceTextureToGroup(
  grp: THREE.Group,
  texture: THREE.Texture,
): void {
  const headGrp = grp.getObjectByName("headGroup");
  if (!headGrp) return;
  const fp = headGrp.getObjectByName("facePlane") as THREE.Mesh | null;
  const fv = headGrp.getObjectByName("faceVisor") as THREE.Mesh | null;
  if (fp) {
    const mat = fp.material as THREE.MeshStandardMaterial;
    mat.map = texture;
    mat.needsUpdate = true;
    fp.visible = true;
  }
  if (fv) fv.visible = false;
}

function buildPlayerBody(color: string | number): {
  grp: THREE.Group;
  mat: THREE.MeshStandardMaterial;
} {
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), mat);
  torso.name = "torso";
  torso.castShadow = torso.receiveShadow = true;
  grp.add(torso);

  // Head group
  const headGrp = new THREE.Group();
  headGrp.name = "headGroup";
  headGrp.position.set(0, 0.55, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat);
  head.castShadow = true;
  headGrp.add(head);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.1), darkMat);
  face.name = "faceVisor";
  face.position.set(0, 0.0, -0.2);
  headGrp.add(face);
  const facePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.4),
    new THREE.MeshStandardMaterial({ roughness: 0.55 }),
  );
  facePlane.name = "facePlane";
  facePlane.rotation.y = Math.PI;
  facePlane.position.set(0, 0, -0.21);
  facePlane.visible = false;
  headGrp.add(facePlane);
  grp.add(headGrp);

  // Arms (shoulder pivots, posed in combat hold facing -Z)
  const leftArm = makeLimb(
    "leftArm",
    0.18,
    0.55,
    0.18,
    mat,
    -0.27,
    0.2,
    0,
    -0.27,
  );
  const rightArm = makeLimb(
    "rightArm",
    0.18,
    0.55,
    0.18,
    mat,
    0.27,
    0.2,
    0,
    -0.27,
  );
  leftArm.rotation.x = ARM_HOLD_LEFT;
  leftArm.rotation.z = 0.15;
  rightArm.rotation.x = ARM_HOLD_RIGHT;
  rightArm.rotation.z = -0.15;
  grp.add(leftArm);
  grp.add(rightArm);

  // Legs
  grp.add(makeLimb("leftLeg", 0.2, 0.6, 0.2, mat, -0.12, -0.35, 0, -0.3));
  grp.add(makeLimb("rightLeg", 0.2, 0.6, 0.2, mat, 0.12, -0.35, 0, -0.3));

  return { grp, mat };
}

// ─── Remote player management ─────────────────────────────────────────────────

export function addOtherPlayer(player: {
  id: string;
  name: string;
  color: string;
  position: { x: number; y: number; z: number };
  isDead: boolean;
  weaponId?: string;
}): void {
  const { grp, mat } = buildPlayerBody(player.color);
  playerOriginalMaterial[player.id] = mat;

  // Weapon (attached to torso group, aligned with hands)
  const wId = (player.weaponId as "ar" | "awp" | "katana") || "ar";
  const wep3p = wId === "katana" ? makeKatanaModel(false) : wId === "awp" ? makeAwpModel(false) : makeWeapon(false);
  const cfg3p = wId === "katana" ? KATANA_3P : wId === "awp" ? AWP_3P : FAL_3P;
  wep3p.name = "weapon3p";
  wep3p.userData.weaponId = wId;
  wep3p.position.set(...cfg3p.position);
  grp.add(wep3p);

  grp.position.set(player.position.x, 1, player.position.z);
  grp.visible = !player.isDead;
  scene.add(grp);
  otherPlayers[player.id] = grp;

  // Apply face texture if we already received it before the model was created
  const existingTex = getFaceTexture(player.id);
  if (existingTex) applyFaceTextureToGroup(grp, existingTex);

  syncNameSprite(grp, player.id, player.name, player.color);
}

export function removeOtherPlayer(id: string): void {
  stopInvincibleBlink(id);
  cleanupRagdoll(id);
  walkState.delete(id);
  networkTargets.delete(id);
  if (otherPlayers[id]) {
    scene.remove(otherPlayers[id]);
    delete otherPlayers[id];
  }
  delete playerOriginalMaterial[id];
  delete playerCurrentNames[id];
  disposeFaceTexture(id);
}

/** Apply a face texture to a remote player's model. */
export function applyFaceTexture(id: string, texture: THREE.Texture): void {
  const grp = otherPlayers[id];
  if (!grp) return;
  applyFaceTextureToGroup(grp, texture);
}

/** Change the body colour of a remote player's model live. */
export function applyPlayerColor(id: string, hex: string): void {
  const mat = playerOriginalMaterial[id];
  if (!mat) return;
  mat.color.set(hex);
}

/** Swap an other player's 3P weapon model (called on weapon_switch event). */
export function swapOtherPlayerWeapon(
  id: string,
  weaponId: "ar" | "awp" | "katana",
): void {
  const grp = otherPlayers[id];
  if (!grp) return;
  const old = grp.getObjectByName("weapon3p");
  if (old) grp.remove(old);
  const wep = weaponId === "katana" ? makeKatanaModel(false) : weaponId === "awp" ? makeAwpModel(false) : makeWeapon(false);
  const cfg3p = weaponId === "katana" ? KATANA_3P : weaponId === "awp" ? AWP_3P : FAL_3P;
  wep.name = "weapon3p";
  wep.userData.weaponId = weaponId;
  wep.position.set(...cfg3p.position);
  grp.add(wep);
}

// Debug: live-refresh all 3P katana models when tweaking transforms
window.addEventListener("weapon-switched-debug-3p", () => {
  for (const id of Object.keys(otherPlayers)) {
    const grp = otherPlayers[id];
    const old = grp.getObjectByName("weapon3p");
    if (!old || old.userData.weaponId !== "katana") continue;
    grp.remove(old);
    const wep = makeKatanaModel(false);
    wep.name = "weapon3p";
    wep.userData.weaponId = "katana";
    wep.position.set(...KATANA_3P.position);
    grp.add(wep);
  }
});

// ─── Local corpse (for death camera) ─────────────────────────────────────────

const LOCAL_CORPSE_ID = "__local_corpse__";
let localCorpseGroup: THREE.Group | null = null;

export function createLocalCorpse(
  color: string | number,
  position: { x: number; y: number; z: number },
  cause: "bullet" | "grenade",
  explosionPos?: { x: number; y: number; z: number },
): void {
  cleanupLocalCorpse();

  const { grp } = buildPlayerBody(color);
  grp.position.set(position.x, 1, position.z);
  scene.add(grp);

  otherPlayers[LOCAL_CORPSE_ID] = grp;
  localCorpseGroup = grp;

  // Apply local player face texture to corpse if available
  const localTex = getFaceTexture("__local__");
  if (localTex) applyFaceTextureToGroup(grp, localTex);

  triggerRagdoll(LOCAL_CORPSE_ID, cause, explosionPos);
}

export function getLocalCorpseGroup(): THREE.Group | null {
  return localCorpseGroup;
}

export function cleanupLocalCorpse(): void {
  if (!localCorpseGroup) return;
  cleanupRagdoll(LOCAL_CORPSE_ID);
  scene.remove(localCorpseGroup);
  delete otherPlayers[LOCAL_CORPSE_ID];
  localCorpseGroup = null;
}
