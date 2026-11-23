import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
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
import Alert from '../components/ui/Alert.jsx'
import Modal from '../components/ui/Modal.jsx'
import Spinner from '../components/ui/Spinner.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { exchangeRequestService } from '../services/index.js'

export default function AppHomePage() {
  const { user } = useAuth()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [requestId, setRequestId] = useState(null)
  const [requestDetail, setRequestDetail] = useState(null)
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestError, setRequestError] = useState(null)

  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there'

  const details = [
    { label: 'Name', value: user?.name || '—' },
    { label: 'Username', value: user?.username ? `@${user.username}` : '—' },
    { label: 'Email', value: user?.email || '—' },
    { label: 'Role', value: user?.role || '—' },
    { label: 'Account status', value: user?.accountStatus || '—' }
  ]

  const requestedRequest = searchParams.get('request')

  useEffect(() => {
    if (!requestedRequest) return
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.delete('request')
        return next
      },
      { replace: true }
    )
    setRequestId(requestedRequest)
    setRequestDetail(null)
    setRequestError(null)
    setRequestLoading(true)
    exchangeRequestService
      .getById(requestedRequest)
      .then((data) => setRequestDetail(data?.exchangeRequest || data?.request || null))
      .catch((error) => setRequestError(error))
      .finally(() => setRequestLoading(false))
  }, [requestedRequest, setSearchParams])

  return (
    <div className="animate-rise space-y-10">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back, ${firstName}.`}
        description="Keep your profile current and manage the skills you teach and want to learn."
        actions={
          <>
            <Link to="/app/discovery" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
              Discover people
            </Link>
            <Link to="/app/profile" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
              View profile
            </Link>
            <Link to="/app/sessions" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
              View sessions
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
            <CardDescription>The core pieces are in place for finding exchange partners.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4 text-sm">
              {[
                'Authenticated session',
                'Protected application routes',
                'API-backed profile and skills',
                'Discovery and matching'
              ].map(
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

      <Modal
        open={Boolean(requestId)}
        title="Exchange request"
        description="The request linked from your notification."
        size="sm"
        onClose={() => setRequestId(null)}
      >
        {requestLoading ? (
          <div className="grid h-24 place-items-center">
            <Spinner label="Loading exchange request" />
          </div>
        ) : requestError ? (
          <Alert variant="error" title="Request unavailable">
            {requestError.message || 'This exchange request is no longer accessible.'}
          </Alert>
        ) : requestDetail ? (
          <dl className="divide-y divide-ink-100 text-sm">
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-ink-500">Status</dt>
              <dd className="text-right text-ink-900">{requestDetail.status || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-ink-500">From</dt>
              <dd className="text-right text-ink-900">{requestDetail.sender?.name || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-ink-500">To</dt>
              <dd className="text-right text-ink-900">{requestDetail.recipient?.name || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-ink-500">Offered skill</dt>
              <dd className="text-right text-ink-900">{requestDetail.offeredSkill?.name || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-ink-500">Requested skill</dt>
              <dd className="text-right text-ink-900">{requestDetail.requestedSkill?.name || '—'}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-ink-600">This exchange request is no longer available.</p>
        )}
      </Modal>
    </div>
  )
}
