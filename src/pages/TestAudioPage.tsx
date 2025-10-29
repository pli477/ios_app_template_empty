import React, { useState } from "react";
import { speakAzureRealtime } from "./speakAzureRealtime";

export default function TestAudioPage() {
  const [text, setText] = useState("Input test here");

  const handleRealtimeSpeak = () => {
    speakAzureRealtime(text);
  };

  return (
    <div style={{ padding: "16px", fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: "12px" }}>
        <textarea
          style={{
            width: "100%",
            height: "80px",
            fontSize: "16px",
            padding: "8px",
          }}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <button
        style={{
          padding: "8px 16px",
          fontSize: "16px",
          cursor: "pointer",
        }}
        onClick={handleRealtimeSpeak}
      >
        Click
      </button>
    </div>
  );
}
