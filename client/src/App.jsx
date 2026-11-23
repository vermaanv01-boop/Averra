import { Route, Routes } from 'react-router-dom'
import AuthLayout from './layouts/AuthLayout.jsx'
import AdminLayout from './layouts/AdminLayout.jsx'
import AppLayout from './layouts/AppLayout.jsx'
import PublicLayout from './layouts/PublicLayout.jsx'
import RootLayout from './layouts/RootLayout.jsx'
import AdminAuditLogsPage from './pages/admin/AdminAuditLogsPage.jsx'
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx'
import AdminReportsPage from './pages/admin/AdminReportsPage.jsx'
import AdminReviewsPage from './pages/admin/AdminReviewsPage.jsx'
import AdminUsersPage from './pages/admin/AdminUsersPage.jsx'
import AppHomePage from './pages/AppHomePage.jsx'
import DiscoveryPage from './pages/DiscoveryPage.jsx'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import MessagesPage from './pages/MessagesPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import NotificationsPage from './pages/NotificationsPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import PublicProfilePage from './pages/PublicProfilePage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import ReviewsPage from './pages/ReviewsPage.jsx'
import SessionsPage from './pages/SessionsPage.jsx'
import SkillsPage from './pages/SkillsPage.jsx'
import AdminRoute from './routes/AdminRoute.jsx'
import ProtectedRoute from './routes/ProtectedRoute.jsx'
import PublicOnlyRoute from './routes/PublicOnlyRoute.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />

          <Route element={<PublicOnlyRoute />}>
            <Route element={<AuthLayout />}>
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="app" element={<AppHomePage />} />
            <Route path="app/discovery" element={<DiscoveryPage />} />
            <Route path="app/messages" element={<MessagesPage />} />
            <Route path="app/notifications" element={<NotificationsPage />} />
            <Route path="app/profile" element={<ProfilePage />} />
            <Route path="app/reviews" element={<ReviewsPage />} />
            <Route path="app/sessions" element={<SessionsPage />} />
            <Route path="app/skills" element={<SkillsPage />} />
            <Route path="app/users/:username" element={<PublicProfilePage />} />
            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="app/admin" element={<AdminDashboardPage />} />
                <Route path="app/admin/users" element={<AdminUsersPage />} />
                <Route path="app/admin/reviews" element={<AdminReviewsPage />} />
                <Route path="app/admin/reports" element={<AdminReportsPage />} />
                <Route path="app/admin/audit-logs" element={<AdminAuditLogsPage />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
