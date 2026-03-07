import * as THREE from "three";
import { PLAYER_HEIGHT } from "../config";


export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x36c5f4);
export const sceneFog = new THREE.Fog(0x36c5f4, 80, 250);
scene.fog = sceneFog;

export const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, PLAYER_HEIGHT, 0);

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

scene.add(new THREE.AmbientLight(0xffffff, 1.8));
const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.set(20, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.width = sun.shadow.mapSize.height = 1024;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 100;
sun.shadow.camera.left = -50;
sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50;
sun.shadow.camera.bottom = -50;
sun.shadow.bias = -0.002;
scene.add(sun);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
