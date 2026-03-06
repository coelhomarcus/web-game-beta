import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3005;
const MAX_PLAYERS = 5;

interface PlayerState {
    id: string;
    name: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    color: string;
    hp: number;
    isDead: boolean;
}

const players: Record<string, PlayerState> = {};

// ─── Map boxes (same RNG seed as frontend for consistency) ────────────────────
function makeRng() {
    let s = 42;
    return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 2 ** 32; };
}

interface BoxBounds { cx: number; cz: number; hw: number; hd: number; }
const MAP_BOXES: BoxBounds[] = [];
((() => {
    const rng = makeRng();
    for (let i = 0; i < 20; i++) {
        const h = rng() * 4 + 1; // consumed but not needed for XZ
        const x = (rng() - 0.5) * 40;
        const z = (rng() - 0.5) * 40;
        MAP_BOXES.push({ cx: x, cz: z, hw: 1, hd: 1 }); // box half-width/depth = 1 (2x2 box)
        void h;
    }
}))();

const SPAWN_PLAYER_RADIUS = 1.2; // extra margin so spawn is never right at the wall

function isInsideBox(x: number, z: number): boolean {
    return MAP_BOXES.some(b =>
        Math.abs(x - b.cx) < b.hw + SPAWN_PLAYER_RADIUS &&
        Math.abs(z - b.cz) < b.hd + SPAWN_PLAYER_RADIUS
    );
}

function getRandomSpawn() {
    let x: number, z: number;
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

    socket.on('set_name', (data: { name: string }) => {
        if (players[socket.id]) {
            players[socket.id].name = (data.name || 'Anônimo').slice(0, 16).trim();
        }
    });

    socket.on('update_state', (data: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number } }) => {
        if (players[socket.id] && !players[socket.id].isDead) {
            players[socket.id].position = data.position;
            players[socket.id].rotation = data.rotation;
        }
    });

    socket.on('shoot', (data: { origin: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number } }) => {
        // Broadcast the shot to all OTHER players so they see the bullet
        socket.broadcast.emit('shoot_bullet', data);
    });

    socket.on('hit_player', (data: { targetId: string }) => {
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
            } else {
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
