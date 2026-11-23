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
import Stars from '../../components/reviews/Stars.jsx'
import { adminService } from '../../services/index.js'
import {
  buildModeratePayload,
  enumLabel,
  formatAdminError,
  formatReason,
  formatTimestamp,
  participantLabel,
  REVIEW_STATUS_OPTIONS,
  toneForStatus
} from '../../utils/admin.js'

export default function AdminReviewsPage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || ''
  const page = params.get('page') || '1'

  const [reviews, setReviews] = useState([])
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

  const loadReviews = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminService.listReviews({ status, page })
      setReviews(Array.isArray(data?.reviews) ? data.reviews : [])
      setPagination(data?.pagination || null)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => {
    loadReviews()
  }, [loadReviews])

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

  async function openDetail(reviewId) {
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    try {
      const data = await adminService.getReview(reviewId)
      setDetail(data?.review || null)
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
      const payload = buildModeratePayload(action.type, reason)
      const data = await adminService.moderateReview(action.review.id, payload.status, payload.reason)
      setNotice(`Review ${payload.status === 'hidden' ? 'hidden' : 'restored'}.`)
      setAction(null)
      if (detail?.id === action.review.id) setDetail(data?.review || null)
      await loadReviews()
    } catch (requestError) {
      setActionError(requestError)
    } finally {
      setActionLoading(false)
    }
  }

  const columns = [
    {
      key: 'review',
      label: 'Review',
      render: (review) => (
        <div className="max-w-md">
          <Stars rating={review.overallRating} size="sm" />
          <p className="mt-1 line-clamp-2 text-sm text-ink-700">{review.comment}</p>
          <p className="mt-1 text-xs text-ink-500">
            Teaching {review.teachingRating}/5 · Learning {review.learningRating}/5
          </p>
        </div>
      )
    },
    {
      key: 'participants',
      label: 'Participants',
      render: (review) => (
        <div className="text-xs">
          <p className="text-ink-700">By {participantLabel(review.reviewer)}</p>
          <p className="mt-0.5 text-ink-500">For {participantLabel(review.reviewee)}</p>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (review) => (
        <Badge tone={toneForStatus(review.moderationStatus)}>{enumLabel(review.moderationStatus)}</Badge>
      )
    },
    { key: 'reportCount', label: 'Reports', render: (review) => review.reportCount ?? 0 },
    { key: 'createdAt', label: 'Created', render: (review) => formatTimestamp(review.createdAt) },
    {
      key: 'actions',
      label: 'Actions',
      render: (review) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => openDetail(review.id)}>
            Details
          </Button>
          <Button
            size="sm"
            variant={review.moderationStatus === 'hidden' ? 'secondary' : 'ghost'}
            onClick={() => {
              setActionError(null)
              setAction({
                type: review.moderationStatus === 'hidden' ? 'visible' : 'hidden',
                review
              })
            }}
          >
            {review.moderationStatus === 'hidden' ? 'Restore' : 'Hide'}
          </Button>
        </div>
      )
    }
  ]

  return (
    <div className="animate-rise space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Review moderation"
        description="The default list is the backend moderation queue: flagged reviews and reviews with reports."
        actions={
          <Select
            label="Status filter"
            className="w-full sm:w-56"
            value={status}
            options={REVIEW_STATUS_OPTIONS}
            placeholder="Moderation queue"
            onChange={(event) => updateFilter('status', event.target.value)}
          />
        }
      />

      {notice && <Alert variant="success">{notice}</Alert>}
      {error && (
        <Alert variant="error" title="Could not load reviews">
          {formatAdminError(error)}
        </Alert>
      )}

      {loading ? (
        <div className="grid h-64 place-items-center rounded-card border border-ink-200/80 bg-white shadow-soft">
          <Spinner label="Loading reviews" />
        </div>
      ) : (
        <>
          <AdminTable
            caption="Reviews under moderation"
            columns={columns}
            rows={reviews}
            emptyTitle="No reviews to moderate"
            emptyDescription="No visible reviews match the selected moderation filter."
          />
          <Pagination pagination={pagination} onPageChange={(value) => updateFilter('page', String(value))} disabled={loading} />
        </>
      )}

      <Modal
        open={Boolean(detail || detailLoading || detailError)}
        title="Review details"
        description="Full review data returned by the admin API."
        onClose={() => {
          setDetail(null)
          setDetailError(null)
        }}
      >
        {detailLoading ? (
          <div className="grid h-40 place-items-center">
            <Spinner label="Loading review" />
          </div>
        ) : detailError ? (
          <Alert variant="error" title="Review unavailable">
            {formatAdminError(detailError)}
          </Alert>
        ) : detail ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Stars rating={detail.overallRating} size="lg" />
              <Badge tone={toneForStatus(detail.moderationStatus)}>{enumLabel(detail.moderationStatus)}</Badge>
              <span className="text-xs text-ink-500">{detail.reportCount || 0} reports</span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-7 text-ink-700">{detail.comment}</p>
            <dl className="divide-y divide-ink-100 text-sm">
              <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-500">Reviewer</dt><dd>{participantLabel(detail.reviewer)}</dd></div>
              <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-500">Recipient</dt><dd>{participantLabel(detail.reviewee)}</dd></div>
              <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-500">Teaching</dt><dd>{detail.teachingRating}/5</dd></div>
              <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-500">Learning</dt><dd>{detail.learningRating}/5</dd></div>
              <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-500">Created</dt><dd>{formatTimestamp(detail.createdAt)}</dd></div>
            </dl>
            {detail.moderationHistory?.length > 0 && (
              <div className="border-t border-ink-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Moderation history</p>
                <ul className="mt-2 space-y-2">
                  {detail.moderationHistory.map((entry, index) => (
                    <li key={`${entry.createdAt}-${index}`} className="rounded-lg bg-ivory-50/70 px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-ink-900">{enumLabel(entry.status)}</span>
                        <span className="text-ink-500">{formatTimestamp(entry.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-ink-600">{formatReason(entry.reason)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <AdminActionDialog
        open={Boolean(action)}
        title={action?.type === 'visible' ? 'Restore review' : 'Hide review'}
        description={
          action?.type === 'visible'
            ? 'The review will be visible again and reputation will be recalculated by the backend.'
            : 'The review will be removed from public profiles and reputation.'
        }
        confirmLabel={action?.type === 'visible' ? 'Restore review' : 'Hide review'}
        confirmVariant={action?.type === 'visible' ? 'primary' : 'danger'}
        loading={actionLoading}
        error={actionError ? formatAdminError(actionError) : ''}
        reasonConfig={{ label: 'Moderation reason', required: false, max: 500 }}
        onConfirm={handleAction}
        onCancel={() => {
          setAction(null)
          setActionError(null)
        }}
      />
    </div>
  )
}
