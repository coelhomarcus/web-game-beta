import * as THREE from "three";
import { scene } from "./setup";

const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({
    color: 0x90ee90,
    roughness: 0.8,
    metalness: 0.2,
  }),
);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
scene.add(plane);

export const mapBlocks: THREE.Mesh[] = [];

const rng = (() => {
  let s = 42;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 2 ** 32;
  };
})();

for (let i = 0; i < 20; i++) {
  const h = rng() * 4 + 1;
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(2, h, 2),
    new THREE.MeshStandardMaterial({ color: 0x888888 }),
  );
  box.position.set((rng() - 0.5) * 40, h / 2, (rng() - 0.5) * 40);
  box.castShadow = box.receiveShadow = true;
  scene.add(box);
  mapBlocks.push(box);
}
