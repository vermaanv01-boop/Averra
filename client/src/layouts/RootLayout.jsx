import { Outlet } from 'react-router-dom'

export default function RootLayout() {
  return (
    <div className="min-h-screen bg-ivory-50 text-ink-900">
      <Outlet />
    </div>
  )
}
