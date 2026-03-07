import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import * as THREE from "three";
import { camera } from "../scene/setup";
import {
  setMoveForward,
  setMoveBackward,
  setMoveLeft,
  setMoveRight,
  setWantsJump,
  canJump,
} from "./physics";
import {
  handleShoot,
  startReload,
  switchWeapon,
  toggleScope,
  exitScope,
} from "./shooting";
import { throwGrenade } from "./grenade";
import { activateAbility } from "./abilities";
import { renderScoreboard } from "../ui/scoreboard";
import { isChatOpen, openChat } from "../ui/chat";
import {
  showSettings,
  isSettingsOpen,
  getNormalSensitivity,
} from "../ui/settings";

export const controls = new PointerLockControls(camera, document.body);

// ── Custom mouse look (replaces PointerLockControls' internal handler) ────────
// Track yaw/pitch as plain numbers to avoid the unstable quaternion↔Euler
// round-trip that causes random yaw flips near ±90° pitch ("flick" bug).
// Also clamp per-frame deltas to reject browser spikes (tab-switch, first lock).
const _lookEuler = new THREE.Euler(0, 0, 0, "YXZ");
let _yaw = 0;
let _pitch = 0;
const MOUSE_SENS = 0.002;
const MAX_PITCH = Math.PI / 2 - 0.05; // ~87° — safe distance from singularity
const MAX_DELTA = 0.35; // reject single-frame movements larger than ~20° (spike)

// Remove the built-in mousemove handler so it doesn't fight with ours
controls.disconnect();
// Re-add only the pointer lock state listeners (lock/unlock events)
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === document.body) {
    (controls as any).isLocked = true;
    controls.dispatchEvent({ type: "lock" } as any);
  } else {
    (controls as any).isLocked = true; // temporarily to not break unlocking
    (controls as any).isLocked = false;
    controls.dispatchEvent({ type: "unlock" } as any);
  }
});

document.addEventListener("mousemove", (e) => {
  if (!controls.isLocked) return;

  let dx = e.movementX * MOUSE_SENS * controls.pointerSpeed;
  let dy = e.movementY * MOUSE_SENS * controls.pointerSpeed;

  // Clamp deltas to reject large spikes
  dx = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, dx));
  dy = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, dy));

  _yaw -= dx;
  _pitch -= dy;
  _pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, _pitch));

  _lookEuler.set(_pitch, _yaw, 0);
  camera.quaternion.setFromEuler(_lookEuler);
});

let gameStarted = false;
let isDead = false;

export function getIsDead() {
  return isDead;
}
export function setIsDead(v: boolean) {
  isDead = v;
}
export function getGameStarted() {
  return gameStarted;
}
export function setGameStarted(v: boolean) {
  gameStarted = v;
}

const startScreen = document.getElementById("start-screen")!;
const scoreboard = document.getElementById("scoreboard")!;

controls.addEventListener("unlock", () => {
  // Clear movement so player doesn't keep walking (upstream)
  setMoveForward(false);
  setMoveBackward(false);
  setMoveLeft(false);
  setMoveRight(false);
  // Exit scope when ESC is pressed (AWP)
  exitScope();
  // Show settings menu when pointer is unlocked during gameplay
  if (gameStarted && !isDead && !isChatOpen()) {
    showSettings(() => {
      controls.pointerSpeed = getNormalSensitivity();
      try {
        controls.lock();
      } catch {
        /* browser may reject lock */
      }
    });
  }
});

const SUPPRESS_KEYS = new Set([
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
  "ContextMenu",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "F11",
  "F12",
]);

window.addEventListener("keydown", (e) => {
  if (SUPPRESS_KEYS.has(e.code)) {
    e.preventDefault();
    return;
  }
  if (isChatOpen()) return; // chat input handles its own keys
  if (e.code === "Enter" && gameStarted && !isDead) {
    e.preventDefault();
    openChat();
    return;
  }
  switch (e.code) {
    case "KeyW":
      setMoveForward(true);
      break;
    case "KeyA":
      setMoveLeft(true);
      break;
    case "KeyS":
      setMoveBackward(true);
      break;
    case "KeyD":
      setMoveRight(true);
      break;
    case "Space":
      if (canJump()) setWantsJump(true);
      break;
    case "KeyQ":
      throwGrenade(controls, isDead);
      break;
    case "KeyZ":
      if (!isDead) activateAbility();
      break;
    case "KeyR":
      startReload();
      break;
    case "Digit1":
      switchWeapon("ar");
      break;
    case "Digit2":
      switchWeapon("awp");
      break;
    case "Tab":
      e.preventDefault();
      renderScoreboard();
      scoreboard.classList.add("visible");
      break;
  }
});

window.addEventListener("keyup", (e) => {
  if (isChatOpen()) return;
  switch (e.code) {
    case "KeyW":
      setMoveForward(false);
      break;
    case "KeyA":
      setMoveLeft(false);
      break;
    case "KeyS":
      setMoveBackward(false);
      break;
    case "KeyD":
      setMoveRight(false);
      break;
    case "Tab":
      e.preventDefault();
      scoreboard.classList.remove("visible");
      break;
  }
});

window.addEventListener("mousedown", (e) => {
  if (isChatOpen()) return;
  if (e.button === 0) {
    // Left click: re-lock if unlocked, or shoot
    if (!controls.isLocked && gameStarted && !isDead) {
      if (isSettingsOpen()) {
        return; // let the settings menu handle clicks
      }
      try {
        controls.lock();
      } catch {
        /* browser may reject lock */
      }
      return;
    }
    handleShoot(isDead, controls);
  } else if (e.button === 2) {
    // Right-click: toggle scope (AWP)
    if (controls.isLocked && !isDead) toggleScope();
  }
});

// Prevent context menu on right-click
window.addEventListener("contextmenu", (e) => e.preventDefault());

export function lockAndStart() {
  gameStarted = true;
  startScreen.style.display = "none";
  const hud = document.getElementById("hud");
  if (hud) hud.style.display = "flex";
  const minimap = document.getElementById("minimap");
  if (minimap) minimap.style.display = "block";
  controls.pointerSpeed = getNormalSensitivity();
  try {
    controls.lock();
  } catch {
    /* browser may reject lock */
  }
}
