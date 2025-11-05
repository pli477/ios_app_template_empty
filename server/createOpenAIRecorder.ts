export interface OpenAIRecorderHandle {
  start: () => Promise<void>;
  stopAndTranscribe: () => Promise<string>; // returns transcript
}

export function createOpenAIRecorder(): OpenAIRecorderHandle {
  let mediaRecorder: MediaRecorder | null = null;
  let mediaStream: MediaStream | null = null;
  let chunks: BlobPart[] = [];
  let mimeType = '';

  async function start() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('获取麦克风权限成功');
    mediaStream = stream;
    chunks = [];
    const preferMp4 = (window as any).MediaRecorder && (MediaRecorder as any).isTypeSupported?.('audio/mp4');
    const preferWebm = (window as any).MediaRecorder && (MediaRecorder as any).isTypeSupported?.('audio/webm');
    const chosenMime = preferMp4 ? 'audio/mp4' : (preferWebm ? 'audio/webm' : '');
    mimeType = chosenMime;
    const rec = chosenMime ? new MediaRecorder(stream, { mimeType: chosenMime }) : new MediaRecorder(stream);
    mediaRecorder = rec;
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) { chunks.push(e.data); }};
    rec.start(200);
  } catch (err) {
    console.error('获取麦克风权限失败:', err);
  }    
  }

  async function stopAndTranscribe(): Promise<string> {
    try { 
      mediaRecorder?.stop();
      mediaStream?.getTracks().forEach(t => t.stop());
      const type = mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type });
      return await transcribeWithOpenAI(blob); 
  }  catch(e) {
      console.error("stopAndTranscribe stop error", e);
      return ""
    }
  }

  async function transcribeWithOpenAI(audioBlob: Blob): Promise<string> {
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) throw new Error('缺少 OpenAI API Key');
      const form = new FormData();
      const ext = audioBlob.type.includes('mp4') ? 'mp4' : (audioBlob.type.includes('webm') ? 'webm' : 'wav');
      form.append('file', audioBlob, `audio.${ext}`);
      form.append('model', 'whisper-1');
      form.append('response_format', 'text');
      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });

      if (!res.ok) {      
        const t = await res.text();
        throw new Error(`OpenAI 转写失败: ${res.status} ${t}`);
      }
      const text = await res.text();
      return text.trim();
    } catch(e) {
      console.error("transcribeWithOpenAI error", e);
      return '';
    } finally {      mediaRecorder = null;
      mediaStream = null;
      chunks = [];
      mimeType = '';
    }
  }

  return { start, stopAndTranscribe };
}