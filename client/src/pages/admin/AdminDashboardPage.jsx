import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader.jsx'
import Alert from '../components/ui/Alert.jsx'
import { buttonStyles } from '../components/ui/Button.jsx'
import Spinner from '../components/ui/Spinner.jsx'
import { adminService } from '../services/index.js'
import {
  auditActorName,
  auditTargetLabel,
  enumLabel,
  formatAdminError,
  formatTimestamp
} from '../utils/admin.js'

const QUICK_LINKS = [
  { to: '/app/admin/users', label: 'Users' },
  { to: '/app/admin/reviews', label: 'Reviews' },
  { to: '/app/admin/reports', label: 'Reports' },
  { to: '/app/admin/audit-logs', label: 'Audit logs' }
]

function MetricGroup({ title, description, values }) {
  return (
    <section className="border-t border-ink-100 pt-5 first:border-0 first:pt-0">
      <div>
        <h3 className="text-lg text-ink-900">{title}</h3>
        <p className="mt-1 text-xs text-ink-500">{description}</p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {Object.entries(values || {}).map(([key, value]) => (
          <div key={key} className="rounded-lg bg-ivory-50/80 px-3 py-2.5">
            <dt className="text-xs text-ink-500">{enumLabel(key)}</dt>
            <dd className="mt-1 text-lg text-ink-900">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export default function AdminDashboardPage() {
  const [statistics, setStatistics] = useState(null)
  const [recentLogs, setRecentLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    Promise.all([
      adminService.statistics(),
      adminService.listAuditLogs({ limit: 5 })
    ])
      .then(([statsData, logsData]) => {
        if (!active) return
        setStatistics(statsData)
        setRecentLogs(Array.isArray(logsData?.auditLogs) ? logsData.auditLogs : [])
      })
      .catch((requestError) => {
        if (active) setError(requestError)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="animate-rise space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Platform overview"
        description="Counts come directly from the admin statistics API. Recent administrative activity comes from the audit log."
        actions={QUICK_LINKS.map((link) => (
          <Link key={link.to} to={link.to} className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
            {link.label}
          </Link>
        ))}
      />

      {error && (
        <Alert variant="error" title="Admin data unavailable">
          {formatAdminError(error)}
        </Alert>
      )}

      {loading ? (
        <div className="grid h-64 place-items-center rounded-card border border-ink-200/80 bg-white shadow-soft">
          <Spinner label="Loading platform statistics" />
        </div>
      ) : (
        statistics && (
          <section className="space-y-6 rounded-card border border-ink-200/80 bg-white p-5 shadow-soft sm:p-6">
            <MetricGroup title="Members" values={statistics.users} />
            <MetricGroup title="Skills" values={statistics.skills} />
            <MetricGroup title="Exchange requests" values={statistics.exchangeRequests} />
            <MetricGroup title="Sessions" values={statistics.sessions} />
            <MetricGroup title="Messages" values={statistics.messages} />
            <MetricGroup title="Reviews" values={statistics.reviews} />
            <MetricGroup title="Reports" values={statistics.reports} />
          </section>
        )
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg text-ink-900">Recent administrative activity</h3>
            <p className="mt-1 text-xs text-ink-500">The five newest audit records.</p>
          </div>
          <Link to="/app/admin/audit-logs" className="text-xs text-lavender-700 hover:text-lavender-800">
            View all audit logs
          </Link>
        </div>
        {recentLogs.length === 0 && !loading ? (
          <Alert variant="info">No administrative actions have been recorded.</Alert>
        ) : (
          <ul className="divide-y divide-ink-100 rounded-card border border-ink-200/80 bg-white shadow-soft">
            {recentLogs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm text-ink-900">{enumLabel(log.action)}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {auditActorName(log.actor)} · {auditTargetLabel(log.target)}
                  </p>
                </div>
                <span className="text-xs text-ink-500">{formatTimestamp(log.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
