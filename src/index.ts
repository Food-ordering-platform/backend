import http from "http";
import app from "./app"; 

const server = http.createServer(app); // Wrap the existing app

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});