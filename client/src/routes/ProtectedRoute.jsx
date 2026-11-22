import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingScreen from '../components/common/LoadingScreen.jsx'
import { useAuth } from '../hooks/useAuth.js'

export default function ProtectedRoute() {
  const { status, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading || status === 'loading') {
    return <LoadingScreen message="Checking your session…" />
  }

  if (!isAuthenticatedFor(status)) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

function isAuthenticatedFor(status) {
  return status === 'authenticated'
}
