import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";

let io: SocketIOServer;

export const initSocket = (httpServer: HttpServer) => {
  io = new SocketIOServer(httpServer, {
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

// Helper to get the IO instance later
export const getSocketIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};