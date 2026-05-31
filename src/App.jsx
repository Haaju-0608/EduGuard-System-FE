import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import UserProfilePage from './pages/UserProfile'
import AdminDashboardPage from './pages/AdminDashboard'
import ProtectedRoute from './components/auth/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/profile/*"
          element={
            <ProtectedRoute allowedRole="user">
              <UserProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
