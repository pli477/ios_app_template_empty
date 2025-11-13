import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());


app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = 3002;
const server = app.listen(PORT, "127.0.0.1", () => {
  console.log(`[server] http listening on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server, path: "/ws/tts" });


wss.on("connection", (ws) => {
  console.log("[ws] client connected");
  let currentAbortController = null;

  const safeSendJSON = (obj) => {
    try { ws.send(JSON.stringify(obj)); } catch (e) { /* ignore */ }
  };

  ws.on("message", async (raw) => {
    // 只接受 JSON 文本消息作为指令
    let cmd;
    try {
      cmd = JSON.parse(raw.toString());
    } catch {
      safeSendJSON({ event: "error", message: "Expected JSON message." });
      return;
    }

    const {
      text,
      voiceId = "JBFqnCBsd6RMkjVDRZzb",
      modelId = "eleven_flash_v2_5",
      optimizeStreamingLatency = 3,
      outputFormat = "pcm_16000"
    } = cmd || {};

    if (!process.env.ELEVEN_API_KEY) {
      safeSendJSON({ event: "error", message: "Missing ELEVEN_API_KEY in server env." });
      return;
    }
    if (!text || !text.trim()) {
      safeSendJSON({ event: "error", message: "Missing 'text'." });
      return;
    }

    // 若上一个任务存在，先取消
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }

    const ac = new AbortController();
    currentAbortController = ac;

    try {
      const url =
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream` +
        `?optimize_streaming_latency=${encodeURIComponent(optimizeStreamingLatency)}`;

      const body = {
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8
        },
        output_format: outputFormat
      };

      const upstream = await fetch(url, {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVEN_API_KEY,
          "Content-Type": "application/json",
          "Accept": outputFormat.startsWith("mp3") ? "audio/mpeg" : "application/octet-stream"
        },
        body: JSON.stringify(body),
        signal: ac.signal
      });

      if (!upstream.ok || !upstream.body) {
        const detail = await upstream.text().catch(() => "");
        safeSendJSON({ event: "error", message: "Upstream TTS failed", status: upstream.status, detail });
        return;
      }

      const contentType =
        upstream.headers.get("content-type") ||
        (outputFormat.startsWith("mp3") ? "audio/mpeg" : "application/octet-stream");

      safeSendJSON({ event: "start", contentType });

      const reader = upstream.body.getReader();

      // 逐块把 ElevenLabs 的音频转发给前端（WS 二进制帧）
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (ws.readyState === ws.OPEN) {
          ws.send(value); // 直接发送 Uint8Array，客户端得到的是 binary frame
        } else {
          break;
        }
      }

      // 结束
      safeSendJSON({ event: "end" });
    } catch (err) {
      if (err?.name === "AbortError") {
        // 被新任务打断，不算错误
        safeSendJSON({ event: "cancelled" });
      } else {
        console.error("[ws] stream error:", err);
        safeSendJSON({ event: "error", message: "Streaming error" });
      }
    } finally {
      if (currentAbortController === ac) {
        currentAbortController = null;
      }
    }
  });

  ws.on("close", () => {
    if (currentAbortController) currentAbortController.abort();
    console.log("[ws] client disconnected");
  });
});
