import "./style.css";

// Initialize scene and map (side effects: adds objects to scene)
import { scene, renderer } from "./scene/setup";
import "./scene/map";

// Initialize UI (side effects: appends DOM elements)
import "./ui/hud";
import "./ui/overlays";
import "./ui/chat";
import "./ui/settings";

// Initialize player systems
import { camera } from "./scene/setup";
import { controls, lockAndStart } from "./systems/input";
import { socket } from "./network/socket";
import {
  setupSocketEvents,
  setPlayerName,
  getPlayerName,
  getMyId,
} from "./network/events";
import { allStats } from "./ui/scoreboard";
import { animate } from "./game-loop";

// Mount renderer
document.getElementById("app")!.appendChild(renderer.domElement);

// First-person weapon + arms — dynamically swap on weapon switch
import {
  makeWeapon,
  makeAwpModel,
  makeFirstPersonArms,
} from "./player/PlayerModel";
import { getCurrentWeapon } from "./systems/shooting";
import { setFpWeapon, setFpArms } from "./systems/headBob";

let fpWeapon = makeWeapon(true);
let fpArms = makeFirstPersonArms("rifle");
camera.add(fpWeapon);
camera.add(fpArms);
setFpWeapon(fpWeapon);
setFpArms(fpArms);
scene.add(controls.object);

// Listen for weapon switch events to swap the FP model and arms
window.addEventListener("weapon-switched", () => {
  camera.remove(fpWeapon);
  camera.remove(fpArms);
  const w = getCurrentWeapon();
  const isAwp = w.id === "awp";
  fpWeapon = isAwp ? makeAwpModel(true) : makeWeapon(true);
  fpArms = makeFirstPersonArms(isAwp ? "awp" : "rifle");
  camera.add(fpWeapon);
  camera.add(fpArms);
  setFpWeapon(fpWeapon);
  setFpArms(fpArms);
  // Broadcast weapon change to other players
  socket.emit("weapon_switch", { weaponId: w.id });
});

// Refresh FP weapon once a GLB model finishes loading
window.addEventListener("weapon-model-loaded", () => {
  const w = getCurrentWeapon();
  camera.remove(fpWeapon);
  fpWeapon = w.id === "awp" ? makeAwpModel(true) : makeWeapon(true);
  camera.add(fpWeapon);
  setFpWeapon(fpWeapon);
});

// Hide/show FP weapon (and arms) when scoping with AWP
window.addEventListener("scope-changed", ((e: CustomEvent) => {
  fpWeapon.visible = !e.detail.scoped;
  fpArms.visible = !e.detail.scoped;
}) as EventListener);

// ── SKIP_START_SCREEN: set to false to re-enable the name input screen ──
const SKIP_START_SCREEN = false;

// Start screen
const nameInput = document.getElementById("name-input") as HTMLInputElement;
const playBtn = document.getElementById("play-btn") as HTMLButtonElement;

function startGame() {
  const name = nameInput.value.trim().slice(0, 16) || "Anonimo";
  setPlayerName(name);
  const myId = getMyId();
  if (myId) {
    socket.emit("set_name", { name });
    if (allStats[myId]) allStats[myId].name = name;
  }
  lockAndStart();
}

if (SKIP_START_SCREEN) {
  // Auto-start: hide screen and enter game immediately
  setPlayerName("Anonimo");
  lockAndStart();
} else {
  playBtn.addEventListener("click", startGame);
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") startGame();
  });
}

controls.addEventListener("lock", () => {
  const myId = getMyId();
  const playerName = getPlayerName();
  if (myId && playerName) {
    socket.emit("set_name", { name: playerName });
    if (allStats[myId]) allStats[myId].name = playerName;
  }
});

// Socket events
setupSocketEvents();

// Start game loop
animate();
