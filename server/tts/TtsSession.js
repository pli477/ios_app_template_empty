export class TtsSession {
  constructor() {
    this._onStart = () => {};
    this._onAudio = () => {};
    this._onEnd = () => {};
    this._onCancelled = () => {};
    this._onError = () => {};
  }

  // 事件注册
  onStart(cb) {
    this._onStart = cb || (() => {});
  }
  onAudio(cb) {
    this._onAudio = cb || (() => {});
  }
  onEnd(cb) {
    this._onEnd = cb || (() => {});
  }
  onCancelled(cb) {
    this._onCancelled = cb || (() => {});
  }
  onError(cb) {
    this._onError = cb || (() => {});
  }

  // 子类里调用这些方法，把事件抛给上层（server.js）
  _emitStart(info) {
    this._onStart(info);
  }
  _emitAudio(chunk) {
    this._onAudio(chunk);
  }
  _emitEnd() {
    this._onEnd();
  }
  _emitCancelled() {
    this._onCancelled();
  }
  _emitError(err) {
    this._onError(err);
  }

  // “抽象方法”，子类实现
  // options 里通常放 text / voiceId / modelId 等
  async start(_options) {
    throw new Error("TtsSession.start() not implemented");
  }

  // 边说边追加文本, optional
  async appendText(_options) {
    // optional
  }

  async stop() {
    throw new Error("TtsSession.stop() not implemented");
  }

  // cancel / dispose 给 server.js 在 ws close 时调用
  cancel() {
    // optional
  }

  dispose() {
    this.cancel();
  }
}
