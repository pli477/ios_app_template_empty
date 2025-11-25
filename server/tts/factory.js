import { ElevenLabsSession } from "./providers/ElevenLabsSession.js";
import { AzureSession } from "./providers/AzureSession.js";

export function createTtsSession(providerName, options = {}) {
  const normalized = (providerName || "").toLowerCase();

  switch (normalized) {
    case "azure":
      return new AzureSession(options);
    case "elevenlabs":
      return new ElevenLabsSession(options);
    case "":
    case undefined:
    case null:
      return new ElevenLabsSession(options);
    default:
      console.warn(
        `[TtsFactory] unknown provider "${providerName}", fallback to ElevenLabs.`
      );
      return new ElevenLabsSession(options);
  }
}
