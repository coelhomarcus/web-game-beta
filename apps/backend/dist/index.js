"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
// Serve frontend build in production
const frontendDist = path_1.default.join(__dirname, '../../frontend/dist');
app.use(express_1.default.static(frontendDist));
app.get('/{*path}', (_req, res, next) => {
    // Only serve index.html for non-API / non-socket requests
    if (_req.path.startsWith('/socket.io'))
        return next();
    res.sendFile(path_1.default.join(frontendDist, 'index.html'));
});
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
const PORT = process.env.PORT || 3005;
const MAX_PLAYERS = 5;
const players = {};
// ─── Map boxes (same RNG seed as frontend for consistency) ────────────────────
function makeRng() {
    let s = 42;
    return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 2 ** 32; };
}
const MAP_BOXES = [];
((() => {
    const rng = makeRng();
    for (let i = 0; i < 20; i++) {
        const h = rng() * 4 + 1;
        const x = (rng() - 0.5) * 40;
        const z = (rng() - 0.5) * 40;
        // cy = h/2 (box bottom sits on y=0), hh = h/2
        MAP_BOXES.push({ cx: x, cz: z, cy: h / 2, hw: 1, hd: 1, hh: h / 2 });
    }
}))();
const SPAWN_PLAYER_RADIUS = 1.2; // extra margin so spawn is never right at the wall
const PLAYER_RADIUS_SRV = 0.4;
const PLAYER_HEIGHT_SRV = 1.6;
function isInsideBox(x, z) {
    return MAP_BOXES.some(b => Math.abs(x - b.cx) < b.hw + SPAWN_PLAYER_RADIUS &&
        Math.abs(z - b.cz) < b.hd + SPAWN_PLAYER_RADIUS);
}
// Mirror of the frontend resolveBoxCollision — keeps players outside blocks.
function resolveBoxCollision(pos, box) {
    const hw = box.hw + PLAYER_RADIUS_SRV;
    const hd = box.hd + PLAYER_RADIUS_SRV;
    const pBot = pos.y - PLAYER_HEIGHT_SRV;
    const pTop = pos.y;
    const bBot = box.cy - box.hh;
    const bTop = box.cy + box.hh;
    const ox = hw - Math.abs(pos.x - box.cx);
    const oy = Math.min(pTop, bTop) - Math.max(pBot, bBot);
    const oz = hd - Math.abs(pos.z - box.cz);
    if (ox > 0 && oy > 0 && oz > 0) {
        if (ox < oz && ox < oy) {
            pos.x += ox * Math.sign(pos.x - box.cx);
        }
        else if (oz < ox && oz < oy) {
            pos.z += oz * Math.sign(pos.z - box.cz);
        }
        else if (pos.y > box.cy) {
            pos.y = bTop + PLAYER_HEIGHT_SRV;
        }
        else {
            pos.y = bBot - 0.01;
        }
    }
}
function getRandomSpawn() {
    let x, z;
    let attempts = 0;
    do {
        x = (Math.random() - 0.5) * 36; // slightly inside map edges
        z = (Math.random() - 0.5) * 36;
        attempts++;
    } while (isInsideBox(x, z) && attempts < 50);
    return { x, y: 1, z };
}
io.on('connection', (socket) => {
    if (Object.keys(players).length >= MAX_PLAYERS) {
        socket.emit('server_full', { message: 'The server is full. Maximum 5 players allowed.' });
        socket.disconnect();
        return;
    }
    console.log(`[Socket] Player connected: ${socket.id}`);
    players[socket.id] = {
        id: socket.id,
        name: 'Anônimo',
        position: getRandomSpawn(),
        rotation: { x: 0, y: 0, z: 0 },
        color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
        hp: 100,
        isDead: false
    };
    socket.emit('init', { id: socket.id, players });
    socket.broadcast.emit('player_joined', players[socket.id]);
    socket.on('set_name', (data) => {
        if (players[socket.id]) {
            players[socket.id].name = (data.name || 'Anônimo').slice(0, 16).trim();
        }
    });
    socket.on('update_state', (data) => {
        if (players[socket.id] && !players[socket.id].isDead) {
            const pos = Object.assign({}, data.position);
            // Clamp to map bounds
            pos.x = Math.max(-49, Math.min(49, pos.x));
            pos.z = Math.max(-49, Math.min(49, pos.z));
            // Server-side box collision — prevents wall-clipping from being broadcast
            for (const box of MAP_BOXES)
                resolveBoxCollision(pos, box);
            players[socket.id].position = pos;
            players[socket.id].rotation = data.rotation;
        }
    });
    socket.on('shoot', (data) => {
        // Broadcast the shot to all OTHER players so they see the bullet
        socket.broadcast.emit('shoot_bullet', data);
    });
    // ─── Grenade ──────────────────────────────────────────────────────────────
    socket.on('grenade_throw', (data) => {
        const BLAST_RADIUS = 7;
        const MAX_DAMAGE = 100;
        const MIN_DAMAGE = 25;
        const ep = data.explosionPos;
        // Broadcast explosion visual to ALL clients (including thrower)
        io.emit('grenade_explode', { position: ep, throwerId: socket.id });
        // Apply damage with distance falloff
        for (const [id, target] of Object.entries(players)) {
            if (target.isDead)
                continue;
            const dx = target.position.x - ep.x;
            const dy = target.position.y - ep.y;
            const dz = target.position.z - ep.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist > BLAST_RADIUS)
                continue;
            const t = 1 - dist / BLAST_RADIUS;
            const dmg = Math.round(MIN_DAMAGE + t * (MAX_DAMAGE - MIN_DAMAGE));
            target.hp = Math.max(0, target.hp - dmg);
            if (target.hp <= 0) {
                target.hp = 0;
                target.isDead = true;
                io.emit('player_killed', { victim: id, killer: socket.id });
                setTimeout(() => {
                    if (players[id]) {
                        players[id].hp = 100;
                        players[id].isDead = false;
                        players[id].position = getRandomSpawn();
                        io.emit('player_respawned', players[id]);
                    }
                }, 3000);
            }
            else {
                io.emit('player_hit', { id, hp: target.hp });
            }
        }
    });
    socket.on('hit_player', (data) => {
        const target = players[data.targetId];
        if (target && !target.isDead) {
            target.hp -= 25;
            if (target.hp <= 0) {
                target.hp = 0;
                target.isDead = true;
                io.emit('player_killed', { victim: target.id, killer: socket.id });
                // Respawn em 3 segundos
                setTimeout(() => {
                    if (players[target.id]) {
                        players[target.id].hp = 100;
                        players[target.id].isDead = false;
                        players[target.id].position = getRandomSpawn();
                        io.emit('player_respawned', players[target.id]);
                    }
                }, 3000);
            }
            else {
                // Avisa a todos (incluindo a vítima) sobre o hit para atualizar o HUD
                io.emit('player_hit', { id: target.id, hp: target.hp });
            }
        }
    });
    socket.on('disconnect', () => {
        console.log(`[Socket] Player disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('player_left', socket.id);
    });
});
setInterval(() => {
    io.emit('game_state', players);
}, 1000 / 30); // 30 ticks por segundo
server.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT}`);
});
