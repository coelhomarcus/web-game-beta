import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FAL_FP, AWP_FP, FAL_3P, AWP_3P, KATANA_FP, KATANA_3P } from "./weaponConfig";
import { otherPlayers } from "./playerState";

// ─── Pre-loaded GLB templates ─────────────────────────────────────────────────

let falTemplate: THREE.Group | null = null;
let awpTemplate: THREE.Group | null = null;
let katanaTemplate: THREE.Group | null = null;
const loader = new GLTFLoader();

loader.load("/models/M4A1/PSX_Old_FN_FAL.glb", (gltf) => {
  falTemplate = gltf.scene;
  falTemplate.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  refreshAll3PWeapons();
  window.dispatchEvent(new Event("weapon-model-loaded"));
});

loader.load("/models/SNIPER/low-poly_m24_sniper_rifle.glb", (gltf) => {
  awpTemplate = gltf.scene;
  awpTemplate.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  refreshAll3PWeapons();
  window.dispatchEvent(new Event("weapon-model-loaded"));
});

loader.load("/models/Katana/Katana.glb", (gltf) => {
  katanaTemplate = gltf.scene;
  katanaTemplate.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  refreshAll3PWeapons();
  window.dispatchEvent(new Event("weapon-model-loaded"));
});

/** Replace fallback placeholder with the real GLB on all existing 3P players. */
function refreshAll3PWeapons(): void {
  for (const id of Object.keys(otherPlayers)) {
    const grp = otherPlayers[id];
    const old = grp.getObjectByName("weapon3p");
    if (!old) continue;
    const weaponId = (old.userData.weaponId as "ar" | "awp" | "katana") || "ar";
    grp.remove(old);
    const wep = weaponId === "katana" ? makeKatanaModel(false) : weaponId === "awp" ? makeAwpModel(false) : makeWeapon(false);
    const cfg3p = weaponId === "katana" ? KATANA_3P : weaponId === "awp" ? AWP_3P : FAL_3P;
    wep.name = "weapon3p";
    wep.userData.weaponId = weaponId;
    wep.position.set(...cfg3p.position);
    grp.add(wep);
  }
}

// ─── Weapon factory functions ─────────────────────────────────────────────────

export function makeWeapon(firstPerson: boolean): THREE.Group {
  const g = new THREE.Group();
  const cfg = firstPerson ? FAL_FP : FAL_3P;

  if (falTemplate) {
    const model = falTemplate.clone();
    model.scale.set(...cfg.scale);
    model.rotation.set(...cfg.rotation);
    if (firstPerson && FAL_FP.fpOffset) {
      model.position.set(...FAL_FP.fpOffset);
    }
    g.add(model);
  } else {
    // Fallback while GLB is still loading
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
  }

  if (firstPerson) g.position.set(...FAL_FP.position);
  return g;
}

export function makeAwpModel(firstPerson: boolean): THREE.Group {
  const g = new THREE.Group();
  const cfg = firstPerson ? AWP_FP : AWP_3P;

  if (awpTemplate) {
    const model = awpTemplate.clone();
    model.scale.set(...cfg.scale);
    model.rotation.set(...cfg.rotation);
    if (firstPerson && AWP_FP.fpOffset) {
      model.position.set(...AWP_FP.fpOffset);
    }
    g.add(model);
  } else {
    // Fallback while GLB is still loading
    const m = (c: number, r = 0.5) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.07, 1.1),
      m(0x222222),
    );
    barrel.position.set(0, 0.02, -0.35);
    g.add(barrel);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.14, 0.5),
      m(0x8b5a2b, 0.9),
    );
    body.position.set(0, -0.03, 0.2);
    g.add(body);
  }

  if (firstPerson) g.position.set(...AWP_FP.position);
  return g;
}

export function makeKatanaModel(firstPerson: boolean): THREE.Group {
  const g = new THREE.Group();
  const cfg = firstPerson ? KATANA_FP : KATANA_3P;

  if (katanaTemplate) {
    const model = katanaTemplate.clone();
    model.scale.set(...cfg.scale);
    model.rotation.set(...cfg.rotation);
    if (firstPerson && KATANA_FP.fpOffset) {
      model.position.set(...KATANA_FP.fpOffset);
    }
    g.add(model);
  } else {
    // Fallback blade while GLB is loading
    const m = (c: number, r = 0.5) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 0.8),
      m(0xcccccc, 0.3),
    );
    blade.position.set(0, 0, -0.3);
    g.add(blade);
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.25),
      m(0x3d2b1f, 0.9),
    );
    handle.position.set(0, 0, 0.2);
    g.add(handle);
  }

  if (firstPerson) g.position.set(...KATANA_FP.position);
  return g;
}

/**
 * First-person arm rig — two forearm + hand blocks positioned in camera space
 * to visually "hold" the weapon. Added to the camera separately from the weapon.
 */
export function makeFirstPersonArms(
  variant: "rifle" | "awp" | "katana" = "rifle",
  color: string | number = 0xc68642,
): THREE.Group {
  const rig = new THREE.Group();
  const fpCfg = variant === "katana" ? KATANA_FP : variant === "awp" ? AWP_FP : FAL_FP;
  const [wx, wy, wz] = fpCfg.position;

  const skin = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.86,
    metalness: 0.0,
  });
  const armGeo = new THREE.BoxGeometry(0.12, 0.48, 0.12);

  function addArm(
    side: "left" | "right",
    offset: [number, number, number],
    rot: [number, number, number],
  ): void {
    const sign = side === "left" ? -1 : 1;
    const mesh = new THREE.Mesh(armGeo, skin);
    mesh.position.set(wx + offset[0] * sign, wy + offset[1], wz + offset[2]);
    mesh.rotation.set(rot[0], rot[1] * sign, rot[2] * sign);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    rig.add(mesh);
  }

  if (variant === "katana") {
    // Two-handed sword grip
    addArm("right", [0.06, 0.2, 0.15], [-0.7, 0.1, -0.1]);
    addArm("left", [0.12, 0.25, 0.08], [-0.8, 0.12, 0.05]);
  } else if (variant === "rifle") {
    addArm("right", [0.04, 0.28, 0.22], [-0.62, 0.06, -0.05]);
    addArm("left", [0.2, 0.31, -0.1], [-0.88, 0.18, 0.1]);
  } else {
    addArm("right", [0.04, -0.1, 0.22], [-0.64, 0.06, -0.05]);
    addArm("left", [0.26, -0.06, -0.3], [-0.96, 0.24, 0.12]);
  }

  return rig;
}
