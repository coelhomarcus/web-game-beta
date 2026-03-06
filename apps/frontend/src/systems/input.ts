import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { camera } from "../scene/setup";
import {
  setMoveForward, setMoveBackward, setMoveLeft, setMoveRight,
  setWantsJump, isOnGround,
} from "./physics";
import { handleShoot } from "./shooting";
import { throwGrenade } from "./grenade";
import { renderScoreboard } from "../ui/scoreboard";

export const controls = new PointerLockControls(camera, document.body);

let gameStarted = false;
let isDead = false;

export function getIsDead() { return isDead; }
export function setIsDead(v: boolean) { isDead = v; }
export function getGameStarted() { return gameStarted; }
export function setGameStarted(v: boolean) { gameStarted = v; }

const startScreen = document.getElementById("start-screen")!;
const resumeOverlay = document.getElementById("resume-overlay") as HTMLElement;
const scoreboard = document.getElementById("scoreboard")!;

controls.addEventListener("lock", () => {
  resumeOverlay.style.display = "none";
});
controls.addEventListener("unlock", () => {
  if (isDead || !gameStarted) return;
  resumeOverlay.style.display = "flex";
});

const SUPPRESS_KEYS = new Set([
  "AltLeft", "AltRight", "MetaLeft", "MetaRight", "ContextMenu",
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
]);

window.addEventListener("keydown", (e) => {
  if (SUPPRESS_KEYS.has(e.code)) {
    e.preventDefault();
    return;
  }
  switch (e.code) {
    case "KeyW": setMoveForward(true); break;
    case "KeyA": setMoveLeft(true); break;
    case "KeyS": setMoveBackward(true); break;
    case "KeyD": setMoveRight(true); break;
    case "Space": if (isOnGround) setWantsJump(true); break;
    case "KeyQ": throwGrenade(controls, isDead); break;
    case "Tab":
      e.preventDefault();
      renderScoreboard();
      scoreboard.classList.add("visible");
      break;
  }
});

window.addEventListener("keyup", (e) => {
  switch (e.code) {
    case "KeyW": setMoveForward(false); break;
    case "KeyA": setMoveLeft(false); break;
    case "KeyS": setMoveBackward(false); break;
    case "KeyD": setMoveRight(false); break;
    case "Tab":
      e.preventDefault();
      scoreboard.classList.remove("visible");
      break;
  }
});

window.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  handleShoot(isDead, controls);
});

resumeOverlay.addEventListener("mousedown", (e) => {
  e.stopPropagation();
  controls.lock();
});

export function lockAndStart() {
  gameStarted = true;
  startScreen.style.display = "none";
  controls.lock();
}
