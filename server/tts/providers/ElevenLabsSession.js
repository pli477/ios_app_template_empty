import { TtsSession } from "../TtsSession.js";
import { ElevenLabsTts } from "./ElevenLabsTts.js";

export class ElevenLabsSession extends TtsSession {
  constructor(options = {}) {
    super();
    this._client = new ElevenLabsTts(options);
    this._abortController = null;
  }

  async start({
    text,
    voiceId,
    modelId,
    optimizeStreamingLatency,
    outputFormat,
  }) {
    // 先把上一次的流停掉
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }

    const ac = new AbortController();
    this._abortController = ac;

    // 调用底层 ElevenLabsTts 封装
    this._client
      .stream({
        text,
        voiceId,
        modelId,
        optimizeStreamingLatency,
        outputFormat,
        abortSignal: ac.signal,

        onStart: (info) => {
          this._emitStart(info); // server.js 会收到
        },
        onChunk: (chunk) => {
          this._emitAudio(chunk);
        },
        onEnd: () => {
          this._emitEnd();
        },
        onCancelled: () => {
          this._emitCancelled();
        },
        onError: (err) => {
          this._emitError(err);
        },
      })
      .finally(() => {
        if (this._abortController === ac) {
          this._abortController = null;
        }
      });
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
