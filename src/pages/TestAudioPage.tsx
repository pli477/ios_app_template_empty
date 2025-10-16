import React, { useState } from "react";

export default function TestAudioPage() {
  const [text, setText] = useState("你好");

  const handlePlay = async () => {
    const audio = new Audio(
      `http://localhost:3001/api/tts/stream?text=${encodeURIComponent(text)}`
    );
    try {
      await audio.play();
    } catch (e) {
      console.error("audio.play() failed:", e);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h3>文字转语音测试</h3>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ padding: 8, width: "70%" }}
      />
      <button onClick={handlePlay} style={{ marginLeft: 8, padding: 8 }}>
        ▶ 播放
      </button>
    </div>
  );
}
