import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PermissionsPage from './pages/PermissionsPage'
import BlankPage from './pages/BlankPage'
import GoogleRealtimeTTS from './pages/GoogleRealtimeTTS'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/permissions" element={<PermissionsPage />} />
        <Route path="/blank" element={<BlankPage />} />
        <Route path="/tts" element={<GoogleRealtimeTTS />} />
        <Route path="*" element={<Navigate to="/permissions" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
