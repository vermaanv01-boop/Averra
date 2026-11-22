import { Outlet } from 'react-router-dom'
import Footer from '../components/common/Footer.jsx'
import AppNavbar from '../components/navigation/AppNavbar.jsx'
import PageContainer from '../components/common/PageContainer.jsx'

export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-ivory-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink-900 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <AppNavbar />
      <main id="main-content" className="flex-1 py-10 sm:py-12">
        <PageContainer>
          <Outlet />
        </PageContainer>
      </main>
      <Footer compact />
    </div>
  )
}
