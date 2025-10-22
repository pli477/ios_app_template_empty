import express from "express";
import fetch from "node-fetch";
import https from "https";

const app = express();
const agent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 128,
});

const ELEVEN_API_KEY = (process.env.ELEVEN_API_KEY || "").trim();
// const DEFAULT_VOICE_ID = (process.env.VOICE_ID || "EXAVITQu4vr4xnSDxMaL").trim();
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

setTimeout(async () => {
  try {
    await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}/stream`, {
      method: "POST",
      headers: { "xi-api-key": ELEVEN_API_KEY, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text: "hi",
        model_id: "eleven_multilingual_v2",
        optimize_streaming_latency: 4,
      }),
      agent,
    }).then((r) => {
      const body: any = r.body;
      if (!body) return;
      if (typeof body.cancel === "function") {
        body.cancel();
      } else if (typeof body.destroy === "function") {
        body.destroy();
      }
    });
    console.log('Warmup ok for voice', DEFAULT_VOICE_ID);
  } catch (e) {
    console.error("Warmup failed:", e);
  }
}, 2000);

app.get("/api/tts/stream", async (req, res) => {
  const text = (req.query.text || "Hello World streaming test.").toString();
  const voiceId = (req.query.voiceId || DEFAULT_VOICE_ID).toString();
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;
  const lat = Math.max(0, Math.min(4, Number(req.query.lat ?? 3))) | 0;
  const tStart = Date.now();

  // 提前下发响应头 尽快进入解码等
  res.status(200);
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Connection", "keep-alive");
  (res as any).flushHeaders?.();

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
        "content-type": "application/json",
        "accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.4, similarity_boost: 0.8 },
        optimize_streaming_latency: 3, // optimize from 0 - 4
      }),
      agent,
    });

    if (!upstream.ok) {
      const msg = await upstream.text().catch(() => "");
      return res.status(upstream.status).type("application/json").send(msg || '{"error":"upstream"}');
    }

    let firstChunkLogged = false;
    const bodyStream: any = upstream.body;

    bodyStream.on("data", (chunk: any) => {
      if (!firstChunkLogged) {
        firstChunkLogged = true;
        const latency = Date.now() - tStart;
        console.log(`[TTS] First audio chunk after ${latency ?? 'N/A'} ms`);
      }
    });

    upstream.body?.pipe(res);
  } catch (err) {
    console.error("[TTS ERROR]", err);
    res.status(500).json({ error: "TTS upstream failed" });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`✅ TTS Proxy running at http://localhost:${port}`));
