import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingScreen from '../components/common/LoadingScreen.jsx'
import { useAuth } from '../hooks/useAuth.js'

export default function PublicOnlyRoute() {
  const { status, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading || status === 'loading') {
    return <LoadingScreen message="Checking your session…" />
  }

  if (status === 'authenticated') {
    const fallback = location.state?.from?.pathname || '/app'
    return <Navigate to={fallback} replace />
  }

  return <Outlet />
}
