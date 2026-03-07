import { Server, Socket } from "socket.io";
import { PlayerState, Vec3 } from "./types";
import { MAP_BOXES } from "./map";
import { resolveBoxCollision, getRandomSpawn } from "./physics";
import {
  MAX_PLAYERS,
  BLAST_RADIUS,
  MAX_DAMAGE,
  MIN_DAMAGE,
  BULLET_DAMAGE,
  RESPAWN_TIME,
  INVINCIBLE_TIME,
} from "./config";

const players: Record<string, PlayerState> = {};

// damageLog[victimId][attackerId] = total damage dealt
const damageLog: Record<string, Record<string, number>> = {};

// last weapon used per attacker
const lastWeapon: Record<string, string> = {};

// invincibility timers, so they can be cancelled on shoot
const invincibleTimers: Record<string, ReturnType<typeof setTimeout>> = {};

export function getPlayers(): Record<string, PlayerState> {
  return players;
}

function scheduleRespawn(io: Server, id: string) {
  setTimeout(() => {
    if (players[id]) {
      players[id].hp = 100;
      players[id].isDead = false;
      players[id].isInvincible = true;
      players[id].position = getRandomSpawn();
      io.emit("player_respawned", players[id]);
      invincibleTimers[id] = setTimeout(() => {
        if (players[id]) {
          players[id].isInvincible = false;
          delete invincibleTimers[id];
        }
      }, INVINCIBLE_TIME);
    }
  }, RESPAWN_TIME);
}

function killPlayer(
  io: Server,
  victimId: string,
  killerId: string,
  cause: "bullet" | "grenade" = "bullet",
  explosionPos?: Vec3,
) {
  const target = players[victimId];
  target.hp = 0;
  const weapon = lastWeapon[killerId] ?? "ar";
  target.isDead = true;

  // Find the assist: highest damage dealer among non-killers
  const log = damageLog[victimId] ?? {};
  let assistId: string | undefined;
  let bestDmg = 0;
  for (const [attackerId, dmg] of Object.entries(log)) {
    if (attackerId !== killerId && dmg > bestDmg) {
      bestDmg = dmg;
      assistId = attackerId;
    }
  }
  delete damageLog[victimId];

  io.emit("player_killed", {
    victim: victimId,
    killer: killerId,
    assist: assistId,
    weapon,
    cause,
    explosionPos: cause === "grenade" ? explosionPos : undefined,
  });
  scheduleRespawn(io, victimId);
}

export function registerHandlers(io: Server, socket: Socket) {
  if (Object.keys(players).length >= MAX_PLAYERS) {
    socket.emit("server_full", {
      message: "The server is full. Maximum 5 players allowed.",
    });
    socket.disconnect();
    return;
  }

  console.log(`[Socket] Player connected: ${socket.id}`);

  players[socket.id] = {
    id: socket.id,
    name: "Anonimo",
    position: getRandomSpawn(),
    rotation: { x: 0, y: 0, z: 0 },
    color:
      "#" +
      Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0"),
    hp: 100,
    isDead: false,
    isInvincible: false,
  };

  socket.emit("init", { id: socket.id, players });
  socket.broadcast.emit("player_joined", players[socket.id]);

  // Lightweight ping measurement (client sends, server acks immediately)
  socket.on("ping_check", (cb: () => void) => {
    if (typeof cb === "function") cb();
  });

  socket.on("set_name", (data: { name: string }) => {
    if (players[socket.id]) {
      players[socket.id].name = (data.name || "Anonimo").slice(0, 16).trim();
    }
  });

  socket.on("update_state", (data: { position: Vec3; rotation: Vec3 }) => {
    if (players[socket.id] && !players[socket.id].isDead) {
      const pos = { ...data.position };
      pos.x = Math.max(-49, Math.min(49, pos.x));
      pos.z = Math.max(-49, Math.min(49, pos.z));
      for (const box of MAP_BOXES) resolveBoxCollision(pos, box);
      players[socket.id].position = pos;
      players[socket.id].rotation = data.rotation;
    }
  });

  socket.on("shout", (data: { origin: Vec3; forward: Vec3 }) => {
    const SHOUT_RANGE = 5; // metres
    const SHOUT_DAMAGE = 40;
    const KNOCK_H = 26; // horizontal impulse magnitude
    const KNOCK_V = 14; // vertical impulse

    const { origin, forward } = data;
    // Normalise the forward vector (XZ only, trust the client direction)
    const fLen = Math.sqrt(forward.x * forward.x + forward.z * forward.z) || 1;
    const fx = forward.x / fLen;
    const fz = forward.z / fLen;

    for (const [id, target] of Object.entries(players)) {
      if (id === socket.id) continue;
      if (target.isDead || target.isInvincible) continue;

      const dx = target.position.x - origin.x;
      const dz = target.position.z - origin.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > SHOUT_RANGE) continue;

      // Must be in front: dot(forward, dir_to_target) > 0
      const dot = (dx / (dist || 1)) * fx + (dz / (dist || 1)) * fz;
      if (dot <= 0) continue;

      target.hp = Math.max(0, target.hp - SHOUT_DAMAGE);

      // Track damage for assist
      if (!damageLog[id]) damageLog[id] = {};
      damageLog[id][socket.id] = (damageLog[id][socket.id] ?? 0) + SHOUT_DAMAGE;

      // Knockback impulse direction (push away from caster)
      const dirLen = dist || 1;
      const knockback: Vec3 = {
        x: (dx / dirLen) * KNOCK_H,
        y: KNOCK_V,
        z: (dz / dirLen) * KNOCK_H,
      };

      if (target.hp <= 0) {
        killPlayer(io, id, socket.id, "grenade", origin);
      } else {
        io.emit("player_hit", { id, hp: target.hp });
      }

      // Broadcast visual fling to all clients (ragdoll-lite even if alive)
      io.emit("shout_blast", { victimId: id, origin });

      // Send knockback only to the victim
      io.to(id).emit("shout_knockback", { force: knockback });
    }
  });

  socket.on("grenade_throw", (data: { explosionPos: Vec3 }) => {
    const ep = data.explosionPos;
    io.emit("grenade_explode", { position: ep, throwerId: socket.id });

    for (const [id, target] of Object.entries(players)) {
      if (target.isDead || target.isInvincible) continue;
      const dx = target.position.x - ep.x;
      const dy = target.position.y - ep.y;
      const dz = target.position.z - ep.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > BLAST_RADIUS) continue;

      const t = 1 - dist / BLAST_RADIUS;
      const dmg = Math.round(MIN_DAMAGE + t * (MAX_DAMAGE - MIN_DAMAGE));
      target.hp = Math.max(0, target.hp - dmg);

      // Track damage for assist
      if (!damageLog[id]) damageLog[id] = {};
      damageLog[id][socket.id] = (damageLog[id][socket.id] ?? 0) + dmg;

      if (target.hp <= 0) {
        killPlayer(io, id, socket.id, "grenade", ep);
      } else {
        io.emit("player_hit", { id, hp: target.hp });
      }
    }
  });

  socket.on("weapon_switch", (data: { weaponId: string }) => {
    socket.broadcast.emit("weapon_switch", {
      id: socket.id,
      weaponId: data.weaponId,
    });
  });

  socket.on("grenade_launched", (data: { origin: Vec3; velocity: Vec3 }) => {
    socket.broadcast.emit("grenade_launched", data);
  });

  socket.on("grenade_throw", (data: { explosionPos: Vec3 }) => {
    const ep = data.explosionPos;
    io.emit("grenade_explode", { position: ep, throwerId: socket.id });

    for (const [id, target] of Object.entries(players)) {
      if (target.isDead || target.isInvincible) continue;
      const dx = target.position.x - ep.x;
      const dy = target.position.y - ep.y;
      const dz = target.position.z - ep.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > BLAST_RADIUS) continue;

      const t = 1 - dist / BLAST_RADIUS;
      const dmg = Math.round(MIN_DAMAGE + t * (MAX_DAMAGE - MIN_DAMAGE));
      target.hp = Math.max(0, target.hp - dmg);

      // Track damage for assist
      if (!damageLog[id]) damageLog[id] = {};
      damageLog[id][socket.id] = (damageLog[id][socket.id] ?? 0) + dmg;

      if (target.hp <= 0) {
        killPlayer(io, id, socket.id, "grenade", ep);
      } else {
        io.emit("player_hit", { id, hp: target.hp, damage: dmg });
      }
    }
  });

  socket.on(
    "hit_player",
    (data: { targetId: string; damage?: number; weaponId?: string }) => {
      const target = players[data.targetId];
      if (target && !target.isDead && !target.isInvincible) {
        const dmg = Math.min(data.damage ?? BULLET_DAMAGE, 300); // clamp (headshots can be 2x)
        target.hp -= dmg;
        if (data.weaponId) lastWeapon[socket.id] = data.weaponId;

        // Track damage for assist
        if (!damageLog[data.targetId]) damageLog[data.targetId] = {};
        damageLog[data.targetId][socket.id] =
          (damageLog[data.targetId][socket.id] ?? 0) + dmg;

        if (target.hp <= 0) {
          killPlayer(io, target.id, socket.id, "bullet");
        } else {
          io.emit("player_hit", { id: target.id, hp: target.hp, damage: dmg });
        }
      }
    },
  );

  socket.on("chat_message", (data: { message: string }) => {
    if (players[socket.id]) {
      const msg = (data.message || "").slice(0, 120).trim();
      if (msg.length > 0) {
        socket.broadcast.emit("chat_message", {
          name: players[socket.id].name,
          message: msg,
          id: socket.id,
        });
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] Player disconnected: ${socket.id}`);
    delete players[socket.id];
    // Clean up damage log entries for/by this player
    delete damageLog[socket.id];
    delete lastWeapon[socket.id];
    for (const victimId in damageLog) {
      delete damageLog[victimId][socket.id];
    }
    io.emit("player_left", socket.id);
  });
}
