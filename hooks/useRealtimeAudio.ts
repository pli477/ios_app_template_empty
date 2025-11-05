import { useEffect, useRef, useState } from 'react';

// This hook manages microphone capture, PCM16 encoding, WebSocket communication, and state.
export function useRealtimeAudio(wsUrl: string) {
    const [isConnected, setIsConnected] = useState(false);
    const [transcript, setTranscript] = useState('');
    const wsRef = useRef<WebSocket | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);

    // useEffect(() => {
    //     return () => stop();
    // }, []);

    async function start() {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new AudioContext({ sampleRate: 16000 });
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        const ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
            console.log('✅ Connected to Realtime server');
        };

        ws.onmessage = (event) => {
            console.log('event data:', event.data);

            if (typeof event.data === 'string') {
                try {
                    const msg = JSON.parse(event.data);

                    console.log('Received message:', msg);
                    if (msg.type === 'transcript') {
                        setTranscript(msg.text);
                    } else if (msg.type === 'log') {
                      console.log('msg.text');
                    }
                } catch {}
            }
        };

        ws.onerror = (err) => {
            console.log('❌ WebSocket error');
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (e) => {
            const input = e.inputBuffer.getChannelData(0);
            const pcm16 = floatTo16BitPCM(input);
            if (ws.readyState === WebSocket.OPEN) ws.send(pcm16);
        };
    }

    function stop() {
        console.log("client stop is called")
        setIsConnected(false);
        wsRef.current?.close();
        processorRef.current?.disconnect();
    }

    function floatTo16BitPCM(float32Array: Float32Array) {
        const buffer = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(buffer);
        let offset = 0;
        for (let i = 0; i < float32Array.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        }
        return buffer;
    }

    return { start, stop, isConnected, transcript };
}
