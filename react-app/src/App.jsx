import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ChartsPage from './pages/ChartsPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import { useSession } from './hooks/useSession'

function PrivateRoute({ children }) {
    const session = useSession()
    if (!session) return <Navigate to="/login" replace />
    return children
}

function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
            <Route path="/charts" element={<PrivateRoute><ChartsPage /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
            <Route path="/admin" element={<PrivateRoute><AdminPage /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

export default App
