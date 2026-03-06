import * as THREE from "three";
import { playerCurrentNames } from "./PlayerModel";

export function createNameSprite(name: string): THREE.Sprite {
  const w = 512,
    h = 96;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  ctx.font = 'bold 52px "Nunito", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "rgba(0,0,0,0.9)";
  ctx.lineWidth = 10;
  ctx.lineJoin = "round";
  ctx.strokeText(name.slice(0, 16), w / 2, h / 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(name.slice(0, 16), w / 2, h / 2);
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    depthTest: true,
    transparent: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.6, 0.49, 1);
  sprite.name = "nameSprite";
  return sprite;
}

export function syncNameSprite(
  group: THREE.Group,
  id: string,
  name: string,
  _color: string,
) {
  if (playerCurrentNames[id] === name) return;
  const old = group.getObjectByName("nameSprite") as THREE.Sprite | undefined;
  if (old) {
    (old.material as THREE.SpriteMaterial).map?.dispose();
    group.remove(old);
  }
  const sprite = createNameSprite(name);
  sprite.position.set(0, 1.7, 0);
  group.add(sprite);
  playerCurrentNames[id] = name;
}
