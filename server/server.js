import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";
import { createTtsSession } from "./tts/factory.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3002;
const server = app.listen(PORT, () => {
  console.log(`[server] http listening on 0.0.0.0:${PORT}`);
});

const wss = new WebSocketServer({ server, path: "/ws/tts" });

wss.on("connection", (ws, req) => {
  console.log("[ws] client connected");

  const safeSendJSON = (obj) => {
    if (ws.readyState !== ws.OPEN) return;
    try {
      ws.send(JSON.stringify(obj));
    } catch {
      // ignore
    }
  };

  // 从 query 里拿 provider，支持 ?provider=azure / ?provider=elevenlabs
  const url = new URL(req.url, "http://localhost");
  const providerName =
    url.searchParams.get("provider") || process.env.TTS_PROVIDER || "elevenlabs";

  console.log("[ws] using provider:", providerName);

  // 创建 TtsSession
  const session = createTtsSession(providerName);

  // 注册回调，把 session 的事件映射到 WebSocket
  session.onStart(({ contentType }) => {
    safeSendJSON({ event: "start", provider: providerName, contentType });
  });

  session.onAudio((chunk) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(chunk); // 二进制音频流
    }
  });

  session.onEnd(() => {
    safeSendJSON({ event: "end", provider: providerName });
  });

  session.onCancelled(() => {
    safeSendJSON({ event: "cancelled", provider: providerName });
  });

  session.onError((err) => {
    console.error("[ws] TTS error:", err);
    safeSendJSON({
      event: "error",
      provider: providerName,
      message: err?.message || String(err),
    });
  });

  ws.on("message", async (raw) => {
    let cmd;
    try {
      cmd = JSON.parse(raw.toString());
    } catch {
      safeSendJSON({ event: "error", message: "Invalid JSON command." });
      return;
    }

    const { type, text, voiceId, modelId, optimizeStreamingLatency, outputFormat } =
      cmd || {};

    if (type === "start") {
      if (!text || !text.trim()) {
        safeSendJSON({ event: "error", message: "Missing 'text'." });
        return;
      }

      await session.start({
        text,
        voiceId,
        modelId,
        optimizeStreamingLatency,
        outputFormat,
      });
    } else if (type === "append") {
      await session.appendText?.({
        text,
      });
    } else if (type === "stop") {
      await session.stop();
    } else {
      safeSendJSON({ event: "error", message: `Unknown command type: ${type}` });
    }
  });

  ws.on("close", () => {
    console.log("[ws] client disconnected");
    session.dispose();
  });
});
