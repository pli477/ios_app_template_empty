import { useEffect, useRef, useState } from 'react';
import { useOpenAITranscribe } from '../../hooks/useOpenAITranscribe';
import { useHuoshanTranscribe } from '../../hooks/useHuoshanTranscribe';

type Props = {
  isConnected: boolean;
  onStart: () => void;
  onStop: () => void;
};


export function TranscriptPanel({ transcript }: { transcript: string }) {
  return (
    <div className="p-4 bg-gray-100 rounded-xl shadow-sm">
      <h2 className="font-semibold mb-2">Transcript</h2>
        <p className="whitespace-pre-line text-gray-800">{transcript || '...'}</p>
    </div>
  );
}

export function ControlPanel({ isConnected, onStart, onStop }: Props) {
  return (
    <div className="flex gap-4 my-4">
      {!isConnected ? (
        <button onClick={onStart} > 🎤 Start & Speak </button>) : (
        <button onClick={onStop} > ⏹ Stop </button>
      )}
    </div>
  );
}

export default function SpeechRecognition() {

  const [selectedProvider, setSelectedProvider] = useState("openai");

  const openai = useOpenAITranscribe();
  const huoshan = useHuoshanTranscribe();

  const active = selectedProvider === "openai" ? openai : huoshan;

  const handleStart = () => {
    active.start();
  };

  const handleStop = () => {
    active.stop();
  };

  const handleClear = () => {
    active.clear();
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">模型测试</h1>
        {/* 模型选择下拉框 */}
        <div className="mb-4">
          <label className="font-medium mr-2">选择模型:</label>
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="border rounded-lg px-3 py-2 bg-white shadow-sm"
          >
            <option value="openai">🧠 OpenAI</option>
            <option value="huoshan">🔥 火山引擎</option>
          </select>
        </div>
        <ControlPanel isConnected={active.isConnected} onStart={handleStart} onStop={handleStop} />
        {active.messages.map((m) => (
          <div className="p-4 bg-gray-100 rounded-xl shadow-sm">
            <h2 className="font-semibold mb-2">{m.role === "user" ? "User" : "AI"}</h2>
            <p className="whitespace-pre-line text-gray-800">{m.text}</p>
            <p className="whitespace-pre-line text-gray-800">{`latency: ${m.latency}ms`}</p>
          </div>
        ))}
        <div className="p-4 bg-gray-100 rounded-xl shadow-sm">
          <h2 className="font-semibold mb-2">User</h2>
            <p className="whitespace-pre-line text-gray-800">{active.transcript.text || '...'}</p>
            <p className="whitespace-pre-line text-gray-800">{`latency: ${active.transcript.latency}ms`}</p>
        </div>
        <div className="p-4 bg-gray-100 rounded-xl shadow-sm">
          <h2 className="font-semibold mb-2">AI</h2>
            <p className="whitespace-pre-line text-gray-800">{active.aiReply.text || '...'}</p>
            <p className="whitespace-pre-line text-gray-800">{`latency: ${active.aiReply.latency}ms`}</p>
        </div>
        <button onClick={handleClear} > Clear </button>
    </div>
  );
}
