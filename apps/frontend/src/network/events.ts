import * as THREE from "three";
import { socket } from "./socket";
import type { PlayerState } from "../types";
import { PLAYER_HEIGHT, INVINCIBLE_TIME } from "../config";
import { camera } from "../scene/setup";
import {
  otherPlayers,
  addOtherPlayer,
  removeOtherPlayer,
  flashPlayerHit,
  startInvincibleBlink,
  triggerRagdoll,
  cleanupRagdoll,
  isRagdollActive,
  triggerShoutFling,
  isFlinging,
  showDamageNumber,
  swapOtherPlayerWeapon,
  createLocalCorpse,
  cleanupLocalCorpse,
  applyFaceTexture,
  applyPlayerColor,
} from "../player/PlayerModel";
import { storeFaceDataUrl, getFaceDataUrl } from "../utils/faceTexture";
import { syncNameSprite } from "../player/NameSprite";
import { controls, setIsDead } from "../systems/input";
import { velocity, applyKnockback } from "../systems/physics";
import { createVisualBullet } from "../systems/shooting";
import {
  explodeGrenade,
  spawnRemoteGrenade,
  cleanupRemoteGrenades,
} from "../systems/grenade";
import { spawnShoutAura } from "../systems/abilities";
import { updateHudHp } from "../ui/hud";
import { allStats, setMyIdRef } from "../ui/scoreboard";
import {
  flashDamage,
  showDamageDirection,
  showKillFeedEntry,
  startLocalInvincibleBlink,
} from "../ui/overlays";
import { addMessage } from "../ui/chat";
import { triggerScreenShake } from "../systems/headBob";

let myId = "";
let myColor = "";
let playerName = "";

const _tmpNetPos = new THREE.Vector3();
const _tmpNetDir = new THREE.Vector3();
const _tmpNetForce = new THREE.Vector3();
const _tmpShoutOrigin = new THREE.Vector3();

export function getMyId() {
  return myId;
}
export function getMyColor() {
  return myColor;
}
export function setMyColor(hex: string) {
  myColor = hex;
  window.dispatchEvent(
    new CustomEvent("my-color-changed", { detail: { color: hex } }),
  );
}
export function getPlayerName() {
  return playerName;
}
export function setPlayerName(name: string) {
  playerName = name;
}

const deathScreen = document.getElementById("death-screen")!;

export function setupSocketEvents() {
  socket.on(
    "init",
    (data: { id: string; players: Record<string, PlayerState> }) => {
      myId = data.id;
      setMyIdRef(myId);
      if (playerName) {
        socket.emit("set_name", { name: playerName });
      }
      const me = data.players[myId];
      if (me) {
        camera.position.set(me.position.x, PLAYER_HEIGHT, me.position.z);
        updateHudHp(me.hp);
        allStats[myId] = {
          name: playerName || me.name,
          kills: 0,
          deaths: 0,
          assists: 0,
          color: me.color,
        };
        myColor = me.color;
        window.dispatchEvent(
          new CustomEvent("local-player-inited", {
            detail: { color: me.color },
          }),
        );
      }
      for (const id in data.players) {
        if (id !== myId) {
          const p = data.players[id];
          addOtherPlayer(p);
          // Apply face texture from init data if present
          if (p.face) {
            const tex = storeFaceDataUrl(id, p.face);
            applyFaceTexture(id, tex);
          }
          allStats[id] = {
            name: p.name,
            kills: 0,
            deaths: 0,
            assists: 0,
            color: p.color,
          };
        }
      }
      // Send our own face and colour if we have saved ones (reconnect guard)
      const myFace = getFaceDataUrl("__local__");
      if (myFace) socket.emit("set_face", { face: myFace });
      const savedColor = localStorage.getItem("fps_arena_color");
      if (savedColor) socket.emit("set_color", { color: savedColor });
    },
  );

  socket.on("player_joined", (p: PlayerState) => {
    if (p.id === myId) return;
    addOtherPlayer(p);
    if (p.face) {
      const tex = storeFaceDataUrl(p.id, p.face);
      applyFaceTexture(p.id, tex);
    }
    allStats[p.id] = {
      name: p.name,
      kills: 0,
      deaths: 0,
      assists: 0,
      color: p.color,
    };
  });

  socket.on("player_left", (id: string) => {
    removeOtherPlayer(id);
    delete allStats[id];
  });

  socket.on("game_state", (players: Record<string, PlayerState>) => {
    for (const id in players) {
      if (id === myId) continue;
      const mesh = otherPlayers[id];
      if (!mesh) continue;
      const p = players[id];
      // Don't touch visibility or transforms while ragdoll or fling is active
      if (isRagdollActive(id) || isFlinging(id)) {
        if (allStats[id]) allStats[id].name = p.name;
        continue;
      }
      mesh.visible = !p.isDead;
      if (!p.isDead) {
        _tmpNetPos.set(p.position.x, p.position.y, p.position.z);
        mesh.position.lerp(_tmpNetPos, 0.3);
        mesh.rotation.y = p.rotation.y;
        const hg = mesh.getObjectByName("headGroup");
        if (hg)
          hg.rotation.x = THREE.MathUtils.clamp(
            p.rotation.x,
            -Math.PI / 3,
            Math.PI / 3,
          );
        syncNameSprite(mesh, id, p.name, p.color);
      }
      if (allStats[id]) allStats[id].name = p.name;
    }
  });

  socket.on(
    "player_hit",
    (data: {
      id: string;
      hp: number;
      damage?: number;
      from?: { x: number; y: number; z: number };
    }) => {
      if (data.id === myId) {
        updateHudHp(data.hp);
        flashDamage();
        triggerScreenShake(0.06);

        // Direction indicator
        if (data.from) {
          const dx = data.from.x - camera.position.x;
          const dz = data.from.z - camera.position.z;
          // Camera forward and right in world XZ
          const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(
            camera.quaternion,
          );
          const dotFwd = dx * fwd.x + dz * fwd.z; // positive = attacker in front
          const dotRight = dx * fwd.z - dz * fwd.x; // positive = attacker to right
          // atan2(right, fwd): 0 = front (top), 90 = right, 180 = back (bottom)
          const deg = THREE.MathUtils.radToDeg(Math.atan2(dotRight, dotFwd));
          showDamageDirection(deg);
        }
      } else {
        flashPlayerHit(data.id);
        showDamageNumber(data.id, data.damage ?? 25);
      }
    },
  );

  socket.on(
    "player_killed",
    (data: {
      victim: string;
      killer: string;
      assist?: string;
      weapon?: string;
      cause?: string;
      explosionPos?: { x: number; y: number; z: number };
    }) => {
      if (allStats[data.killer]) allStats[data.killer].kills++;
      if (allStats[data.victim]) allStats[data.victim].deaths++;
      if (data.assist && allStats[data.assist]) allStats[data.assist].assists++;

      const killerName = allStats[data.killer]?.name ?? "Desconhecido";
      const victimName = allStats[data.victim]?.name ?? "Desconhecido";
      const assistName = data.assist
        ? (allStats[data.assist]?.name ?? undefined)
        : undefined;

      showKillFeedEntry(
        killerName,
        victimName,
        data.killer === myId,
        data.weapon ?? "ar",
        assistName,
      );

      if (data.victim === myId) {
        setIsDead(true);
        updateHudHp(0);
        controls.unlock();

        // Show killer info on death screen
        const killerRow = document.getElementById("death-killer-row");
        const killerNameEl = document.getElementById("death-killer-name");
        const killerFaceEl = document.getElementById(
          "death-killer-face",
        ) as HTMLImageElement | null;
        if (killerRow && killerNameEl) {
          killerNameEl.textContent = killerName;
          killerRow.style.display = "flex";
          if (killerFaceEl) {
            const killerFaceUrl = getFaceDataUrl(data.killer);
            if (killerFaceUrl) {
              killerFaceEl.src = killerFaceUrl;
              killerFaceEl.style.display = "block";
            } else {
              killerFaceEl.style.display = "none";
            }
          }
        }

        deathScreen.style.display = "flex";
        const cause = (data.cause as "bullet" | "grenade") ?? "bullet";
        createLocalCorpse(
          myColor || 0xc68642,
          { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          cause,
          data.explosionPos,
        );
      } else {
        const cause = (data.cause as "bullet" | "grenade") ?? "bullet";
        triggerRagdoll(data.victim, cause, data.explosionPos);
      }
    },
  );

  socket.on("player_respawned", (p: PlayerState) => {
    if (p.id === myId) {
      cleanupLocalCorpse();
      setIsDead(false);
      camera.position.set(p.position.x, PLAYER_HEIGHT, p.position.z);
      velocity.set(0, 0, 0);
      updateHudHp(100);
      deathScreen.style.display = "none";
      // Hide killer row for next death
      const killerRow = document.getElementById("death-killer-row");
      if (killerRow) killerRow.style.display = "none";
      controls.lock();
      startLocalInvincibleBlink(INVINCIBLE_TIME);
    } else if (otherPlayers[p.id]) {
      cleanupRagdoll(p.id);
      otherPlayers[p.id].position.set(p.position.x, p.position.y, p.position.z);
      otherPlayers[p.id].visible = true;
      startInvincibleBlink(p.id, INVINCIBLE_TIME);
    }
  });

  socket.on(
    "shoot_bullet",
    (data: {
      origin: { x: number; y: number; z: number };
      direction: { x: number; y: number; z: number };
    }) => {
      _tmpNetPos.set(data.origin.x, data.origin.y, data.origin.z);
      _tmpNetDir.set(data.direction.x, data.direction.y, data.direction.z);
      createVisualBullet(_tmpNetPos, _tmpNetDir);
    },
  );

  socket.on("server_full", (data: { message: string }) => {
    alert(data.message);
  });

  socket.on(
    "grenade_launched",
    (data: {
      origin: { x: number; y: number; z: number };
      velocity: { x: number; y: number; z: number };
    }) => {
      _tmpNetPos.set(data.origin.x, data.origin.y, data.origin.z);
      _tmpNetDir.set(data.velocity.x, data.velocity.y, data.velocity.z);
      spawnRemoteGrenade(_tmpNetPos, _tmpNetDir);
    },
  );

  socket.on(
    "grenade_explode",
    (data: { position: { x: number; y: number; z: number } }) => {
      cleanupRemoteGrenades();
      _tmpNetPos.set(data.position.x, data.position.y, data.position.z);
      explodeGrenade(_tmpNetPos);
    },
  );

  socket.on(
    "shout_blast",
    (data: {
      victimId: string;
      origin: { x: number; y: number; z: number };
    }) => {
      // Determine victim world position: local player → camera, remote → mesh
      _tmpShoutOrigin.set(data.origin.x, data.origin.y, data.origin.z);
      let targetPos: THREE.Vector3 | undefined;
      if (data.victimId === myId) {
        targetPos = camera.position.clone();
      } else {
        const mesh = otherPlayers[data.victimId];
        if (mesh) targetPos = mesh.position.clone();
      }
      if (targetPos) spawnShoutAura(_tmpShoutOrigin, targetPos);

      if (data.victimId !== myId) {
        triggerShoutFling(data.victimId, data.origin);
      }
    },
  );

  socket.on(
    "shout_knockback",
    (data: { force: { x: number; y: number; z: number } }) => {
      _tmpNetForce.set(data.force.x, data.force.y, data.force.z);
      applyKnockback(_tmpNetForce);
    },
  );

  socket.on("weapon_switch", (data: { id: string; weaponId: string }) => {
    if (data.id !== myId) {
      swapOtherPlayerWeapon(data.id, data.weaponId as "ar" | "awp");
    }
  });

  socket.on(
    "chat_message",
    (data: { name: string; message: string; id: string }) => {
      addMessage(data.name, data.message, false);
    },
  );

  socket.on("player_face_set", (data: { id: string; face: string }) => {
    if (!data.id || !data.face) return;
    const tex = storeFaceDataUrl(data.id, data.face);
    applyFaceTexture(data.id, tex);
  });

  socket.on("player_color_set", (data: { id: string; color: string }) => {
    if (!data.id || !data.color) return;
    applyPlayerColor(data.id, data.color);
    if (allStats[data.id]) allStats[data.id].color = data.color;
  });
}
