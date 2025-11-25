export class ElevenLabsTts {
  constructor({
    apiKey = process.env.ELEVEN_API_KEY,
    defaultVoiceId = "JBFqnCBsd6RMkjVDRZzb",
    defaultModelId = "eleven_flash_v2_5",
    defaultOptimizeStreamingLatency = 3,
    defaultOutputFormat = "pcm_16000",
  } = {}) {
    this.apiKey = apiKey;
    this.defaultVoiceId = defaultVoiceId;
    this.defaultModelId = defaultModelId;
    this.defaultOptimizeStreamingLatency = defaultOptimizeStreamingLatency;
    this.defaultOutputFormat = defaultOutputFormat;
  }

  /**
   * 启动一次流式 TTS
   *
   * @param {Object} params
   * @param {string} params.text                  文本内容（必填）
   * @param {string} [params.voiceId]             语音 ID
   * @param {string} [params.modelId]
   * @param {number} [params.optimizeStreamingLatency]
   * @param {string} [params.outputFormat]        e.g. "pcm_16000"
   * @param {AbortSignal} [params.abortSignal]    用于外部取消
   * @param {Function} [params.onStart]           (info: { contentType })
   * @param {Function} [params.onChunk]           (chunk: Uint8Array)
   * @param {Function} [params.onEnd]             ()
   * @param {Function} [params.onCancelled]       ()
   * @param {Function} [params.onError]           (error: Error)
   */
  async stream({
    text,
    voiceId,
    modelId,
    optimizeStreamingLatency,
    outputFormat,
    abortSignal,
    onStart,
    onChunk,
    onEnd,
    onCancelled,
    onError,
  }) {
    // 参数兜底
    const _voiceId = voiceId || this.defaultVoiceId;
    const _modelId = modelId || this.defaultModelId;
    const _optLatency =
      optimizeStreamingLatency ?? this.defaultOptimizeStreamingLatency;
    const _outputFormat = outputFormat || this.defaultOutputFormat;

    if (!this.apiKey) {
      const err = new Error("Missing ELEVEN_API_KEY in env.");
      onError && onError(err);
      throw err;
    }
    if (!text || !text.trim()) {
      const err = new Error("Missing 'text'.");
      onError && onError(err);
      throw err;
    }

    try {
      const url =
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
          _voiceId
        )}/stream` +
        `?optimize_streaming_latency=${encodeURIComponent(_optLatency)}`;

      const body = {
        text,
        model_id: _modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
        },
        output_format: _outputFormat,
      };

      const upstream = await fetch(url, {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
          "Content-Type": "application/json",
          Accept: _outputFormat.startsWith("mp3")
            ? "audio/mpeg"
            : "application/octet-stream",
        },
        body: JSON.stringify(body),
        signal: abortSignal,
      });

      if (!upstream.ok || !upstream.body) {
        const detail = await upstream.text().catch(() => "");
        const err = new Error(
          `Upstream TTS failed, status=${upstream.status}, detail=${detail}`
        );
        onError && onError(err);
        return;
      }

      const contentType =
        upstream.headers.get("content-type") ||
        (_outputFormat.startsWith("mp3")
          ? "audio/mpeg"
          : "application/octet-stream");

      onStart && onStart({ contentType });

      const reader = upstream.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && onChunk) {
          onChunk(value); // Uint8Array
        }
      }

      onEnd && onEnd();
    } catch (err) {
      if (err?.name === "AbortError") {
        onCancelled && onCancelled();
      } else {
        onError && onError(err);
      }
    }
  }
}
