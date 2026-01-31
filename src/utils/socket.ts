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

    // Join a specific "Room" (e.g., "order_123" or "restaurant_456")
    // Frontend (Customer/Vendor) will emit 'join_room' with their specific ID
    socket.on("join_room", (room) => {
      socket.join(room);
      console.log(`User ${socket.id} joined room: ${room}`);
    });

    // 🏍️ RIDER SPECIFIC: Riders join this global room to see "Ready for Pickup" orders
    socket.on("join_rider_feed", () => {
        socket.join("riders_main_feed");
        console.log(`🏍️ Rider ${socket.id} joined rider feed`);
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