import dotenv from "dotenv";
dotenv.config();

import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import sdk from "microsoft-cognitiveservices-speech-sdk";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const SPEECH_KEY = process.env.SPEECH_KEY || "";
const SPEECH_REGION = process.env.SPEECH_REGION || "";

if (!SPEECH_KEY || !SPEECH_REGION) {
  console.warn("Missing SPEECH_KEY or SPEECH_REGION in .env");
}

// --- 工具函数: 如果是 WAV/RIFF，提取其中的 PCM16 数据段 ---
function stripWavHeaderIfPresent(buf: Buffer): Buffer {
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x41 &&
    buf[10] === 0x56 &&
    buf[11] === 0x45
  ) {
    // 查找 "data" chunk
    // "data" = 0x64 0x61 0x74 0x61
    const dataTagIndex = buf.indexOf("data");
    if (dataTagIndex !== -1) {
      const dataSizeStart = dataTagIndex + 4; // after "data"
      const dataSizeLE = buf.readUInt32LE(dataSizeStart); // chunk size
      const dataStart = dataTagIndex + 8; // skip "data" + size(4 bytes)
      const dataEnd = dataStart + dataSizeLE;
      if (dataEnd <= buf.length) {
        console.log(
          `[RELAY] stripWavHeaderIfPresent: WAV detected. dataStart=${dataStart}, dataSize=${dataSizeLE}`
        );
        return buf.slice(dataStart, dataEnd);
      }
    }
    console.log(
      "[RELAY] stripWavHeaderIfPresent: WAV header seen but 'data' chunk parse fallback -> returning original"
    );
    return buf;
  }

  // 否则直接返回原始
  return buf;
}

// 用一次性合成拿音频 (result.audioData)
async function synthesizeOnceToPcmBuffer({
  text,
}: {
  text: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // 1. speech config
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      SPEECH_KEY,
      SPEECH_REGION
    );

    // 选声音
    speechConfig.speechSynthesisVoiceName = "zh-CN-XiaoxiaoNeural";

    // 关键：我们让 Azure 返回 RIFF/WAV PCM，而不是 MP3/OGG 等压缩格式
    // 24kHz 单声道 16-bit PCM WAV
    speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm;

    // 2. 创建合成器
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

    // 3. 合成
    synthesizer.speakTextAsync(
      text,
      (result) => {
        synthesizer.close();

        if (
          result.reason === sdk.ResultReason.SynthesizingAudioCompleted ||
          result.reason === sdk.ResultReason.SynthesizingAudioStarted
        ) {
          const fullBuf = Buffer.from(result.audioData);

          console.log(
            `[RELAY] got audioData len=${fullBuf.length} bytes (likely WAV)`
          );

          const head = fullBuf.slice(0, 32);

          // 尝试剥掉 WAV header, 提取纯PCM16
          const pcmOnly = stripWavHeaderIfPresent(fullBuf);
          console.log(
            `[RELAY] after stripWavHeaderIfPresent len=${pcmOnly.length} bytes`
          );

          resolve(pcmOnly);
        } else {
          reject(
            new Error(
              `Synthesis failed: ${result.reason} / ${result.errorDetails}`
            )
          );
        }
      },
      (err) => {
        synthesizer.close();
        reject(err);
      }
    );
  });
}

// 把PCM切成小块丢给浏览器
async function streamPcmToBrowser(
  pcmBuffer: Buffer,
  browserWS: WebSocket,
  chunkSize = 4096
) {
  let total = 0;
  let packetCount = 0;
  browserWS.send(JSON.stringify({ type: "started" }));

  for (let offset = 0; offset < pcmBuffer.length; offset += chunkSize) {
    const slice = pcmBuffer.slice(offset, offset + chunkSize);
    total += slice.length;
    packetCount += 1;

    // 推给前端
    browserWS.send(
      JSON.stringify({
        type: "audio_chunk",
        audio_base64: slice.toString("base64"),
      })
    );

    // 轻微延时 → 保证浏览器有机会一块块播放
    await new Promise((r) => setTimeout(r, 2));
  }

  console.log(
    `[RELAY] streamed packets=${packetCount}, totalSent=${total} bytes`
  );

  browserWS.send(JSON.stringify({ type: "done" }));
}

// WebSocket server暴露给浏览器
const server = http.createServer();
const wss = new WebSocketServer({ server, path: "/client" });

wss.on("connection", (browserWS) => {
  console.log("[RELAY] browser connected");

  browserWS.on("message", async (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      console.warn("[RELAY] got non-JSON from browser");
      return;
    }

    if (msg.type === "speak_text") {
      const text: string = msg.text || "";
      console.log("[RELAY] will synthesize:", text);

      try {
        // 1. 让 Azure 合成并返回 PCM16 (去掉WAV头后)
        const pcmBuffer = await synthesizeOnceToPcmBuffer({ text });

        // 2. 按块发给浏览器
        await streamPcmToBrowser(pcmBuffer, browserWS);

        console.log("[RELAY] done streaming to client");
      } catch (err) {
        console.error("[RELAY] Azure synth error:", err);
        browserWS.send(
          JSON.stringify({
            type: "error",
            detail: "Azure synth failed",
          })
        );
      }
    }
  });

  browserWS.on("close", () => {
    console.log("[RELAY] browser disconnected");
  });
});

server.listen(PORT, () => {
  console.log(`[RELAY] running at ws://localhost:${PORT}/client`);
});


