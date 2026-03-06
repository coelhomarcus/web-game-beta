import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { PORT, TICK_RATE } from './config';
import { registerHandlers, getPlayers } from './handlers';

const app = express();
app.use(cors());

const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('/{*path}', (_req, res, next) => {
    if (_req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

io.on('connection', (socket) => {
    registerHandlers(io, socket);
});

setInterval(() => {
    io.emit('game_state', getPlayers());
}, 1000 / TICK_RATE);

server.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT}`);
});
