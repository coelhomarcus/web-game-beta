import "./style.css";

// Initialize scene and map (side effects: adds objects to scene)
import { scene, renderer } from "./scene/setup";
import "./scene/map";
import { initAbilityItems } from "./systems/abilities";

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
  getMyColor,
  setMyColor,
} from "./network/events";
import { allStats } from "./ui/scoreboard";
import { animate } from "./game-loop";
import { sanitizePlayerName, DEFAULT_PLAYER_NAME } from "./utils/playerName";
import {
  storeFaceDataUrl,
  getFaceDataUrl,
  extractDominantColor,
  disposeFaceTexture,
} from "./utils/faceTexture";
import { openFaceCropModal } from "./ui/faceCrop";
import {
  initCharacterPreview,
  destroyCharacterPreview,
  updatePreviewFaceTexture,
  updatePreviewBodyColor,
  clearPreviewFaceTexture,
  saveFaceToStorage,
  loadFaceFromStorage,
  clearFaceFromStorage,
} from "./ui/characterPreview";

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
  fpArms = makeFirstPersonArms(
    isAwp ? "awp" : "rifle",
    localStorage.getItem("fps_arena_color") || getMyColor() || undefined,
  );
  camera.add(fpWeapon);
  camera.add(fpArms);
  setFpWeapon(fpWeapon);
  setFpArms(fpArms);
  // Broadcast weapon change to other players
  socket.emit("weapon_switch", { weaponId: w.id });
});

// Recreate FP arms with the server-assigned player color once we get it
window.addEventListener("local-player-inited", ((e: CustomEvent) => {
  camera.remove(fpArms);
  const w = getCurrentWeapon();
  // Prefer any colour already derived from the face image
  const savedColor = localStorage.getItem("fps_arena_color") || e.detail.color;
  fpArms = makeFirstPersonArms(w.id === "awp" ? "awp" : "rifle", savedColor);
  camera.add(fpArms);
  setFpArms(fpArms);
}) as EventListener);

// Rebuild FP arms when dominant colour is extracted from a newly-uploaded face
window.addEventListener("my-color-changed", ((e: CustomEvent) => {
  camera.remove(fpArms);
  const w = getCurrentWeapon();
  fpArms = makeFirstPersonArms(
    w.id === "awp" ? "awp" : "rifle",
    e.detail.color,
  );
  camera.add(fpArms);
  setFpArms(fpArms);
}) as EventListener);

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
const faceUploadBtn = document.getElementById(
  "face-upload-btn",
) as HTMLButtonElement;
const faceFileInput = document.getElementById(
  "face-file-input",
) as HTMLInputElement;
const faceRemoveBtn = document.getElementById(
  "face-remove-btn",
) as HTMLButtonElement;
const facePreviewThumb = document.getElementById(
  "face-preview-thumb",
) as HTMLImageElement;
const previewFloat = document.getElementById(
  "character-preview-float",
) as HTMLDivElement;
const colorPickerInput = document.getElementById(
  "player-color-picker",
) as HTMLInputElement;
const colorPickerLabel = document.getElementById(
  "player-color-label",
) as HTMLSpanElement;

function applyPlayerColorLocally(hex: string) {
  localStorage.setItem("fps_arena_color", hex);
  setMyColor(hex);
  updatePreviewBodyColor(hex);
  if (colorPickerInput) colorPickerInput.value = hex;
  if (colorPickerLabel) colorPickerLabel.textContent = hex;
}

// Boot character preview (floating right panel)
if (!SKIP_START_SCREEN && previewFloat) {
  previewFloat.style.display = "block";
  initCharacterPreview(previewFloat);
}

// Initialise color picker with saved color (or default)
const _initColor = localStorage.getItem("fps_arena_color") ?? "#4a90e2";
if (colorPickerInput) colorPickerInput.value = _initColor;
if (colorPickerLabel) colorPickerLabel.textContent = _initColor;

// Color picker → live preview + store
colorPickerInput?.addEventListener("input", () => {
  applyPlayerColorLocally(colorPickerInput.value);
});

// Restore saved face from localStorage
const savedFace = loadFaceFromStorage();
if (savedFace) {
  const tex = storeFaceDataUrl("__local__", savedFace);
  facePreviewThumb.src = savedFace;
  facePreviewThumb.style.display = "block";
  faceRemoveBtn.style.display = "flex";
  faceUploadBtn.textContent = "📷 Alterar foto";
  updatePreviewFaceTexture(tex);
}
// Restore saved body colour into the preview
const _savedBodyColor = localStorage.getItem("fps_arena_color");
if (_savedBodyColor) updatePreviewBodyColor(_savedBodyColor);

// Face upload button → open hidden file input
faceUploadBtn?.addEventListener("click", () => faceFileInput?.click());

// File selected → open crop modal
faceFileInput?.addEventListener("change", async () => {
  const file = faceFileInput.files?.[0];
  faceFileInput.value = ""; // reset so same file can be re-selected
  if (!file) return;

  const dataUrl = await openFaceCropModal(file);
  if (!dataUrl) return; // user cancelled

  const tex = storeFaceDataUrl("__local__", dataUrl);
  saveFaceToStorage(dataUrl);

  // Extract dominant colour from the cropped face and store it
  const dominantColor = await extractDominantColor(dataUrl);
  applyPlayerColorLocally(dominantColor);

  // Update thumbnail in the form
  facePreviewThumb.src = dataUrl;
  facePreviewThumb.style.display = "block";
  faceRemoveBtn.style.display = "flex";
  faceUploadBtn.textContent = "📷 Alterar foto";

  // Update character preview
  updatePreviewFaceTexture(tex);
});

// Remove face button
faceRemoveBtn?.addEventListener("click", () => {
  facePreviewThumb.style.display = "none";
  faceRemoveBtn.style.display = "none";
  faceUploadBtn.textContent = "📷 Adicionar foto";
  clearPreviewFaceTexture();
  clearFaceFromStorage();
  // Reset colour to default
  const DEFAULT_COLOR = "#4a90e2";
  localStorage.removeItem("fps_arena_color");
  if (colorPickerInput) colorPickerInput.value = DEFAULT_COLOR;
  if (colorPickerLabel) colorPickerLabel.textContent = DEFAULT_COLOR;
  updatePreviewBodyColor(DEFAULT_COLOR);
  disposeFaceTexture("__local__");
});

function startGame() {
  const name = sanitizePlayerName(nameInput.value);
  setPlayerName(name);
  const myId = getMyId();
  if (myId) {
    socket.emit("set_name", { name });
    if (allStats[myId]) allStats[myId].name = name;
  }
  // Send face photo to server so all other players can see it
  const faceDataUrl = getFaceDataUrl("__local__");
  if (faceDataUrl) socket.emit("set_face", { face: faceDataUrl });
  // Send dominant colour derived from face photo
  const savedColor = localStorage.getItem("fps_arena_color");
  if (savedColor) socket.emit("set_color", { color: savedColor });
  // Tear down preview
  if (previewFloat) previewFloat.style.display = "none";
  destroyCharacterPreview();
  lockAndStart();
}

if (SKIP_START_SCREEN) {
  // Auto-start: hide screen and enter game immediately
  setPlayerName(DEFAULT_PLAYER_NAME);
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

// Spawn ability items on map
initAbilityItems();

// Start game loop
animate();
