import http from "http";
import app from "./app"; 
import { initSocket } from "./utils/socket";

const server = http.createServer(app); // Wrap the existing app
const io = initSocket(server);

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});