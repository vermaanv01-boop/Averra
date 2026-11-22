import { useEffect, useState } from 'react'
import { CalendarDays, MapPin } from 'lucide-react'
import Avatar from '../ui/Avatar.jsx'
import Badge from '../ui/Badge.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card.jsx'
import { formatLabel } from '../../utils/constants.js'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}

export default function ProfileDetails({ user }) {
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = user?.profileImage && !imageFailed

  useEffect(() => {
    setImageFailed(false)
  }, [user?.profileImage])
  const reputation = user?.reputation

  const details = [
    { label: 'Username', value: user?.username ? `@${user.username}` : '—' },
    { label: 'Email', value: user?.email || '—' },
    { label: 'Location', value: user?.location || '—' },
    { label: 'Role', value: formatLabel(user?.role) || '—' },
    { label: 'Member since', value: formatDate(user?.createdAt) }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start gap-4">
          {showImage ? (
            <img
              src={user.profileImage}
              alt={`${user.name || 'Your'} profile`}
              className="h-14 w-14 shrink-0 rounded-full border border-ink-200 bg-ivory-100 object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <Avatar name={user?.name} size="lg" />
          )}
          <div className="min-w-0">
            <p className="truncate text-lg text-ink-900">{user?.name || 'Your name'}</p>
            <p className="truncate text-sm text-ink-500">@{user?.username || 'username'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone={user?.accountStatus === 'suspended' ? 'warning' : 'success'}>
                {formatLabel(user?.accountStatus) || 'Active'}
              </Badge>
              {user?.bio && <Badge tone="lavender">Has a bio</Badge>}
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">About</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-700">
            {user?.bio || 'No bio added yet.'}
          </p>
        </div>

        <dl className="divide-y divide-ink-100 text-sm">
          {details.map((detail) => (
            <div key={detail.label} className="flex items-start justify-between gap-6 py-3 first:pt-0">
              <dt className="flex items-center gap-2 text-ink-500">
                {detail.label === 'Location' && <MapPin className="h-3.5 w-3.5" aria-hidden="true" />}
                {detail.label === 'Member since' && (
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {detail.label}
              </dt>
              <dd className="break-words text-right text-ink-900">{detail.value}</dd>
            </div>
          ))}
        </dl>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Interests</p>
          {user?.interests?.length ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {user.interests.map((interest, index) => (
                <li key={`${interest}-${index}`}>
                  <Badge>{interest}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-500">No interests added yet.</p>
          )}
        </div>

        {reputation && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
              Reputation
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: 'Score', value: reputation.score ?? '—' },
                { label: 'Reviews', value: reputation.totalReviews ?? 0 },
                { label: 'Exchanges', value: reputation.completedExchanges ?? 0 }
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-ink-100 bg-ivory-50 px-3 py-2">
                  <dt className="text-xs text-ink-500">{item.label}</dt>
                  <dd className="mt-1 text-sm font-medium text-ink-900">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
