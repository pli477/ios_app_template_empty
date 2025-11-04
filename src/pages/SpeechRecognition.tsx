import { useEffect, useRef, useState } from 'react';
import { useRealtimeAudioREST } from '../../hooks/useRealtimeAudioREST';

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
        <button onClick={onStart}> 🎤 Start & Speak </button>) : (
        <button onClick={onStop} > ⏹ Stop </button>
      )}
    </div>
  );
}

export default function SpeechRecognition() {

  const { start, stop, isConnected, transcript} = useRealtimeAudioREST();

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Speech to text</h1>
        <ControlPanel isConnected={isConnected} onStart={start} onStop={stop} />
        <TranscriptPanel transcript={transcript} />
    </div>
  );
}
