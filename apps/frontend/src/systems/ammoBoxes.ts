import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { scene, camera } from "../scene/setup";
import { refillAmmo } from "./shooting";
import { playReloadSound } from "./audio";

const PICKUP_RADIUS = 2.5;
const RESPAWN_TIME = 15;
const BOB_SPEED = 2;
const BOB_HEIGHT = 0.15;
const ROTATE_SPEED = 1.5;

interface AmmoBox {
  group: THREE.Group;
  baseY: number;
  cooldown: number;
  position: THREE.Vector3;
}

const ammoBoxes: AmmoBox[] = [];
let ammoBoxTemplate: THREE.Group | null = null;

const SPAWN_POSITIONS: [number, number, number][] = [
  [-30, 0.6, 0],
  [30, 0.6, 0],
  [0, 0.6, -30],
];

const loader = new GLTFLoader();
loader.load("/models/AmmoBox/AmmoBox.glb", (gltf) => {
  ammoBoxTemplate = gltf.scene;
  ammoBoxTemplate.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  for (const [x, y, z] of SPAWN_POSITIONS) {
    const group = ammoBoxTemplate.clone();
    group.scale.set(3, 3, 3);
    group.position.set(x, y, z);
    scene.add(group);
    ammoBoxes.push({
      group,
      baseY: y,
      cooldown: 0,
      position: new THREE.Vector3(x, y, z),
    });
  }
});

export function updateAmmoBoxes(delta: number) {
  for (const box of ammoBoxes) {
    if (box.cooldown > 0) {
      box.cooldown -= delta;
      if (box.cooldown <= 0) {
        box.cooldown = 0;
        box.group.visible = true;
      }
      continue;
    }

    box.group.position.y =
      box.baseY + Math.sin(performance.now() * 0.001 * BOB_SPEED) * BOB_HEIGHT;
    box.group.rotation.y += ROTATE_SPEED * delta;

    const dx = camera.position.x - box.position.x;
    const dz = camera.position.z - box.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < PICKUP_RADIUS) {
      const picked = refillAmmo();
      if (picked) {
        playReloadSound();
        box.group.visible = false;
        box.cooldown = RESPAWN_TIME;
      }
    }
  }
}
