import { TtsSession } from "../TtsSession.js";

export class AzureSession extends TtsSession {
  constructor(options = {}) {
    super();

    // 优先使用构造参数，其次用环境变量
    this.region =
      options.region ||
      process.env.AZURE_SPEECH_REGION ||
      process.env.AZURE_REGION;
    this.key =
      options.key ||
      process.env.AZURE_SPEECH_KEY ||
      process.env.AZURE_KEY;

    this.defaultVoice =
      options.voiceName ||
      process.env.AZURE_TTS_VOICE ||
      "zh-CN-XiaoxiaoNeural";

    this.defaultOutputFormat =
      options.outputFormat ||
      process.env.AZURE_TTS_OUTPUT_FORMAT ||
      "audio-24khz-48kbitrate-mono-mp3";

    this._abortController = null;
  }

  /**
   * 开始一次合成并流式输出
   *
   * options:
   *  - text: 必填
   *  - voiceId / voiceName: 可选，覆盖默认 voice
   *  - outputFormat: 可选，覆盖默认格式
   */
  async start({ text, voiceId, voiceName, outputFormat, language } = {}) {
    // 先停掉上一次
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }

    if (!this.region || !this.key) {
      const err = new Error(
        "Azure TTS region/key 未配置，请检查 AZURE_SPEECH_REGION / AZURE_SPEECH_KEY 或 AZURE_REGION / AZURE_KEY"
      );
      this._emitError(err);
      return;
    }

    if (!text || !text.trim()) {
      const err = new Error("Azure TTS 调用缺少 text");
      this._emitError(err);
      return;
    }

    const voice =
      voiceName || voiceId || this.defaultVoice || "zh-CN-XiaoxiaoNeural";
    const outFormat = outputFormat || this.defaultOutputFormat;

    const ssml = `
      <speak version="1.0" xml:lang="${language || "zh-CN"}">
        <voice xml:lang="${language || "zh-CN"}" name="${voice}">
          ${text}
        </voice>
      </speak>
    `.trim();

    const endpoint = `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`;

    const ac = new AbortController();
    this._abortController = ac;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        signal: ac.signal,
        headers: {
          "Ocp-Apim-Subscription-Key": this.key,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": outFormat,
          "User-Agent": "realtime-tts-gateway",
        },
        body: ssml,
      });

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        const err = new Error(
          `Azure TTS 请求失败: status=${res.status}, detail=${detail}`
        );
        this._emitError(err);
        return;
      }

      const contentType =
        res.headers.get("content-type") || "application/octet-stream";

      // 通知上层开始（server.js 会转成 {event:"start", contentType} 给前端）
      this._emitStart({ contentType });

      const reader = res.body.getReader();

      // 不断读取 chunk，直接往上抛二进制
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.length) {
          // value: Uint8Array (PCM 24kHz mono)
          this._emitAudio(value);
        }
      }

      this._emitEnd();
    } catch (err) {
      if (err?.name === "AbortError") {
        this._emitCancelled();
      } else {
        this._emitError(err);
      }
    } finally {
      if (this._abortController === ac) {
        this._abortController = null;
      }
    }
  }

  async stop() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  cancel() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  dispose() {
    this.cancel();
  }
}
