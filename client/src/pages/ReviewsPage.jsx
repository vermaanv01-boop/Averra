import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PenLine, Star } from 'lucide-react'
import EmptyState from '../components/common/EmptyState.jsx'
import PageHeader from '../components/common/PageHeader.jsx'
import Pagination from '../components/discovery/Pagination.jsx'
import Alert from '../components/ui/Alert.jsx'
import Button from '../components/ui/Button.jsx'
import Modal from '../components/ui/Modal.jsx'
import Select from '../components/ui/Select.jsx'
import Spinner from '../components/ui/Spinner.jsx'
import ReviewCard from '../components/reviews/ReviewCard.jsx'
import ReviewForm from '../components/reviews/ReviewForm.jsx'
import ReputationSummary from '../components/reviews/ReputationSummary.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { exchangeRequestService, reviewService } from '../services/index.js'
import {
  formatReviewDate,
  formatReviewError,
  isCompletedExchangeForUser,
  isReviewedBy,
  otherParticipant,
  REVIEW_SORT_OPTIONS
} from '../utils/reviews.js'

export default function ReviewsPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const highlightedId = searchParams.get('review')

  const [eligible, setEligible] = useState([])
  const [eligibleLoading, setEligibleLoading] = useState(true)
  const [eligibleError, setEligibleError] = useState(null)
  const [openingId, setOpeningId] = useState(null)

  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('newest')
  const [received, setReceived] = useState([])
  const [pagination, setPagination] = useState(null)
  const [receivedLoading, setReceivedLoading] = useState(true)
  const [receivedError, setReceivedError] = useState(null)

  const [formExchange, setFormExchange] = useState(null)
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')

  const [highlighted, setHighlighted] = useState(null)
  const [highlightError, setHighlightError] = useState(null)

  const loadEligible = useCallback(
    async ({ silent = false } = {}) => {
      if (!user?.id) return
      if (!silent) setEligibleLoading(true)
      setEligibleError(null)
      try {
        const data = await exchangeRequestService.list({
          status: 'completed',
          limit: 50,
          sort: 'newest'
        })
        const completed = (Array.isArray(data?.items) ? data.items : []).filter((item) =>
          isCompletedExchangeForUser(item, user.id)
        )
        const results = await Promise.all(
          completed.map(async (item) => {
            try {
              const reviewData = await reviewService.listForExchange(item.id, { limit: 50 })
              const reviews = Array.isArray(reviewData?.reviews) ? reviewData.reviews : []
              return reviews.some((review) => isReviewedBy(review, user.id)) ? null : item
            } catch (error) {
              if (error?.status === 401 || error?.status === 403) throw error
              return null
            }
          })
        )
        setEligible(results.filter(Boolean))
      } catch (error) {
        setEligibleError(error)
      } finally {
        setEligibleLoading(false)
      }
    },
    [user?.id]
  )

  const loadReceived = useCallback(
    async (targetPage = 1) => {
      if (!user?.id) return
      setReceivedLoading(true)
      setReceivedError(null)
      try {
        const data = await reviewService.listForUser(user.id, {
          page: targetPage,
          limit: 5,
          sort
        })
        setReceived(Array.isArray(data?.reviews) ? data.reviews : [])
        setPagination(data?.pagination || null)
      } catch (error) {
        setReceivedError(error)
      } finally {
        setReceivedLoading(false)
      }
    },
    [sort, user?.id]
  )

  useEffect(() => {
    if (user?.id) loadEligible()
  }, [loadEligible, user?.id])

  useEffect(() => {
    if (user?.id) loadReceived(page)
  }, [loadReceived, page, user?.id])

  useEffect(() => {
    if (!highlightedId || !user?.id) {
      setHighlighted(null)
      setHighlightError(null)
      return undefined
    }

    let active = true
    setHighlighted(null)
    setHighlightError(null)
    reviewService
      .getById(highlightedId)
      .then((data) => {
        if (active) setHighlighted(data)
      })
      .catch((error) => {
        if (active) setHighlightError(error)
      })

    return () => {
      active = false
    }
  }, [highlightedId, user?.id])

  async function openReview(exchange) {
    setNotice('')
    setFormError(null)
    setOpeningId(exchange.id)
    try {
      const data = await exchangeRequestService.getById(exchange.id)
      const request = data?.request || null
      if (!isCompletedExchangeForUser(request, user.id)) {
        throw new Error('This exchange is no longer available for review.')
      }
      const reviewData = await reviewService.listForExchange(request.id, { limit: 50 })
      const reviews = Array.isArray(reviewData?.reviews) ? reviewData.reviews : []
      if (reviews.some((review) => isReviewedBy(review, user.id))) {
        setNotice('You have already reviewed this exchange.')
        await loadEligible({ silent: true })
        return
      }
      setFormExchange(request)
    } catch (error) {
      setFormError(formatReviewError(error))
    } finally {
      setOpeningId(null)
    }
  }

  async function handleSubmit(payload) {
    setSubmitting(true)
    setFormError(null)
    try {
      await reviewService.create(payload)
      setFormExchange(null)
      setNotice('Your review was submitted.')
      setPage(1)
      await Promise.all([loadEligible({ silent: true }), loadReceived(1)])
    } catch (error) {
      setFormError(formatReviewError(error))
      if (error?.status === 409) await loadEligible({ silent: true })
    } finally {
      setSubmitting(false)
    }
  }

  function closeHighlight() {
    const next = new URLSearchParams(searchParams)
    next.delete('review')
    setSearchParams(next, { replace: true })
    setHighlighted(null)
    setHighlightError(null)
  }

  return (
    <div className="animate-rise space-y-8">
      <PageHeader
        eyebrow="Reputation"
        title="Reviews & reputation"
        description="Review completed exchanges and see the reputation Averra calculates from visible feedback."
        actions={
          <Link
            to="/app/profile"
            className="inline-flex h-9 items-center rounded-lg border border-lavender-200 bg-lavender-50 px-3 text-xs font-medium text-lavender-700 transition-colors hover:bg-lavender-100"
          >
            Your profile
          </Link>
        }
      />

      {notice && <Alert variant="success">{notice}</Alert>}
      {eligibleError && (
        <Alert variant="error" title="Could not load reviewable exchanges">
          {eligibleError.message}
        </Alert>
      )}
      {receivedError && (
        <Alert variant="error" title="Could not load reviews">
          {receivedError.message}
        </Alert>
      )}

      <ReputationSummary reputation={user?.reputation} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg text-ink-900">Write a review</h3>
            <p className="mt-1 text-xs leading-5 text-ink-500">
              Completed exchanges appear here. The API confirms eligibility again when you submit.
            </p>
          </div>
          {eligible.length > 0 && !eligibleLoading && (
            <span className="text-xs text-ink-500">{eligible.length} available</span>
          )}
        </div>

        {eligibleLoading ? (
          <div className="grid h-24 place-items-center rounded-card border border-ink-200/80 bg-white">
            <Spinner label="Loading reviewable exchanges" />
          </div>
        ) : eligible.length === 0 ? (
          <EmptyState
            icon={PenLine}
            title="No exchanges to review"
            description="Reviews become available once a skill exchange is marked complete."
          />
        ) : (
          <div className="space-y-3">
            {eligible.map((item) => {
              const other = otherParticipant(item, user.id)
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-ink-200/80 bg-white p-4 transition-colors duration-200 hover:border-lavender-200"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900">
                      Review {other?.name || 'your exchange partner'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-ink-500">
                      Offered: {item.offeredSkill?.name || '—'} · Requested:{' '}
                      {item.requestedSkill?.name || '—'}
                      {item.completedAt && ` · Completed ${formatReviewDate(item.completedAt)}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={openingId === item.id}
                    disabled={Boolean(openingId)}
                    onClick={() => openReview(item)}
                  >
                    Write review
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg text-ink-900">Reviews you received</h3>
            <p className="mt-1 text-xs text-ink-500">Visible reviews left by exchange partners.</p>
          </div>
          <Select
            label="Sort reviews"
            className="w-full sm:w-52"
            value={sort}
            options={REVIEW_SORT_OPTIONS}
            onChange={(event) => {
              setSort(event.target.value)
              setPage(1)
            }}
          />
        </div>

        {receivedLoading ? (
          <div className="grid h-24 place-items-center rounded-card border border-ink-200/80 bg-white">
            <Spinner label="Loading received reviews" />
          </div>
        ) : received.length === 0 ? (
          <EmptyState
            icon={Star}
            title="No reviews yet"
            description="Reviews from completed exchanges will appear here once they are published."
          />
        ) : (
          <div className="space-y-3">
            {received.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
            <Pagination
              pagination={pagination}
              onPageChange={setPage}
              disabled={receivedLoading}
            />
          </div>
        )}
      </section>

      <section className="rounded-card border border-dashed border-ink-200 bg-ivory-50/60 p-5">
        <h3 className="text-lg text-ink-900">Reviews you wrote</h3>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-600">
          Averra's API does not expose reviews by author. Reviews you submit are visible to the
          recipient on their profile instead.
        </p>
      </section>

      <Modal
        open={Boolean(formExchange)}
        title="Review this exchange"
        description="Ratings and comment are sent to the backend, which confirms eligibility."
        onClose={() => {
          setFormExchange(null)
          setFormError(null)
        }}
      >
        {formExchange && (
          <ReviewForm
            key={formExchange.id}
            exchange={formExchange}
            other={otherParticipant(formExchange, user.id)}
            error={formError}
            submitting={submitting}
            onSubmit={handleSubmit}
            onCancel={() => {
              setFormExchange(null)
              setFormError(null)
            }}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(highlightedId)}
        title="Review"
        description="The review linked from your notification."
        size="sm"
        onClose={closeHighlight}
      >
        {highlightError ? (
          <Alert variant="error" title="Review unavailable">
            {formatReviewError(highlightError)}
          </Alert>
        ) : highlighted ? (
          <ReviewCard review={highlighted} highlighted compact />
        ) : (
          <div className="grid h-24 place-items-center">
            <Spinner label="Loading review" />
          </div>
        )}
      </Modal>
    </div>
  )
}
