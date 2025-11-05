import WebSocket, { WebSocketServer } from "ws";
import dotenv from "dotenv";

dotenv.config();

const PORT = 8080;
const OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";


const wss = new WebSocketServer({ port: PORT });

console.log(`✅ WebSocket Proxy started: ws://localhost:${PORT}`);

wss.on("connection", async (client, req) => {
  console.log("🟢 Client connected:", req.socket.remoteAddress);

  // Create connection to OpenAI Realtime API
  const openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
    headers: {
      // "Authorization": `Bearer ${process.env.VITE_OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  // === forward messages from OpenAI → client ===
  openaiWs.on("message", (data) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });

  openaiWs.on("open", () => {
    console.log("✅ Connected to OpenAI Realtime API");
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "log", text: "Connected to OpenAI Realtime API" }));
    }
  });

  openaiWs.on("close", (code, reason) => {
    console.log(`OpenAI connection closed: code=${code}, reason=${reason}`);
    client.close();
  });

  openaiWs.on("error", (err) => {
    console.error("❌ OpenAI WS error:", err.message);
    client.send(JSON.stringify({ type: "error", message: err.message }));
  });

  // === forward messages from client → OpenAI ===
  client.on("message", (data) => {
    if (openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.send(data);
    }
  });

  client.on("close", () => {
    console.log("🔴 Client disconnected");
    openaiWs.close();
  });

  client.on("error", (err) => {
    console.error("❌ Client WS error:", err.message);
    openaiWs.close();
  });
});