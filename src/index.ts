import express from "express";
import http from "http";
import { initSocket } from "./utils/socket"; 


const app = express();
const server = http.createServer(app); 
const io = initSocket(server); 


const PORT = process.env.PORT || 5000;

// CHANGE app.listen TO server.listen
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});