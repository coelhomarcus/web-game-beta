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
const config_1 = require("./config");
const handlers_1 = require("./handlers");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
const frontendDist = path_1.default.join(__dirname, '../../frontend/dist');
app.use(express_1.default.static(frontendDist));
app.get('/{*path}', (_req, res, next) => {
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
io.on('connection', (socket) => {
    (0, handlers_1.registerHandlers)(io, socket);
});
setInterval(() => {
    io.emit('game_state', (0, handlers_1.getPlayers)());
}, 1000 / config_1.TICK_RATE);
server.listen(config_1.PORT, () => {
    console.log(`[Server] Running on port ${config_1.PORT}`);
});
