import { Outlet } from 'react-router-dom'
import AdminNav from '../components/admin/AdminNav.jsx'

export default function AdminLayout() {
  return (
    <div className="space-y-8">
      <AdminNav />
      <Outlet />
    </div>
  )
}
