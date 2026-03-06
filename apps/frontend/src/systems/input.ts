import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { camera } from "../scene/setup";
import {
  setMoveForward, setMoveBackward, setMoveLeft, setMoveRight,
  setWantsJump, isOnGround,
} from "./physics";
import { handleShoot, startReload, switchWeapon, toggleScope, exitScope } from "./shooting";
import { throwGrenade } from "./grenade";
import { renderScoreboard } from "../ui/scoreboard";
import { isChatOpen, openChat } from "../ui/chat";

export const controls = new PointerLockControls(camera, document.body);

let gameStarted = false;
let isDead = false;

export function getIsDead() { return isDead; }
export function setIsDead(v: boolean) { isDead = v; }
export function getGameStarted() { return gameStarted; }
export function setGameStarted(v: boolean) { gameStarted = v; }

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
  if (isChatOpen()) return; // chat input handles its own keys
  if (e.code === "Enter" && gameStarted && !isDead) {
    e.preventDefault();
    openChat();
    return;
  }
  switch (e.code) {
    case "KeyW": setMoveForward(true); break;
    case "KeyA": setMoveLeft(true); break;
    case "KeyS": setMoveBackward(true); break;
    case "KeyD": setMoveRight(true); break;
    case "Space": if (isOnGround) setWantsJump(true); break;
    case "KeyQ": throwGrenade(controls, isDead); break;
    case "KeyR": startReload(); break;
    case "Digit1": switchWeapon("ar"); break;
    case "Digit2": switchWeapon("awp"); break;
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
  if (isChatOpen()) return;
  if (e.button === 0) {
    // Left click: re-lock if unlocked, or shoot
    if (!controls.isLocked && gameStarted && !isDead) {
      controls.lock();
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
  controls.lock();
}
