import { useRef, useState, useEffect } from 'react';

export interface Message {
  role: "user" | "ai";
  text: string;
  latency?: number;
}

export function useHuoshanTranscribe() {
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState<Message>({ role: "user", text: "", latency: 0 });
  const [aiReply, setAiReply] = useState<Message>({ role: "ai", text: "", latency: 0 });
  const [messages, setMessages] = useState<Message[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

    // ✅ 追踪最新状态值
  const transcriptRef = useRef(transcript);
  const aiReplyRef = useRef(aiReply);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    aiReplyRef.current = aiReply;
  }, [aiReply]);

const start = () => {
  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
    setIsConnected(true);
    return;
  }

  const ws = new WebSocket("ws://localhost:8000/ws/control");
  wsRef.current = ws;

  ws.onopen = () => {
    console.log("✅ Connected to Python server");
    setIsConnected(true);
    // 可以在这里发送 start 命令
    ws.send("start");
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.event === "chat_ended") {
        const latestTranscript = transcriptRef.current.text;
        const latestAiReply = aiReplyRef.current.text;

        setMessages(prev => [
          ...prev,
          { role: "user", text: latestTranscript, latency: 0 },
          { role: "ai", text: latestAiReply, latency: 0 }
        ]);

        setTranscript({ role: "user", text: "", latency: 0 });
        setAiReply({ role: "ai", text: "", latency: 0 });
      } else {
        if (data.user_text) {
          setTranscript({ role: "user", text: data.user_text || "", latency: 0 });
        }

        if (data.ai_reply) {
          setAiReply(prev => ({ role: "ai", text: prev.text + data.ai_reply, latency: 0 }));
        }
      }
    } catch (err) {
      console.error("Failed to parse websocket message:", err);
    }
  };

  ws.onclose = () => {
    console.log("🔴 WebSocket closed");
    setIsConnected(false);
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
  };
};
  const stop = () => {
    // 通知后端停止 Python service
    wsRef.current?.send(JSON.stringify("stop"));
    setIsConnected(false);
  };

  const clear = () => {
    setMessages([]);
    setTranscript({ role: "user", text: "", latency: 0 });
    setAiReply({ role: "ai", text: "", latency: 0 });
  };

    // 清理 WebSocket
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return { start, stop, clear, isConnected, transcript, aiReply, messages };
}