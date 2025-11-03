import React, { useEffect, useRef, useState } from 'react';

const WS_URL = 'ws://localhost:8080';
const KEEPALIVE_MS = 3000;

type CtrlMsg =
  | { type: 'end' }
  | { type: 'error'; message: string }
  | Record<string, any>;

export default function GoogleRealtimeTTS() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [text, setText] = useState('Hello my name is jenny');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // 播放
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const pendingRef = useRef<Uint8Array[]>([]);

  useEffect(() => {
    // ---------- MediaSource ----------
    const ms = new MediaSource();
    mediaSourceRef.current = ms;
    if (audioRef.current) {
      audioRef.current.src = URL.createObjectURL(ms);
    }
    ms.addEventListener('sourceopen', () => {
      const sb = ms.addSourceBuffer('audio/mpeg');
      sourceBufferRef.current = sb;
      sb.addEventListener('updateend', () => {
        const next = pendingRef.current.shift();
        if (next && !sb.updating) {
          sb.appendBuffer(next);
        }
      });
    });

    // ---------- WebSocket ----------
    if (wsRef.current) return;

    const ws = new WebSocket(WS_URL);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      console.log('[WS] connected');
      setConnected(true);
      // 刚连上说明是正常的，不要显示旧错误
      setErrMsg(null);
    };

    ws.onmessage = (evt) => {
      if (evt.data instanceof ArrayBuffer) {
        const chunk = new Uint8Array(evt.data);
        const sb = sourceBufferRef.current;
        if (sb && !sb.updating) {
          sb.appendBuffer(chunk);
        } else {
          pendingRef.current.push(chunk);
        }
        audioRef.current?.play().catch(() => {});
      } else {
        // 控制消息
        try {
          const msg = JSON.parse(evt.data as string) as CtrlMsg;
          console.log('[WS] ctrl:', msg);
          if (msg.type === 'error') {
            setErrMsg(msg.message);
          }
        } catch {
          console.log('[WS] text:', evt.data);
        }
      }
    };

    ws.onerror = (ev) => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.warn('[WS] error (probably dev double-connect)', ev);
        // 不 setErrMsg，避免UI一直红
      }
    };

    ws.onclose = () => {
      console.log('[WS] closed');
      setConnected(false);
      wsRef.current = null;
    };

    wsRef.current = ws;

    // ---------- keepalive ----------
    const timer = setInterval(() => {
      const cur = wsRef.current;
      if (!cur || cur.readyState !== WebSocket.OPEN) return;
      cur.send(JSON.stringify({ type: 'keepalive' }));
    }, KEEPALIVE_MS);

    return () => {
      clearInterval(timer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const handleSend = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // 提示是真没连上
      setErrMsg('WebSocket not connected');
      return;
    }
    ws.send(JSON.stringify({ type: 'text', text }));
  };

  return (
    <div style={{ padding: 16, maxWidth: 520 }}>
      <p style={{ fontSize: 13, color: connected ? '#0a7a0a' : '#c62828' }}>
        {connected ? `已连接 ${WS_URL}` : ' 未连接'}
      </p>

      <textarea
        rows={3}
        style={{ width: '100%', marginBottom: 8 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <button onClick={handleSend} disabled={!connected}>
        Test
      </button>

      {!connected && errMsg ? (
        <p style={{ marginTop: 8, fontSize: 12, color: '#c62828' }}>
          错误：{errMsg}
        </p>
      ) : null}

      <audio ref={audioRef} controls style={{ width: '100%' }} />
    </div>
  );
}
