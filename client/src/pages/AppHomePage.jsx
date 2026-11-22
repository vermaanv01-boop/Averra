import { Link } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import PageHeader from '../components/common/PageHeader.jsx'
import { buttonStyles } from '../components/ui/Button.jsx'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../components/ui/Card.jsx'
import { useAuth } from '../hooks/useAuth.js'

export default function AppHomePage() {
  const { user } = useAuth()
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there'

  const details = [
    { label: 'Name', value: user?.name || '—' },
    { label: 'Username', value: user?.username ? `@${user.username}` : '—' },
    { label: 'Email', value: user?.email || '—' },
    { label: 'Role', value: user?.role || '—' },
    { label: 'Account status', value: user?.accountStatus || '—' }
  ]

  return (
    <div className="animate-rise space-y-10">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back, ${firstName}.`}
        description="Keep your profile current and manage the skills you teach and want to learn."
        actions={
          <>
            <Link to="/app/profile" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
              View profile
            </Link>
            <Link to="/app/skills" className={buttonStyles({ size: 'sm' })}>
              Manage skills
            </Link>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Details returned by the authenticated profile endpoint.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-ink-100 text-sm">
              {details.map((detail) => (
                <div key={detail.label} className="flex items-start justify-between gap-6 py-3 first:pt-0 last:pb-0">
                  <dt className="text-ink-500">{detail.label}</dt>
                  <dd className="break-words text-right text-ink-900">{detail.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Foundation ready</CardTitle>
            <CardDescription>The core pieces are in place for the next phase.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4 text-sm">
              {['Authenticated session', 'Protected application routes', 'API-backed profile retrieval'].map(
                (item) => (
                  <li key={item} className="flex items-center gap-3 text-ink-700">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-lavender-200 bg-lavender-50 text-lavender-700">
                      <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    {item}
                  </li>
                )
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
