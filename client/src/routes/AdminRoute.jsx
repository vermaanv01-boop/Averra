import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingScreen from '../components/common/LoadingScreen.jsx'
import { useAuth } from '../hooks/useAuth.js'

export default function AdminRoute() {
  const { user, status, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading || status === 'loading') {
    return <LoadingScreen message="Checking administrator access…" />
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/app" state={{ adminDenied: true, from: location }} replace />
  }

  return <Outlet />
}
