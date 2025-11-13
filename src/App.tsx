import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PermissionsPage from './pages/PermissionsPage'
import BlankPage from './pages/BlankPage'
import RealtimeTTSPage from './pages/RealtimeTTSPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/permissions" element={<PermissionsPage />} />
        <Route path="/blank" element={<BlankPage />} />
        <Route path="/RealtimeTTSPage" element={<RealtimeTTSPage />} />
        <Route path="*" element={<Navigate to="/permissions" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
