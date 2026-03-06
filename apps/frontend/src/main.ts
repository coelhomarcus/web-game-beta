import "./style.css";

// Initialize scene and map (side effects: adds objects to scene)
import { scene, renderer } from "./scene/setup";
import "./scene/map";

// Initialize UI (side effects: appends DOM elements)
import "./ui/hud";
import "./ui/overlays";
import "./ui/chat";

// Initialize player systems
import { makeWeapon } from "./player/PlayerModel";
import { camera } from "./scene/setup";
import { controls, lockAndStart } from "./systems/input";
import { socket } from "./network/socket";
import { setupSocketEvents, setPlayerName, getPlayerName, getMyId } from "./network/events";
import { allStats } from "./ui/scoreboard";
import { animate } from "./game-loop";

// Mount renderer
document.getElementById("app")!.appendChild(renderer.domElement);

// First-person weapon
camera.add(makeWeapon(true));
scene.add(controls.object);

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

playBtn.addEventListener("click", startGame);
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") startGame();
});

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
