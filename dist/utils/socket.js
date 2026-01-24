"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSocketIO = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
let io;
const initSocket = (httpServer) => {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: "*", // Allow all origins for now (adjust for production)
            methods: ["GET", "POST"]
        }
    });
    io.on("connection", (socket) => {
        console.log("🟢 User connected:", socket.id);
        // Join a "Room" based on User ID or Restaurant ID
        // Frontend will emit 'join_room' with their ID
        socket.on("join_room", (room) => {
            socket.join(room);
            console.log(`User ${socket.id} joined room: ${room}`);
        });
        socket.on("disconnect", () => {
            console.log("🔴 User disconnected:", socket.id);
        });
    });
    return io;
};
exports.initSocket = initSocket;
// Helper to get the IO instance later
const getSocketIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};
exports.getSocketIO = getSocketIO;
//# sourceMappingURL=socket.js.map