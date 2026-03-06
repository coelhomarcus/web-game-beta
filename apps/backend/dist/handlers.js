"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlayers = getPlayers;
exports.registerHandlers = registerHandlers;
const map_1 = require("./map");
const physics_1 = require("./physics");
const config_1 = require("./config");
const players = {};
function getPlayers() {
    return players;
}
function scheduleRespawn(io, id) {
    setTimeout(() => {
        if (players[id]) {
            players[id].hp = 100;
            players[id].isDead = false;
            players[id].position = (0, physics_1.getRandomSpawn)();
            io.emit('player_respawned', players[id]);
        }
    }, config_1.RESPAWN_TIME);
}
function killPlayer(io, victimId, killerId) {
    const target = players[victimId];
    target.hp = 0;
    target.isDead = true;
    io.emit('player_killed', { victim: victimId, killer: killerId });
    scheduleRespawn(io, victimId);
}
function registerHandlers(io, socket) {
    if (Object.keys(players).length >= config_1.MAX_PLAYERS) {
        socket.emit('server_full', { message: 'The server is full. Maximum 5 players allowed.' });
        socket.disconnect();
        return;
    }
    console.log(`[Socket] Player connected: ${socket.id}`);
    players[socket.id] = {
        id: socket.id,
        name: 'Anonimo',
        position: (0, physics_1.getRandomSpawn)(),
        rotation: { x: 0, y: 0, z: 0 },
        color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
        hp: 100,
        isDead: false
    };
    socket.emit('init', { id: socket.id, players });
    socket.broadcast.emit('player_joined', players[socket.id]);
    socket.on('set_name', (data) => {
        if (players[socket.id]) {
            players[socket.id].name = (data.name || 'Anonimo').slice(0, 16).trim();
        }
    });
    socket.on('update_state', (data) => {
        if (players[socket.id] && !players[socket.id].isDead) {
            const pos = Object.assign({}, data.position);
            pos.x = Math.max(-49, Math.min(49, pos.x));
            pos.z = Math.max(-49, Math.min(49, pos.z));
            for (const box of map_1.MAP_BOXES)
                (0, physics_1.resolveBoxCollision)(pos, box);
            players[socket.id].position = pos;
            players[socket.id].rotation = data.rotation;
        }
    });
    socket.on('shoot', (data) => {
        socket.broadcast.emit('shoot_bullet', data);
    });
    socket.on('grenade_launched', (data) => {
        socket.broadcast.emit('grenade_launched', data);
    });
    socket.on('grenade_throw', (data) => {
        const ep = data.explosionPos;
        io.emit('grenade_explode', { position: ep, throwerId: socket.id });
        for (const [id, target] of Object.entries(players)) {
            if (target.isDead)
                continue;
            const dx = target.position.x - ep.x;
            const dy = target.position.y - ep.y;
            const dz = target.position.z - ep.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist > config_1.BLAST_RADIUS)
                continue;
            const t = 1 - dist / config_1.BLAST_RADIUS;
            const dmg = Math.round(config_1.MIN_DAMAGE + t * (config_1.MAX_DAMAGE - config_1.MIN_DAMAGE));
            target.hp = Math.max(0, target.hp - dmg);
            if (target.hp <= 0) {
                killPlayer(io, id, socket.id);
            }
            else {
                io.emit('player_hit', { id, hp: target.hp });
            }
        }
    });
    socket.on('hit_player', (data) => {
        const target = players[data.targetId];
        if (target && !target.isDead) {
            target.hp -= config_1.BULLET_DAMAGE;
            if (target.hp <= 0) {
                killPlayer(io, target.id, socket.id);
            }
            else {
                io.emit('player_hit', { id: target.id, hp: target.hp });
            }
        }
    });
    socket.on('disconnect', () => {
        console.log(`[Socket] Player disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('player_left', socket.id);
    });
}
