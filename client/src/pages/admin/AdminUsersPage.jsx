import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../components/common/PageHeader.jsx'
import AdminActionDialog from '../../components/admin/AdminActionDialog.jsx'
import AdminTable from '../../components/admin/AdminTable.jsx'
import Alert from '../../components/ui/Alert.jsx'
import Badge from '../../components/ui/Badge.jsx'
import Button from '../../components/ui/Button.jsx'
import Input from '../../components/ui/Input.jsx'
import Modal from '../../components/ui/Modal.jsx'
import Pagination from '../../components/discovery/Pagination.jsx'
import Select from '../../components/ui/Select.jsx'
import Spinner from '../../components/ui/Spinner.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { adminService } from '../../services/index.js'
import {
  buildRestorePayload,
  buildSuspendPayload,
  enumLabel,
  formatAdminError,
  formatReason,
  formatTimestamp,
  toneForStatus,
  USER_ROLE_OPTIONS,
  USER_SORT_OPTIONS,
  USER_STATUS_OPTIONS
} from '../../utils/admin.js'
import { formatAverage } from '../../utils/reviews.js'

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const [params, setParams] = useSearchParams()
  const search = params.get('search') || ''
  const role = params.get('role') || ''
  const status = params.get('status') || ''
  const sort = params.get('sort') || 'newest'
  const page = params.get('page') || '1'

  const [searchInput, setSearchInput] = useState(search)
  const [users, setUsers] = useState([])
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

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminService.listUsers({ search, role, status, sort, page })
      setUsers(Array.isArray(data?.users) ? data.users : [])
      setPagination(data?.pagination || null)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setLoading(false)
    }
  }, [page, role, search, sort, status])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    setSearchInput(search)
  }, [search])

  useEffect(() => {
    if (searchInput === search) return undefined
    const timer = setTimeout(() => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          if (searchInput.trim()) next.set('search', searchInput.trim())
          else next.delete('search')
          next.delete('page')
          return next
        },
        { replace: true }
      )
    }, 300)
    return () => clearTimeout(timer)
  }, [search, searchInput, setParams])

  function updateFilter(key, value) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value) next.set(key, value)
        else next.delete(key)
        next.delete('page')
        return next
      },
      { replace: true }
    )
  }

  async function openDetail(userId) {
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    try {
      const data = await adminService.getUser(userId)
      setDetail(data?.user || null)
    } catch (requestError) {
      setDetailError(requestError)
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleAction(reason) {
    if (!action) return
    setActionLoading(true)
    setActionError(null)
    try {
      const payload =
        action.type === 'suspend' ? buildSuspendPayload(reason) : buildRestorePayload(reason)
      const request =
        action.type === 'suspend'
          ? adminService.suspendUser(action.user.id, payload.reason)
          : adminService.restoreUser(action.user.id, payload.reason)
      const data = await request
      setNotice(`${data?.user?.name || action.user.name} ${action.type === 'suspend' ? 'suspended' : 'restored'}.`)
      setAction(null)
      if (detail?.id === action.user.id) setDetail(data?.user || null)
      await loadUsers()
    } catch (requestError) {
      setActionError(requestError)
    } finally {
      setActionLoading(false)
    }
  }

  const columns = [
    {
      key: 'member',
      label: 'Member',
      render: (user) => (
        <div>
          <p className="font-medium text-ink-900">{user.name}</p>
          <p className="text-xs text-ink-500">@{user.username}</p>
        </div>
      )
    },
    {
      key: 'email',
      label: 'Email',
      render: (user) => <span className="break-all">{user.email || '—'}</span>
    },
    {
      key: 'role',
      label: 'Role',
      render: (user) => (
        <Badge tone={toneForStatus(user.role)}>{enumLabel(user.role)}</Badge>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (user) => (
        <Badge tone={toneForStatus(user.accountStatus)}>{enumLabel(user.accountStatus)}</Badge>
      )
    },
    {
      key: 'createdAt',
      label: 'Joined',
      render: (user) => formatTimestamp(user.createdAt)
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (user) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => openDetail(user.id)}>
            Details
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={user.id === currentUser?.id}
            onClick={() => {
              setActionError(null)
              setAction({
                type: user.accountStatus === 'suspended' ? 'restore' : 'suspend',
                user
              })
            }}
          >
            {user.accountStatus === 'suspended' ? 'Restore' : 'Suspend'}
          </Button>
        </div>
      )
    }
  ]

  return (
    <div className="animate-rise space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="User management"
        description="Search members and manage account status. Every action is recorded in the audit log."
      />

      {notice && <Alert variant="success">{notice}</Alert>}
      {error && (
        <Alert variant="error" title="Could not load users">
          {formatAdminError(error)}
        </Alert>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Search"
          placeholder="Name, username or email"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <Select
          label="Role"
          value={role}
          options={USER_ROLE_OPTIONS}
          placeholder="All roles"
          onChange={(event) => updateFilter('role', event.target.value)}
        />
        <Select
          label="Status"
          value={status}
          options={USER_STATUS_OPTIONS}
          placeholder="All statuses"
          onChange={(event) => updateFilter('status', event.target.value)}
        />
        <Select
          label="Sort"
          value={sort}
          options={USER_SORT_OPTIONS}
          onChange={(event) => updateFilter('sort', event.target.value)}
        />
      </section>

      {loading ? (
        <div className="grid h-64 place-items-center rounded-card border border-ink-200/80 bg-white shadow-soft">
          <Spinner label="Loading users" />
        </div>
      ) : (
        <>
          <AdminTable
            caption="Platform users"
            columns={columns}
            rows={users}
            emptyTitle="No users found"
            emptyDescription="Try a different search or clear the active filters."
          />
          <Pagination pagination={pagination} onPageChange={(value) => updateFilter('page', String(value))} disabled={loading} />
        </>
      )}

      <Modal
        open={Boolean(detail || detailLoading || detailError)}
        title="User details"
        description="Profile and reputation data returned by the admin API."
        size="md"
        onClose={() => {
          setDetail(null)
          setDetailError(null)
        }}
      >
        {detailLoading ? (
          <div className="grid h-40 place-items-center">
            <Spinner label="Loading user details" />
          </div>
        ) : detailError ? (
          <Alert variant="error" title="User unavailable">
            {formatAdminError(detailError)}
          </Alert>
        ) : detail ? (
          <div className="space-y-5">
            <dl className="divide-y divide-ink-100 text-sm">
              {[
                ['Name', detail.name],
                ['Username', detail.username ? `@${detail.username}` : '—'],
                ['Email', detail.email],
                ['Role', enumLabel(detail.role)],
                ['Account status', enumLabel(detail.accountStatus)],
                ['Joined', formatTimestamp(detail.createdAt)]
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-ink-500">{label}</dt>
                  <dd className="break-all text-right text-ink-900">{value || '—'}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t border-ink-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Reputation</p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div><dt className="text-xs text-ink-500">Reviews</dt><dd>{detail.reputation?.totalReviews ?? 0}</dd></div>
                <div><dt className="text-xs text-ink-500">Average</dt><dd>{formatAverage(detail.reputation?.averageOverallRating)}</dd></div>
                <div><dt className="text-xs text-ink-500">Score</dt><dd>{formatAverage(detail.reputation?.score)}</dd></div>
                <div><dt className="text-xs text-ink-500">Completed</dt><dd>{detail.reputation?.completedExchanges ?? 0}</dd></div>
              </dl>
            </div>
            {(detail.suspension?.reason || detail.suspension?.suspendedAt) && (
              <div className="border-t border-ink-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Suspension</p>
                <dl className="mt-2 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-4"><dt className="text-ink-500">Reason</dt><dd className="text-right">{formatReason(detail.suspension.reason)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-ink-500">Suspended</dt><dd className="text-right">{formatTimestamp(detail.suspension.suspendedAt)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-ink-500">Restored</dt><dd className="text-right">{formatTimestamp(detail.suspension.restoredAt)}</dd></div>
                </dl>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <AdminActionDialog
        open={Boolean(action)}
        title={action?.type === 'restore' ? 'Restore user account' : 'Suspend user account'}
        description={
          action
            ? `${action.user.name} will be ${action.type === 'restore' ? 'restored to active status' : 'suspended and unable to sign in'}.`
            : ''
        }
        confirmLabel={action?.type === 'restore' ? 'Restore user' : 'Suspend user'}
        confirmVariant={action?.type === 'restore' ? 'primary' : 'danger'}
        loading={actionLoading}
        error={actionError ? formatAdminError(actionError) : ''}
        reasonConfig={
          action?.type === 'restore'
            ? { label: 'Restoration reason', required: false, max: 500 }
            : { label: 'Suspension reason', required: true, min: 3, max: 500 }
        }
        onConfirm={handleAction}
        onCancel={() => {
          setAction(null)
          setActionError(null)
        }}
      />
    </div>
  )
}
