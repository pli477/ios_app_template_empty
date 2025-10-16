import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PermissionsPage from './pages/PermissionsPage'
import BlankPage from './pages/BlankPage'
import TestAudioPage from "./pages/TestAudioPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/permissions" element={<PermissionsPage />} />
        <Route path="/blank" element={<BlankPage />} />
        <Route path="/testAudio" element={<TestAudioPage />} />
        <Route path="*" element={<Navigate to="/permissions" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
