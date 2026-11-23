import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../components/common/PageHeader.jsx'
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
  AUDIT_ACTION_OPTIONS,
  AUDIT_TARGET_TYPE_OPTIONS,
  auditActorName,
  auditTargetLabel,
  enumLabel,
  formatAdminError,
  formatReason,
  formatTimestamp,
  metadataEntries
} from '../../utils/admin.js'

export default function AdminAuditLogsPage() {
  const [params, setParams] = useSearchParams()
  const action = params.get('action') || ''
  const targetType = params.get('targetType') || ''
  const page = params.get('page') || '1'

  const [logs, setLogs] = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [detail, setDetail] = useState(null)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminService.listAuditLogs({ action, targetType, page })
      setLogs(Array.isArray(data?.auditLogs) ? data.auditLogs : [])
      setPagination(data?.pagination || null)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setLoading(false)
    }
  }, [action, page, targetType])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

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

  const columns = [
    { key: 'createdAt', label: 'When', render: (log) => formatTimestamp(log.createdAt) },
    { key: 'actor', label: 'Actor', render: (log) => auditActorName(log.actor) },
    {
      key: 'action',
      label: 'Action',
      render: (log) => <Badge tone="lavender">{enumLabel(log.action)}</Badge>
    },
    { key: 'target', label: 'Target', render: (log) => auditTargetLabel(log.target) },
    {
      key: 'reason',
      label: 'Reason',
      render: (log) => <span className="line-clamp-2 text-xs">{formatReason(log.reason)}</span>
    },
    {
      key: 'actions',
      label: 'Details',
      render: (log) => (
        <Button size="sm" variant="ghost" onClick={() => setDetail(log)}>
          View
        </Button>
      )
    }
  ]

  return (
    <div className="animate-rise space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Audit logs"
        description="Read-only record of administrative actions. Audit records cannot be edited or deleted."
      />

      {error && (
        <Alert variant="error" title="Could not load audit logs">
          {formatAdminError(error)}
        </Alert>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Action"
          value={action}
          options={AUDIT_ACTION_OPTIONS}
          placeholder="All actions"
          onChange={(event) => updateFilter('action', event.target.value)}
        />
        <Select
          label="Target type"
          value={targetType}
          options={AUDIT_TARGET_TYPE_OPTIONS}
          placeholder="All targets"
          onChange={(event) => updateFilter('targetType', event.target.value)}
        />
      </section>

      {loading ? (
        <div className="grid h-64 place-items-center rounded-card border border-ink-200/80 bg-white shadow-soft">
          <Spinner label="Loading audit logs" />
        </div>
      ) : (
        <>
          <AdminTable
            caption="Administrative audit log"
            columns={columns}
            rows={logs}
            emptyTitle="No audit records"
            emptyDescription="No administrative actions match the selected filters."
          />
          <Pagination pagination={pagination} onPageChange={(value) => updateFilter('page', String(value))} disabled={loading} />
        </>
      )}

      <Modal
        open={Boolean(detail)}
        title="Audit record"
        description="Read-only administrative audit entry."
        onClose={() => setDetail(null)}
      >
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="lavender">{enumLabel(detail.action)}</Badge>
              <Badge tone="neutral">{enumLabel(detail.target?.type)}</Badge>
            </div>
            <dl className="divide-y divide-ink-100 text-sm">
              <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-500">Actor</dt><dd className="text-right">{auditActorName(detail.actor)}</dd></div>
              <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-500">Target</dt><dd className="text-right">{auditTargetLabel(detail.target)}</dd></div>
              <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-500">Created</dt><dd className="text-right">{formatTimestamp(detail.createdAt)}</dd></div>
              <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-500">Updated</dt><dd className="text-right">{formatTimestamp(detail.updatedAt)}</dd></div>
              <div className="py-2.5"><dt className="text-ink-500">Reason</dt><dd className="mt-1 whitespace-pre-wrap">{formatReason(detail.reason)}</dd></div>
            </dl>
            {metadataEntries(detail.metadata).length > 0 && (
              <div className="border-t border-ink-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Metadata</p>
                <dl className="mt-2 space-y-1.5 text-sm">
                  {metadataEntries(detail.metadata).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-4">
                      <dt className="text-ink-500">{key}</dt>
                      <dd className="break-all text-right text-ink-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
