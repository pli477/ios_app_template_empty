/*
 - 通过 WebSocket 把要朗读的文字发给后端 (realtimeTtsProxy.ts)
 - 后端会源源不断发回 { type: "audio_chunk", audio_base64: "..." }
   这些 chunk 是 24kHz, mono, 16-bit PCM（已经去掉 WAV header）
 - 我们把这些 chunk 解码成 Float32Array(24kHz) -> 重采样到设备采样率
 - 把每个chunk按时间线排队衔接播放，做到低延迟 + 不重复半句
**/

let ws;
let audioCtx;

// for latency metric
let firstChunkPlayed = false;
let t0 = 0;

// playback timeline control
// nextStartTime: 下一段音频应该在 audioCtx 里的什么时间点开始
let nextStartTime = 0;

// 我们会做一个小策略：
// 第一个 chunk 不立即播，而是先暂存 (holdFirstChunk)
// 等第二个 chunk 到来时，把两个 chunk 拼成一个稍微长一点的开头，再开始播。
// 这样可以避免“开头断一下然后重新来一遍”的听感。
let holdFirstChunk = null;   // Float32Array (24kHz mono) for first chunk we saw
let firstChunkQueued = false; // once we've actually scheduled audio for playback, this becomes true

// ========== 工具函数：base64 PCM16 LE mono -> Float32Array (24kHz mono) ==========
function base64Pcm16ToFloat32Mono(base64) {
  // base64 -> binary string
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) {
    view[i] = raw.charCodeAt(i);
  }

  // Interpret as little-endian signed 16-bit PCM mono
  const pcm16 = new Int16Array(buf);
  const f32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    f32[i] = pcm16[i] / 32768; // [-1,1]
  }
  return f32;
}

// ========== 用 OfflineAudioContext 把单个 chunk 从 24kHz 重采样到设备采样率 ==========
// 输入: float32Chunk24k  (Float32Array, mono @24kHz)
// 输出: Float32Array, mono @ deviceRate (比如 48000)
async function resampleChunkToDeviceRate(float32Chunk24k, deviceRate) {
  const inRate = 24000;
  if (inRate === deviceRate) {
    return float32Chunk24k;
  }

  // 估算输出帧数
  const frameCount = Math.ceil((float32Chunk24k.length * deviceRate) / inRate);

  // OfflineAudioContext 可以高质量重采样
  const offlineCtx = new OfflineAudioContext(
    1,          // mono
    frameCount, // 渲染帧数
    deviceRate  // 目标采样率
  );

  // 把 24kHz mono 样本塞进一个 AudioBuffer
  const buffer = offlineCtx.createBuffer(1, float32Chunk24k.length, inRate);
  buffer.copyToChannel(float32Chunk24k, 0, 0);

  // Source -> Offline destination
  const src = offlineCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(offlineCtx.destination);
  src.start(0);

  // 渲染到目标采样率
  const rendered = await offlineCtx.startRendering();
  const outData = new Float32Array(rendered.length);
  rendered.copyFromChannel(outData, 0, 0);

  return outData;
}

// ========== 把一段（可能是 merge 过的）24kHz chunk 排进播放时间线 ==========
// float32Chunk24k: Float32Array mono @24kHz
async function scheduleChunkPlayback(float32Chunk24k) {
  // 懒初始化/唤醒 AudioContext
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  // 首帧策略：
  // - 第一次进来的chunk：我们只暂存到 holdFirstChunk，不播
  // - 第二次进来的chunk：把 holdFirstChunk + 当前chunk 合并，然后才真正安排播放
  if (!firstChunkQueued) {
    if (holdFirstChunk == null) {
      // 第一个chunk，先缓存起来，不排播放
      holdFirstChunk = float32Chunk24k;
      return;
    } else {
      // 第二个chunk到了 -> 合并成一个更长的首帧
      const merged = new Float32Array(
        holdFirstChunk.length + float32Chunk24k.length
      );
      merged.set(holdFirstChunk, 0);
      merged.set(float32Chunk24k, holdFirstChunk.length);

      float32Chunk24k = merged;   // 用合并后的大块当成真正的“开头”
      holdFirstChunk = null;
      firstChunkQueued = true;    // 从现在开始我们会直接播放后续chunk
    }
  }

  // 现在我们手上的 float32Chunk24k 就是：
  //  - (第二块时) 首帧合并的大块
  //  - 或者 (后续块时) 单个chunk本身

  const deviceRate = audioCtx.sampleRate; // e.g. 48000 on many systems
  const resampled = await resampleChunkToDeviceRate(float32Chunk24k, deviceRate);

  // 把重采样后的 PCM 塞进真正要播的 AudioBuffer
  const audioBuffer = audioCtx.createBuffer(
    1,
    resampled.length,
    deviceRate
  );
  audioBuffer.copyToChannel(resampled, 0, 0);

  // 创建 source node
  const srcNode = audioCtx.createBufferSource();
  srcNode.buffer = audioBuffer;
  srcNode.connect(audioCtx.destination);

  // 计算它应该什么时候开始播
  // - 如果是整句的第一段播放，我们别直接用 currentTime，
  //   给一点点(50ms)安全空间，避免冷启动爆音/缺头
  let startAt;
  if (nextStartTime === 0) {
    startAt = audioCtx.currentTime + 0.05; // warmup ~50ms
  } else {
    startAt = nextStartTime;
  }

  // 这个chunk的实际时长（秒）
  const chunkDurationSec = audioBuffer.duration;

  // 下一个chunk要排的位置 = 这次开始时间 + 本段时长
  nextStartTime = startAt + chunkDurationSec;

  // 首次真正安排播放 -> 记录首音延迟
  if (!firstChunkPlayed) {
    firstChunkPlayed = true;
    const ms = (performance.now() - t0).toFixed(0);
    console.log(`🔥 Azure realtime first sound after ${ms} ms`);
  }

  // 安排播放
  srcNode.start(startAt);
}

// WebSocket监听服务端消息
async function ensureWS() {
  return new Promise((resolve, reject) => {
    // 如果已经连上，重用
    if (ws && ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }

    ws = new WebSocket("ws://localhost:4000/client");

    ws.addEventListener("open", () => {
      console.log("[FE] ✅ connected to realtime TTS relay");
      resolve();
    });

    ws.addEventListener("error", (err) => {
      console.error("[FE] ❌ ws error:", err);
      reject(err);
    });

    // 收服务器发回的消息
    ws.addEventListener("message", async (evt) => {
      let msg;
      try {
        msg = JSON.parse(evt.data);
      } catch (e) {
        console.warn("[FE] got non-JSON from relay");
        return;
      }

      if (msg.type === "started") {
        console.log("[FE] synthesis started");
        return;
      }

      if (msg.type === "audio_chunk") {
        const b64 = msg.audio_base64;
        if (!b64) return;

        // base64 -> Float32Array(24kHz mono)
        const f32_24k = base64Pcm16ToFloat32Mono(b64);

        console.log(
          "[FE] got audio_chunk",
          "base64Len=",
          b64.length,
          "samples24k=",
          f32_24k.length
        );

        // 把这一块排进播放时间线
        await scheduleChunkPlayback(f32_24k);

        return;
      }

      if (msg.type === "done") {
        console.log("[FE] done");
        // 这里我们不需要额外播什么。
        // 因为所有 chunk（包括最后的）都会通过 scheduleChunkPlayback() 排进时间线。
        return;
      }

      if (msg.type === "error") {
        console.error("[FE] relay/provider error:", msg.detail || msg.msg);
        return;
      }

      if (msg.type === "debug") {
        console.log("[FE][debug]", msg.msg);
        return;
      }
    });
  });
}

// 页面按钮点击时会调用的入口函数
export async function speakAzureRealtime(text) {
  await ensureWS();

  // 为新一轮播放重置所有状态
  nextStartTime = 0;
  holdFirstChunk = null;
  firstChunkQueued = false;
  firstChunkPlayed = false;
  t0 = performance.now();

  // 把要朗读的文本发给后端
  ws.send(
    JSON.stringify({
      type: "speak_text",
      text,
    })
  );
}
