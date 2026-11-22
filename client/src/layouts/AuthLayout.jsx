import { Outlet } from 'react-router-dom'
import Brand from '../components/common/Brand.jsx'
import { APP_NAME } from '../utils/config.js'

export default function AuthLayout() {
  return (
    <div className="grid flex-1 lg:grid-cols-[1fr_minmax(0,480px)]">
      <div className="hidden border-r border-ink-200/70 bg-ivory-100 px-10 py-14 lg:flex lg:flex-col lg:justify-between">
        <Brand />
        <div className="max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lavender-700">
            Skill exchange
          </p>
          <h1 className="mt-5 text-balance text-4xl leading-[1.12] text-ink-900">
            A calmer way to trade what you know.
          </h1>
          <p className="mt-5 text-sm leading-7 text-ink-600">
            Find the right people, agree on a fair exchange, and keep every session in one clear place.
          </p>
        </div>
        <p className="text-xs tracking-wide text-ink-500">{APP_NAME} · Thoughtful by design</p>
      </div>
      <div className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm animate-rise">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
