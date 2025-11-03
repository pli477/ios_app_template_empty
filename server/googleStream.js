import textToSpeech from '@google-cloud/text-to-speech';

const client = new textToSpeech.TextToSpeechClient({
  keyFilename: './google-tts-key.json',
});


export function startGoogleTTSStream(onAudioChunk, onEnd, onError) {
  let closed = false;

  const stream = client
    .streamingSynthesize()
    .on('data', (resp) => {
      if (resp.audioChunk && resp.audioChunk.audioData) {
        const buf = Buffer.from(resp.audioChunk.audioData);
        onAudioChunk && onAudioChunk(buf);
      }
    })
    .on('end', () => {
      if (closed) return;
      closed = true;
      console.log(' google stream ended');
      onEnd && onEnd();
    })
    .on('error', (err) => {
      if (closed) return;
      closed = true;
      console.error(' google stream error:', err.message);
      onError && onError(err);
    });

  // 第一个包：必须是 Chirp3-HD
  stream.write({
    streamingConfig: {
      voice: {
        name: 'en-US-Chirp3-HD-Kore',
        languageCode: 'en-US',
      },
      audioConfig: {
        audioEncoding: 'MP3',
      },
    },
  });

  return {
    sendText(text) {
      if (closed) return;
      if (!text || !text.trim()) return;
      console.log(' send to google:', text);
      stream.write({ input: { text } });
    },
    sendKeepalive() {
      if (closed) return;
      // 用真正文本，确保 google 认可
      stream.write({ input: { text: 'keepalive for streaming' } });
    },
    close() {
      if (closed) return;
      closed = true;
      console.log(' closing google stream (manual)');
      stream.end();
    },
  };
}
