import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarPlus, RefreshCw } from 'lucide-react'
import PageHeader from '../components/common/PageHeader.jsx'
import Pagination from '../components/discovery/Pagination.jsx'
import ResultsSkeleton from '../components/discovery/ResultsSkeleton.jsx'
import CancelSessionDialog from '../components/sessions/CancelSessionDialog.jsx'
import ScheduleConflictAlert from '../components/sessions/ScheduleConflictAlert.jsx'
import SessionCard from '../components/sessions/SessionCard.jsx'
import SessionConfirmDialog from '../components/sessions/SessionConfirmDialog.jsx'
import SessionDetails from '../components/sessions/SessionDetails.jsx'
import SessionFormDialog from '../components/sessions/SessionFormDialog.jsx'
import Alert from '../components/ui/Alert.jsx'
import Button from '../components/ui/Button.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import useAuth from '../hooks/useAuth.js'
import useDiscoveryRequest from '../hooks/useDiscoveryRequest.js'
import useSessionActions from '../hooks/useSessionActions.js'
import { exchangeRequestService, sessionService } from '../services/index.js'
import { cn } from '../utils/cn.js'
import { formatLabel } from '../utils/constants.js'

const TABS = [
  { id: 'upcoming', label: 'Upcoming', sort: 'upcoming' },
  { id: 'pending', label: 'Pending proposals', sort: 'upcoming' },
  { id: 'past', label: 'Past sessions', sort: 'latest' },
  { id: 'cancelled', label: 'Cancelled', sort: 'latest' }
]

const EMPTY_COPY = {
  upcoming: {
    title: 'No upcoming sessions',
    description: 'Confirmed sessions and accepted new times will appear here.'
  },
  pending: {
    title: 'No pending proposals',
    description: 'Session invitations awaiting a response will appear here.'
  },
  past: {
    title: 'No past sessions',
    description: 'Sessions you mark as complete will appear here.'
  },
  cancelled: {
    title: 'No cancelled sessions',
    description: 'Cancelled sessions stay here for your records.'
  }
}

function listPendingSessions(params) {
  return sessionService.list({ ...params, status: 'pending' })
}

function readValue(searchParams, key, fallback = '') {
  return searchParams.get(key) || fallback
}

export default function SessionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const actions = useSessionActions()
  const [notice, setNotice] = useState('')
  const [pageError, setPageError] = useState(null)
  const [dialogError, setDialogError] = useState(null)
  const [formDialog, setFormDialog] = useState(null)
  const [cancelDialog, setCancelDialog] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [detailSession, setDetailSession] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(null)

  const tab = TABS.some((item) => item.id === readValue(searchParams, 'tab'))
    ? readValue(searchParams, 'tab')
    : 'upcoming'
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const activeTab = TABS.find((item) => item.id === tab)

  const setParams = useCallback(
    (patch, resetPage = true) => {
      const next = new URLSearchParams(searchParams)
      Object.entries(patch).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') next.delete(key)
        else next.set(key, String(value))
      })
      if (resetPage) next.delete('page')
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const sessionParams = useMemo(
    () => ({ page, limit: 8, sort: activeTab.sort }),
    [page, activeTab.sort]
  )
  const acceptedParams = useMemo(
    () => ({ box: 'all', status: 'accepted', limit: 50, sort: 'newest' }),
    []
  )

  const fetchers = useMemo(
    () => ({
      upcoming: sessionService.listUpcoming,
      pending: listPendingSessions,
      past: sessionService.listCompleted,
      cancelled: sessionService.listCancelled
    }),
    []
  )
  const sessionsQuery = useDiscoveryRequest(fetchers[tab], sessionParams, true)
  const acceptedQuery = useDiscoveryRequest(exchangeRequestService.list, acceptedParams, true)

  useEffect(() => {
    setNotice('')
    setPageError(null)
    setDialogError(null)
  }, [tab])

  const loadDetail = useCallback(async (id) => {
    setDetailId(id)
    setDetailSession(null)
    setDetailError(null)
    setDetailLoading(true)
    try {
      const data = await sessionService.getById(id)
      setDetailSession(data?.session || null)
    } catch (error) {
      setDetailError(error)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const closeDetail = useCallback(() => {
    setDetailId(null)
    setDetailSession(null)
    setDetailError(null)
  }, [])

  const finish = useCallback(
    async (message) => {
      setNotice(message)
      setPageError(null)
      sessionsQuery.reload()
      acceptedQuery.reload()
      if (detailId) await loadDetail(detailId)
    },
    [detailId, loadDetail, sessionsQuery.reload, acceptedQuery.reload]
  )

  function clearErrors() {
    setNotice('')
    setPageError(null)
    setDialogError(null)
  }

  function openForm(mode, session = null) {
    clearErrors()
    setFormDialog({ mode, session })
  }

  function openCancel(session) {
    clearErrors()
    setCancelDialog(session)
  }

  function openDecline(session) {
    clearErrors()
    setConfirmDialog({
      kind: 'decline',
      sessionId: session.id,
      title: 'Decline this proposal?',
      description: `The invitation for “${session.title}” will be declined for both participants.`,
      confirmLabel: 'Decline proposal',
      tone: 'danger'
    })
  }

  function openComplete(session) {
    clearErrors()
    setConfirmDialog({
      kind: 'complete',
      sessionId: session.id,
      title: 'Mark this session complete?',
      description: `“${session.title}” will move into your past sessions.`,
      confirmLabel: 'Mark complete',
      tone: 'subtle'
    })
  }

  function respondToProposal(session, proposal, action) {
    clearErrors()
    if (action === 'reject') {
      setConfirmDialog({
        kind: 'rejectReschedule',
        sessionId: session.id,
        proposalId: proposal.id,
        title: 'Reject this new time?',
        description: `The current schedule for “${session.title}” will stay in place.`,
        confirmLabel: 'Reject new time',
        tone: 'danger'
      })
      return
    }
    handleAcceptReschedule(session, proposal)
  }

  async function handleAccept(session) {
    clearErrors()
    const result = await actions.run(() => sessionService.accept(session.id))
    if (result.error) {
      setPageError(result.error)
      return
    }
    await finish('Session confirmed.')
  }

  async function handleAcceptReschedule(session, proposal) {
    clearErrors()
    const result = await actions.run(() =>
      sessionService.acceptReschedule(session.id, proposal.id)
    )
    if (result.error) {
      setPageError(result.error)
      return
    }
    await finish('New time accepted.')
  }

  async function handleFormSubmit(values) {
    if (!formDialog) return false
    const isCreate = formDialog.mode === 'create'
    const result = await actions.run(() =>
      isCreate
        ? sessionService.create(values)
        : sessionService.requestReschedule(formDialog.session.id, values)
    )
    if (result.error) {
      setDialogError(result.error)
      return false
    }
    setFormDialog(null)
    setDialogError(null)
    await finish(isCreate ? 'Session proposal sent.' : 'New time proposed.')
    return true
  }

  async function handleCancelConfirm(reason) {
    if (!cancelDialog) return false
    const result = await actions.run(() => sessionService.cancel(cancelDialog.id, reason))
    if (result.error) {
      setDialogError(result.error)
      return false
    }
    setCancelDialog(null)
    setDialogError(null)
    await finish('Session cancelled.')
    return true
  }

  async function handleConfirmAction() {
    if (!confirmDialog) return
    const { kind, sessionId, proposalId } = confirmDialog
    let operation
    let message

    if (kind === 'decline') {
      operation = () => sessionService.decline(sessionId)
      message = 'Proposal declined.'
    } else if (kind === 'complete') {
      operation = () => sessionService.complete(sessionId)
      message = 'Session marked as complete.'
    } else {
      operation = () => sessionService.rejectReschedule(sessionId, proposalId)
      message = 'New time rejected.'
    }

    const result = await actions.run(operation)
    if (result.error) {
      setDialogError(result.error)
      return
    }
    setConfirmDialog(null)
    setDialogError(null)
    await finish(message)
  }

  const emptyCopy = EMPTY_COPY[tab]
  const acceptedRequests = acceptedQuery.items

  return (
    <div className="animate-rise space-y-8">
      <PageHeader
        eyebrow="Sessions"
        title="Keep every exchange on the calendar"
        description="Propose times, respond to invitations, and manage the sessions attached to your exchanges."
        actions={
          <>
            <Button variant="secondary" size="sm" loading={sessionsQuery.loading} onClick={sessionsQuery.reload}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => openForm('create')}>
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Propose session
            </Button>
          </>
        }
      />

      {notice && <Alert variant="success">{notice}</Alert>}
      {pageError && !formDialog && !cancelDialog && !confirmDialog && (
        <ScheduleConflictAlert error={pageError} />
      )}

      <div
        role="tablist"
        aria-label="Session views"
        className="inline-flex flex-wrap rounded-xl border border-ink-200 bg-white p-1 shadow-soft"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`session-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`session-panel-${item.id}`}
            onClick={() => setParams({ tab: item.id === 'upcoming' ? null : item.id })}
            className={cn(
              'rounded-lg px-4 py-2 text-sm transition-colors',
              tab === item.id
                ? 'bg-ink-900 text-white'
                : 'text-ink-600 hover:bg-ivory-100 hover:text-ink-900'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`session-panel-${tab}`}
        aria-labelledby={`session-tab-${tab}`}
        className="space-y-6"
      >
        {sessionsQuery.error && (
          <Alert
            variant="error"
            title="Could not load sessions"
            action={
              <Button variant="secondary" size="sm" onClick={sessionsQuery.reload}>
                Retry
              </Button>
            }
          >
            {sessionsQuery.error.message}
          </Alert>
        )}

        {sessionsQuery.loading ? (
          <ResultsSkeleton />
        ) : sessionsQuery.error ? null : sessionsQuery.items.length === 0 ? (
          <EmptyState
            title={emptyCopy.title}
            description={emptyCopy.description}
            action={
              tab === 'pending' && acceptedRequests.length === 0 ? (
                <Link
                  to="/app/discovery"
                  className="inline-flex h-9 items-center rounded-lg border border-ink-900 bg-ink-900 px-4 text-sm font-medium text-white transition-colors hover:bg-ink-800"
                >
                  Find exchange partners
                </Link>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => openForm('create')}>
                  Propose session
                </Button>
              )
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {sessionsQuery.items.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                currentUserId={user?.id}
                busy={actions.busy}
                onView={loadDetail}
                onAccept={handleAccept}
                onDecline={openDecline}
                onReschedule={(value) => openForm('reschedule', value)}
                onCancel={openCancel}
                onComplete={openComplete}
                onRespondReschedule={respondToProposal}
              />
            ))}
          </div>
        )}

        <Pagination
          pagination={sessionsQuery.pagination}
          onPageChange={(next) => setParams({ page: next }, false)}
          disabled={sessionsQuery.loading}
        />
      </div>

      <SessionFormDialog
        open={Boolean(formDialog)}
        mode={formDialog?.mode || 'create'}
        session={formDialog?.session || null}
        acceptedRequests={acceptedRequests}
        currentUserId={user?.id}
        submitting={actions.busy}
        serverError={dialogError}
        onClose={() => {
          setFormDialog(null)
          setDialogError(null)
        }}
        onSubmit={handleFormSubmit}
      />

      <CancelSessionDialog
        open={Boolean(cancelDialog)}
        session={cancelDialog}
        submitting={actions.busy}
        serverError={dialogError}
        onClose={() => {
          setCancelDialog(null)
          setDialogError(null)
        }}
        onConfirm={handleCancelConfirm}
      />

      <SessionConfirmDialog
        open={Boolean(confirmDialog)}
        title={confirmDialog?.title || ''}
        description={confirmDialog?.description || ''}
        confirmLabel={confirmDialog?.confirmLabel || 'Confirm'}
        tone={confirmDialog?.tone || 'danger'}
        loading={actions.busy}
        serverError={dialogError}
        onConfirm={handleConfirmAction}
        onCancel={() => {
          setConfirmDialog(null)
          setDialogError(null)
        }}
      />

      <SessionDetails
        open={Boolean(detailId)}
        session={detailSession}
        loading={detailLoading}
        error={detailError}
        currentUserId={user?.id}
        onClose={closeDetail}
      />
    </div>
  )
}
