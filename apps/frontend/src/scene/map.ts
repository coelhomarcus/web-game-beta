import * as THREE from "three";
import { scene } from "./setup";

// ═══════════════════════════════════════════════════════════════════════════════
// GROUND LAYERS (visual only, no collision)
// ═══════════════════════════════════════════════════════════════════════════════

// Base grass
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({ color: 0x26854c, roughness: 0.9, metalness: 0.1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Center arena concrete
const arenaFloor = new THREE.Mesh(
  new THREE.PlaneGeometry(22, 22),
  new THREE.MeshStandardMaterial({ color: 0x4d3533, roughness: 0.85 }),
);
arenaFloor.rotation.x = -Math.PI / 2;
arenaFloor.position.y = 0.01;
arenaFloor.receiveShadow = true;
scene.add(arenaFloor);

// Cross roads
const roadMat = new THREE.MeshStandardMaterial({ color: 0x6e4c30, roughness: 0.85 });
const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(5, 96), roadMat);
roadNS.rotation.x = -Math.PI / 2;
roadNS.position.y = 0.005;
roadNS.receiveShadow = true;
scene.add(roadNS);
const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(96, 5), roadMat);
roadEW.rotation.x = -Math.PI / 2;
roadEW.position.y = 0.005;
roadEW.receiveShadow = true;
scene.add(roadEW);

// Corner compound floors
const compoundFloorMat = new THREE.MeshStandardMaterial({ color: 0x94493a, roughness: 0.85 });
for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
  const cf = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), compoundFloorMat);
  cf.rotation.x = -Math.PI / 2;
  cf.position.set(sx * 24, 0.008, sz * 24);
  cf.receiveShadow = true;
  scene.add(cf);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAP BLOCKS (collidable geometry)
// ═══════════════════════════════════════════════════════════════════════════════

export const mapBlocks: THREE.Mesh[] = [];

// ─── Materials ───────────────────────────────────────────────────────────────
const boundaryMat = new THREE.MeshStandardMaterial({ color: 0x3e3b65, roughness: 0.9 });
const wallMat     = new THREE.MeshStandardMaterial({ color: 0x5e5b8c, roughness: 0.85 });
const concreteMat = new THREE.MeshStandardMaterial({ color: 0x8c78a5, roughness: 0.8 });
const darkConcMat = new THREE.MeshStandardMaterial({ color: 0x2c1e31, roughness: 0.8 });
const crateMat    = new THREE.MeshStandardMaterial({ color: 0xce9248, roughness: 0.7 });
const metalMat    = new THREE.MeshStandardMaterial({ color: 0x1e4044, roughness: 0.5, metalness: 0.3 });
const towerMat    = new THREE.MeshStandardMaterial({ color: 0xb0a7b8, roughness: 0.75 });

function addBlock(x: number, z: number, w: number, h: number, d: number, mat: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  mapBlocks.push(mesh);
}

// ─── Boundary Walls ──────────────────────────────────────────────────────────
addBlock(  0, -48, 98, 4, 1, boundaryMat); // North
addBlock(  0,  48, 98, 4, 1, boundaryMat); // South
addBlock( 48,   0,  1, 4, 98, boundaryMat); // East
addBlock(-48,   0,  1, 4, 98, boundaryMat); // West

// ─── Center Structure ────────────────────────────────────────────────────────
addBlock(0, 0, 10, 0.6, 10, darkConcMat);  // low platform
addBlock(0, 0,  3,   6,  3, towerMat);     // tall tower

// ─── NW Compound ─────────────────────────────────────────────────────────────
addBlock(-28, -22,    1, 3.5,  12, wallMat);  // back wall (N-S)
addBlock(-22, -28,   12, 3.5,   1, wallMat);  // side wall (E-W)
addBlock(-22, -22,    6, 2.5,   1, wallMat);  // interior wall
addBlock(-25, -25,    2,   2,   2, crateMat); // crate stack
addBlock(-25, -19,  1.5, 1.2, 1.5, crateMat); // small crate

// ─── NE Compound (mirror) ───────────────────────────────────────────────────
addBlock( 28, -22,    1, 3.5,  12, wallMat);
addBlock( 22, -28,   12, 3.5,   1, wallMat);
addBlock( 22, -22,    6, 2.5,   1, wallMat);
addBlock( 25, -25,    2,   2,   2, crateMat);
addBlock( 25, -19,  1.5, 1.2, 1.5, crateMat);

// ─── SW Compound (mirror) ───────────────────────────────────────────────────
addBlock(-28,  22,    1, 3.5,  12, wallMat);
addBlock(-22,  28,   12, 3.5,   1, wallMat);
addBlock(-22,  22,    6, 2.5,   1, wallMat);
addBlock(-25,  25,    2,   2,   2, crateMat);
addBlock(-25,  19,  1.5, 1.2, 1.5, crateMat);

// ─── SE Compound (mirror) ───────────────────────────────────────────────────
addBlock( 28,  22,    1, 3.5,  12, wallMat);
addBlock( 22,  28,   12, 3.5,   1, wallMat);
addBlock( 22,  22,    6, 2.5,   1, wallMat);
addBlock( 25,  25,    2,   2,   2, crateMat);
addBlock( 25,  19,  1.5, 1.2, 1.5, crateMat);

// ─── Mid Crossing Walls (N/S, with center gap) ──────────────────────────────
addBlock(-7, -15, 8, 2.5, 1, concreteMat);
addBlock( 7, -15, 8, 2.5, 1, concreteMat);
addBlock( 0, -18, 2, 1.5, 2, crateMat);     // crate in front
addBlock(-7,  15, 8, 2.5, 1, concreteMat);
addBlock( 7,  15, 8, 2.5, 1, concreteMat);
addBlock( 0,  18, 2, 1.5, 2, crateMat);

// ─── East Lane — Sniper Tower & Cover ────────────────────────────────────────
addBlock( 38,   0, 3, 5, 3, metalMat);       // sniper tower
addBlock( 38, -12, 4, 2, 1, concreteMat);    // cover wall
addBlock( 38,  12, 4, 2, 1, concreteMat);    // cover wall
addBlock( 40, -35, 5, 2.5, 3, metalMat);     // container N
addBlock( 40,  35, 5, 2.5, 3, metalMat);     // container S

// ─── West Lane — Sniper Tower & Cover ────────────────────────────────────────
addBlock(-38,   0, 3, 5, 3, metalMat);
addBlock(-38, -12, 4, 2, 1, concreteMat);
addBlock(-38,  12, 4, 2, 1, concreteMat);
addBlock(-40, -35, 5, 2.5, 3, metalMat);
addBlock(-40,  35, 5, 2.5, 3, metalMat);

// ─── Inner Cover (around center) ─────────────────────────────────────────────
addBlock(-12, -8, 1, 2.2, 3, concreteMat);
addBlock( 12, -8, 1, 2.2, 3, concreteMat);
addBlock(-12,  8, 1, 2.2, 3, concreteMat);
addBlock( 12,  8, 1, 2.2, 3, concreteMat);

// ─── Small Crates (diagonal around center) ───────────────────────────────────
addBlock(-5, -5, 1.5, 1, 1.5, crateMat);
addBlock( 5,  5, 1.5, 1, 1.5, crateMat);
addBlock(-5,  5, 1.5, 1, 1.5, crateMat);
addBlock( 5, -5, 1.5, 1, 1.5, crateMat);

// ─── Mid Lane Barriers (E/W) ────────────────────────────────────────────────
addBlock(-20, 0, 3, 1.5, 1, concreteMat);
addBlock( 20, 0, 3, 1.5, 1, concreteMat);

// ─── Outer Area Crates (near spawn zones) ────────────────────────────────────
addBlock(-10, -35, 3, 1.8, 2, crateMat);
addBlock( 10, -35, 3, 1.8, 2, crateMat);
addBlock(-10,  35, 3, 1.8, 2, crateMat);
addBlock( 10,  35, 3, 1.8, 2, crateMat);

// ─── Approach Steps (near center platform) ───────────────────────────────────
addBlock( 7,  0, 2, 0.3, 2, darkConcMat);
addBlock(-7,  0, 2, 0.3, 2, darkConcMat);
addBlock( 0,  7, 2, 0.3, 2, darkConcMat);
addBlock( 0, -7, 2, 0.3, 2, darkConcMat);
