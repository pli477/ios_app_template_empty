import express from "express";
import fetch from "node-fetch";
import https from "https";

const app = express();
const agent = new https.Agent({ keepAlive: true });

const ELEVEN_API_KEY = (process.env.ELEVEN_API_KEY || "").trim();
const DEFAULT_VOICE_ID = (process.env.VOICE_ID || "EXAVITQu4vr4xnSDxMaL").trim();

app.get("/api/tts/stream", async (req, res) => {
  const text = (req.query.text || "Hello World streaming test.").toString();
  const voiceId = (req.query.voiceId || DEFAULT_VOICE_ID).toString();
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;

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

    res.setHeader("content-type", upstream.headers.get("content-type") || "audio/mpeg");
    res.setHeader("cache-control", "no-store");
    upstream.body?.pipe(res);
  } catch (err) {
    console.error("[TTS ERROR]", err);
    res.status(500).json({ error: "TTS upstream failed" });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`✅ TTS Proxy running at http://localhost:${port}`));
