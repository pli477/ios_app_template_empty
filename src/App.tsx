import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import BlankPage from './pages/BlankPage'
import SpeechRecognition from './pages/SpeechRecognition'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/speechRecognition" element={<SpeechRecognition />} />
        <Route path="/blank" element={<BlankPage />} />
        <Route path="/" element={<Navigate to="/speechRecognition" replace />} />
        <Route path="*" element={<Navigate to="/speechRecognition" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
