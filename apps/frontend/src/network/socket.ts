import { io, Socket } from "socket.io-client";
import { SOCKET_URL } from "../config";

export const socket: Socket = io(SOCKET_URL);
