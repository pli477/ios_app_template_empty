import { WebSocketServer } from 'ws';
import { startGoogleTTSStream } from './googleStream.js';

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

console.log(` WebSocket Gateway started: ws://localhost:${PORT}`);

wss.on('connection', (ws, req) => {
  console.log(' client connected:', req.socket?.remoteAddress);

  let googleStream = null;

  // 封装一个确保有流的函数
  function ensureGoogleStream() {
    if (googleStream) return googleStream;

    console.log('creating google streaming NOW');

    googleStream = startGoogleTTSStream(
      // onAudioChunk
      (buf) => {
        // 小包多数是 keepalive 生成的，不转发
        if (buf.length < 2000) {
          return;
        }
        console.log(' send chunk to client:', buf.length);
        ws.send(buf);
      },
      // onEnd
      () => {
        console.log('google ended -> notify client');
        ws.send(JSON.stringify({ type: 'end' }));
      },
      // onError
      (err) => {
        console.log(' google error -> client:', err.message);
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    );

    return googleStream;
  }

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      const g = ensureGoogleStream();
      g.sendText(raw.toString());
      return;
    }

    if (msg.type === 'text') {
      const g = ensureGoogleStream();
      g.sendText(msg.text);
    } else if (msg.type === 'keepalive') {
      const g = ensureGoogleStream();
      g.sendKeepalive();
    }
  });

  ws.on('close', () => {
    console.log('client disconnected');
    if (googleStream) {
      googleStream.close();
    }
  });

  ws.on('error', (err) => {
    console.error('ws error:', err.message);
    if (googleStream) {
      googleStream.close();
    }
  });
});
