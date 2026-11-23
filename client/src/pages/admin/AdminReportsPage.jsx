import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../components/common/PageHeader.jsx'
import AdminActionDialog from '../../components/admin/AdminActionDialog.jsx'
import AdminTable from '../../components/admin/AdminTable.jsx'
import Alert from '../../components/ui/Alert.jsx'
import Badge from '../../components/ui/Badge.jsx'
import Button from '../../components/ui/Button.jsx'
import Modal from '../../components/ui/Modal.jsx'
import Pagination from '../../components/discovery/Pagination.jsx'
import Select from '../../components/ui/Select.jsx'
import Spinner from '../../components/ui/Spinner.jsx'
import { adminService } from '../../services/index.js'
import {
  buildReportDecisionPayload,
  enumLabel,
  formatAdminError,
  formatReason,
  formatTimestamp,
  REPORT_REASON_OPTIONS,
  REPORT_STATUS_OPTIONS,
  toneForStatus,
  userLabel
} from '../../utils/admin.js'

export default function AdminReportsPage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || ''
  const reason = params.get('reason') || ''
  const page = params.get('page') || '1'

  const [reports, setReports] = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')

  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(null)

  const [action, setAction] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState(null)

  const loadReports = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminService.listReports({ status, reason, page })
      setReports(Array.isArray(data?.reports) ? data.reports : [])
      setPagination(data?.pagination || null)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setLoading(false)
    }
  }, [page, reason, status])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  function updateFilter(key, value) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value) next.set(key, value)
        else next.delete(key)
        if (key !== 'page') next.delete('page')
        return next
      },
      { replace: true }
    )
  }

  async function openDetail(reportId) {
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    try {
      const data = await adminService.getReport(reportId)
      setDetail(data?.report || null)
    } catch (requestError) {
      setDetailError(requestError)
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleAction(reasonValue) {
    if (!action) return
    setActionLoading(true)
    setActionError(null)
    try {
      const payload = buildReportDecisionPayload(action.type, reasonValue)
      const data = await adminService.decideReport(action.report.id, payload.action, payload.reason)
      setNotice(`Report ${payload.action}.`)
      setAction(null)
      if (detail?.id === action.report.id) setDetail(data?.report || null)
      await loadReports()
    } catch (requestError) {
      setActionError(requestError)
    } finally {
      setActionLoading(false)
    }
  }

  const columns = [
    {
      key: 'report',
      label: 'Report',
      render: (report) => (
        <div className="max-w-sm">
          <p className="font-medium text-ink-900">{enumLabel(report.reason)}</p>
          <p className="mt-1 line-clamp-2 text-xs text-ink-500">{formatReason(report.details)}</p>
        </div>
      )
    },
    { key: 'reporter', label: 'Reporter', render: (report) => userLabel(report.reporter) },
    {
      key: 'review',
      label: 'Review',
      render: (report) => (
        <div className="text-xs">
          <p className="text-ink-700">{report.review ? `${report.review.overallRating}/5` : '—'}</p>
          {report.review && (
            <Badge tone={toneForStatus(report.review.moderationStatus)}>
              {enumLabel(report.review.moderationStatus)}
            </Badge>
          )}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (report) => <Badge tone={toneForStatus(report.status)}>{enumLabel(report.status)}</Badge>
    },
    { key: 'createdAt', label: 'Created', render: (report) => formatTimestamp(report.createdAt) },
    {
      key: 'actions',
      label: 'Actions',
      render: (report) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => openDetail(report.id)}>
            Details
          </Button>
          {report.status === 'pending' && (
            <>
              {['resolved', 'dismissed', 'escalated'].map((type) => (
                <Button
                  key={type}
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setActionError(null)
                    setAction({ type, report })
                  }}
                >
                  {enumLabel(type)}
                </Button>
              ))}
            </>
          )}
        </div>
      )
    }
  ]

  return (
    <div className="animate-rise space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Report management"
        description="Decide only on pending reports. Decisions, reasons and moderators are recorded in the audit log."
      />

      {notice && <Alert variant="success">{notice}</Alert>}
      {error && (
        <Alert variant="error" title="Could not load reports">
          {formatAdminError(error)}
        </Alert>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Status"
          value={status}
          options={REPORT_STATUS_OPTIONS}
          placeholder="All statuses"
          onChange={(event) => updateFilter('status', event.target.value)}
        />
        <Select
          label="Reason"
          value={reason}
          options={REPORT_REASON_OPTIONS}
          placeholder="All reasons"
          onChange={(event) => updateFilter('reason', event.target.value)}
        />
      </section>

      {loading ? (
        <div className="grid h-64 place-items-center rounded-card border border-ink-200/80 bg-white shadow-soft">
          <Spinner label="Loading reports" />
        </div>
      ) : (
        <>
          <AdminTable
            caption="Submitted review reports"
            columns={columns}
            rows={reports}
            emptyTitle="No reports found"
            emptyDescription="No submitted reports match the selected filters."
          />
          <Pagination pagination={pagination} onPageChange={(value) => updateFilter('page', String(value))} disabled={loading} />
        </>
      )}

      <Modal
        open={Boolean(detail || detailLoading || detailError)}
        title="Report details"
        description="Report data returned by the admin API."
        onClose={() => {
          setDetail(null)
          setDetailError(null)
        }}
      >
        {detailLoading ? (
          <div className="grid h-40 place-items-center">
            <Spinner label="Loading report" />
          </div>
        ) : detailError ? (
          <Alert variant="error" title="Report unavailable">
            {formatAdminError(detailError)}
          </Alert>
        ) : detail ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={toneForStatus(detail.status)}>{enumLabel(detail.status)}</Badge>
              <Badge tone="neutral">{enumLabel(detail.reason)}</Badge>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-7 text-ink-700">{formatReason(detail.details)}</p>
            <dl className="divide-y divide-ink-100 text-sm">
              <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-500">Reporter</dt><dd className="text-right">{userLabel(detail.reporter)}</dd></div>
              <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-500">Submitted</dt><dd className="text-right">{formatTimestamp(detail.createdAt)}</dd></div>
              <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-500">Updated</dt><dd className="text-right">{formatTimestamp(detail.updatedAt)}</dd></div>
            </dl>
            {detail.review && (
              <div className="rounded-xl border border-ink-100 bg-ivory-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Reported review</p>
                <p className="mt-2 text-sm text-ink-700">{detail.review.comment}</p>
                <p className="mt-2 text-xs text-ink-500">
                  Overall {detail.review.overallRating}/5 · Teaching {detail.review.teachingRating}/5 · Learning{' '}
                  {detail.review.learningRating}/5 · {enumLabel(detail.review.moderationStatus)}
                </p>
              </div>
            )}
            {detail.resolution?.action && (
              <div className="border-t border-ink-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Resolution</p>
                <dl className="mt-2 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-4"><dt className="text-ink-500">Action</dt><dd>{enumLabel(detail.resolution.action)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-ink-500">Reason</dt><dd className="text-right">{formatReason(detail.resolution.reason)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-ink-500">Resolved</dt><dd>{formatTimestamp(detail.resolution.resolvedAt)}</dd></div>
                </dl>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <AdminActionDialog
        open={Boolean(action)}
        title={`${action ? enumLabel(action.type) : 'Decide'} report`}
        description={action ? `This will mark the report as ${action.type}.` : ''}
        confirmLabel={action ? enumLabel(action.type) : 'Decide'}
        confirmVariant="primary"
        loading={actionLoading}
        error={actionError ? formatAdminError(actionError) : ''}
        reasonConfig={{ label: 'Decision reason', required: true, min: 3, max: 500 }}
        onConfirm={handleAction}
        onCancel={() => {
          setAction(null)
          setActionError(null)
        }}
      />
    </div>
  )
}
