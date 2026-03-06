import { Server, Socket } from 'socket.io';
import { PlayerState, Vec3 } from './types';
import { MAP_BOXES } from './map';
import { resolveBoxCollision, getRandomSpawn } from './physics';
import { MAX_PLAYERS, BLAST_RADIUS, MAX_DAMAGE, MIN_DAMAGE, BULLET_DAMAGE, RESPAWN_TIME } from './config';

const players: Record<string, PlayerState> = {};

// damageLog[victimId][attackerId] = total damage dealt
const damageLog: Record<string, Record<string, number>> = {};

export function getPlayers(): Record<string, PlayerState> {
    return players;
}

function scheduleRespawn(io: Server, id: string) {
    setTimeout(() => {
        if (players[id]) {
            players[id].hp = 100;
            players[id].isDead = false;
            players[id].position = getRandomSpawn();
            io.emit('player_respawned', players[id]);
        }
    }, RESPAWN_TIME);
}

function killPlayer(io: Server, victimId: string, killerId: string) {
    const target = players[victimId];
    target.hp = 0;
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

    io.emit('player_killed', { victim: victimId, killer: killerId, assist: assistId });
    scheduleRespawn(io, victimId);
}

export function registerHandlers(io: Server, socket: Socket) {
    if (Object.keys(players).length >= MAX_PLAYERS) {
        socket.emit('server_full', { message: 'The server is full. Maximum 5 players allowed.' });
        socket.disconnect();
        return;
    }

    console.log(`[Socket] Player connected: ${socket.id}`);

    players[socket.id] = {
        id: socket.id,
        name: 'Anonimo',
        position: getRandomSpawn(),
        rotation: { x: 0, y: 0, z: 0 },
        color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
        hp: 100,
        isDead: false
    };

    socket.emit('init', { id: socket.id, players });
    socket.broadcast.emit('player_joined', players[socket.id]);

    socket.on('set_name', (data: { name: string }) => {
        if (players[socket.id]) {
            players[socket.id].name = (data.name || 'Anonimo').slice(0, 16).trim();
        }
    });

    socket.on('update_state', (data: { position: Vec3; rotation: Vec3 }) => {
        if (players[socket.id] && !players[socket.id].isDead) {
            const pos = { ...data.position };
            pos.x = Math.max(-49, Math.min(49, pos.x));
            pos.z = Math.max(-49, Math.min(49, pos.z));
            for (const box of MAP_BOXES) resolveBoxCollision(pos, box);
            players[socket.id].position = pos;
            players[socket.id].rotation = data.rotation;
        }
    });

    socket.on('shoot', (data: { origin: Vec3; direction: Vec3 }) => {
        socket.broadcast.emit('shoot_bullet', data);
    });

    socket.on('grenade_launched', (data: { origin: Vec3; velocity: Vec3 }) => {
        socket.broadcast.emit('grenade_launched', data);
    });

    socket.on('grenade_throw', (data: { explosionPos: Vec3 }) => {
        const ep = data.explosionPos;
        io.emit('grenade_explode', { position: ep, throwerId: socket.id });

        for (const [id, target] of Object.entries(players)) {
            if (target.isDead) continue;
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
                killPlayer(io, id, socket.id);
            } else {
                io.emit('player_hit', { id, hp: target.hp });
            }
        }
    });

    socket.on('hit_player', (data: { targetId: string }) => {
        const target = players[data.targetId];
        if (target && !target.isDead) {
            target.hp -= BULLET_DAMAGE;

            // Track damage for assist
            if (!damageLog[data.targetId]) damageLog[data.targetId] = {};
            damageLog[data.targetId][socket.id] = (damageLog[data.targetId][socket.id] ?? 0) + BULLET_DAMAGE;

            if (target.hp <= 0) {
                killPlayer(io, target.id, socket.id);
            } else {
                io.emit('player_hit', { id: target.id, hp: target.hp });
            }
        }
    });

    socket.on('chat_message', (data: { message: string }) => {
        if (players[socket.id]) {
            const msg = (data.message || '').slice(0, 120).trim();
            if (msg.length > 0) {
                socket.broadcast.emit('chat_message', {
                    name: players[socket.id].name,
                    message: msg,
                    id: socket.id
                });
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] Player disconnected: ${socket.id}`);
        delete players[socket.id];
        // Clean up damage log entries for/by this player
        delete damageLog[socket.id];
        for (const victimId in damageLog) {
            delete damageLog[victimId][socket.id];
        }
        io.emit('player_left', socket.id);
    });
}
