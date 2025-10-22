import React, { useRef, useState, useEffect } from "react";

export default function TestAudioPage(): JSX.Element {
   const [text, setText] = useState("你好，欢迎使用测试。");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 分句函数
    function splitToSentences(t: string) {
      return (t.match(/[^。！？!?]+[。！？!?]?/g) || [t])
        .map((s) => s.trim())
        .filter(Boolean);
    }

  function play(url: string) {
    const audio = new Audio(url);
    const t0 = performance.now();
    const onPlaying = () => {
      console.log(`First sound after ${(performance.now() - t0).toFixed(0)} ms`);
      audio.removeEventListener("playing", onPlaying);
    };
    audio.addEventListener("playing", onPlaying);
    audio.play();
    return audio;
  }

  const handlePlay = async () => {
    // cleanup previous audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }

    const audio = new Audio(
      `http://localhost:3001/api/tts/stream?text=${encodeURIComponent(text)}`
    );
    audioRef.current = audio;

    const t0 = performance.now();
    const onPlaying = () => {
      console.log(`First sound after ${(performance.now() - t0).toFixed(0)} ms`);
      audio.removeEventListener("playing", onPlaying);
    };

    audio.addEventListener("playing", onPlaying);

    try {
      await audio.play();
    } catch (e) {
      console.error("audio.play() failed:", e);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h3>文字转语音测试</h3>
      <input
        type="text"
        value={text}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
        style={{ padding: 8, width: "70%" }}
      />
      <button onClick={handlePlay} style={{ marginLeft: 8, padding: 8 }}>
        ▶ 播放
      </button>
    </div>
  );
}
