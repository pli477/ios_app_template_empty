import { useRef, useState } from 'react';
import { createChatSession } from "../server/openAIChatSession";
import { createOpenAIRecorder } from "../server/createOpenAIRecorder";

export interface Message {
  role: "user" | "ai";
  text: string;
  latency?: number;
}

export function useOpenAITranscribe() {
    const [isConnected, setIsConnected] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [transcript, setTranscript] = useState<Message>({ role: "user", text: "", latency: 0 });
    const chatSessionRef = useRef(createChatSession());
    const recorder = useRef(createOpenAIRecorder()).current; 
    const [aiReply, setAiReply] = useState<Message>({ role: "ai", text: "", latency: 0 });

    async function start() {
        console.log("client start is called")

        try {
            setTranscript({ role: "user", text: "", latency: 0 });
            await recorder.start();
            setIsConnected(true);
        } catch (e) {
            console.error(e);
            setIsConnected(false);
        }
    }

    async function stop() {
        console.log("client stop is called")
        setIsConnected(false);
        try {
          const t0Transcribe = performance.now();
          const text = await recorder.stopAndTranscribe();
          const t1Transcribe = performance.now();
          const transcribeLatency = Math.trunc(t1Transcribe - t0Transcribe);
          // setTranscript({ role: "user", text: text ?? "", latency: transcribeLatency });
          console.log(text ? 'transcribeDone' : 'noValidSpeech');

          setMessages(prev => [
            ...prev,
            { role: "user", text: text ?? "", latency: transcribeLatency }
          ]);

          if (text && text.trim()) {
            const t0Reply = performance.now();
            const reply = await chatSessionRef.current.send(text);
            const t1Reply = performance.now();
            const sendLatency = Math.trunc(t1Reply - t0Reply);
            // setAiReply({ role: "ai", text: reply ?? "", latency: sendLatency });
            setMessages(prev => [
              ...prev,
              { role: "ai", text: reply ?? "", latency: sendLatency }
            ]);
          } else {
            // setAiReply({ role: "ai", text: "", latency: 0 });
            setMessages(prev => [
              ...prev,
              { role: "ai", text: "", latency: 0 }
            ]);
          }

        } catch {
          console.log('transcribeFailed');
          setAiReply({ role: "ai", text: "", latency: 0 });
        }
    }

    async function clear() {
        setMessages([]);
        setTranscript({ role: "user", text: "", latency: 0 });
        setAiReply({ role: "ai", text: "", latency: 0 });
    }

    return { start, stop, clear, isConnected, transcript, aiReply, messages };
}
