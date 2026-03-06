import * as THREE from "three";
import { socket } from "./socket";
import type { PlayerState } from "../types";
import { PLAYER_HEIGHT } from "../config";
import { camera } from "../scene/setup";
import {
  otherPlayers, addOtherPlayer, removeOtherPlayer, flashPlayerHit,
} from "../player/PlayerModel";
import { syncNameSprite } from "../player/NameSprite";
import { controls, setIsDead } from "../systems/input";
import { velocity } from "../systems/physics";
import { createVisualBullet } from "../systems/shooting";
import { explodeGrenade, spawnRemoteGrenade } from "../systems/grenade";
import { updateHudHp, hudKillsVal } from "../ui/hud";
import { allStats, setMyIdRef } from "../ui/scoreboard";
import { flashDamage, showKillFeedEntry } from "../ui/overlays";
import { addMessage } from "../ui/chat";

let myId = "";
let playerName = "";

export function getMyId() { return myId; }
export function getPlayerName() { return playerName; }
export function setPlayerName(name: string) { playerName = name; }

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
          color: me.color,
        };
      }
      for (const id in data.players) {
        if (id !== myId) {
          const p = data.players[id];
          addOtherPlayer(p);
          allStats[id] = { name: p.name, kills: 0, deaths: 0, color: p.color };
        }
      }
    },
  );

  socket.on("player_joined", (p: PlayerState) => {
    if (p.id === myId) return;
    addOtherPlayer(p);
    allStats[p.id] = { name: p.name, kills: 0, deaths: 0, color: p.color };
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
      mesh.visible = !p.isDead;
      if (!p.isDead) {
        mesh.position.lerp(
          new THREE.Vector3(p.position.x, p.position.y, p.position.z),
          0.3,
        );
        mesh.rotation.y = p.rotation.y;
        const hg = mesh.getObjectByName("headGroup");
        if (hg) hg.rotation.x = p.rotation.x;
        syncNameSprite(mesh, id, p.name, p.color);
      }
      if (allStats[id]) allStats[id].name = p.name;
    }
  });

  socket.on("player_hit", (data: { id: string; hp: number }) => {
    if (data.id === myId) {
      updateHudHp(data.hp);
      flashDamage();
    } else flashPlayerHit(data.id);
  });

  socket.on("player_killed", (data: { victim: string; killer: string }) => {
    if (allStats[data.killer]) allStats[data.killer].kills++;
    if (allStats[data.victim]) allStats[data.victim].deaths++;

    const killerName = allStats[data.killer]?.name ?? "Desconhecido";
    const victimName = allStats[data.victim]?.name ?? "Desconhecido";

    showKillFeedEntry(killerName, victimName, data.killer === myId);

    if (data.victim === myId) {
      setIsDead(true);
      updateHudHp(0);
      controls.unlock();
      deathScreen.style.display = "flex";
    } else {
      if (otherPlayers[data.victim]) otherPlayers[data.victim].visible = false;
      if (data.killer === myId) {
        const kills = allStats[myId]?.kills ?? 0;
        hudKillsVal.textContent = String(kills);
      }
    }
  });

  socket.on("player_respawned", (p: PlayerState) => {
    if (p.id === myId) {
      setIsDead(false);
      camera.position.set(p.position.x, PLAYER_HEIGHT, p.position.z);
      velocity.set(0, 0, 0);
      updateHudHp(100);
      deathScreen.style.display = "none";
      controls.lock();
    } else if (otherPlayers[p.id]) {
      otherPlayers[p.id].position.set(p.position.x, p.position.y, p.position.z);
      otherPlayers[p.id].visible = true;
    }
  });

  socket.on(
    "shoot_bullet",
    (data: {
      origin: { x: number; y: number; z: number };
      direction: { x: number; y: number; z: number };
    }) => {
      createVisualBullet(
        new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z),
        new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z),
      );
    },
  );

  socket.on("server_full", (data: { message: string }) => {
    alert(data.message);
  });

  socket.on("grenade_launched", (data: {
    origin: { x: number; y: number; z: number };
    velocity: { x: number; y: number; z: number };
  }) => {
    spawnRemoteGrenade(
      new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z),
      new THREE.Vector3(data.velocity.x, data.velocity.y, data.velocity.z),
    );
  });

  socket.on("grenade_explode", (data: { position: { x: number; y: number; z: number } }) => {
    explodeGrenade(new THREE.Vector3(data.position.x, data.position.y, data.position.z));
  });

  socket.on("chat_message", (data: { name: string; message: string; id: string }) => {
    addMessage(data.name, data.message, false);
  });
}
