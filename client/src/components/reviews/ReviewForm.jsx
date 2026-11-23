import { useId, useState } from 'react'
import Alert from '../ui/Alert.jsx'
import Button from '../ui/Button.jsx'
import Textarea from '../ui/Textarea.jsx'
import StarRating from './StarRating.jsx'
import { buildReviewPayload, formatReviewDate, validateReviewForm } from '../../utils/reviews.js'

export default function ReviewForm({ exchange, other, error, submitting, onSubmit, onCancel }) {
  const id = useId()
  const [values, setValues] = useState({
    overallRating: 0,
    teachingRating: 0,
    learningRating: 0,
    comment: ''
  })
  const [errors, setErrors] = useState({})

  function setField(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateReviewForm(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSubmit(buildReviewPayload({ ...values, exchangeRequestId: exchange?.id }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl border border-ink-100 bg-ivory-50/70 px-4 py-3">
        <p className="text-sm text-ink-700">
          Reviewing <span className="font-medium text-ink-900">{other?.name || 'your exchange partner'}</span>
          {' '}for a completed exchange.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
          <span>Offered: {exchange?.offeredSkill?.name || '—'}</span>
          <span>Requested: {exchange?.requestedSkill?.name || '—'}</span>
          {exchange?.completedAt && <span>Completed {formatReviewDate(exchange.completedAt)}</span>}
        </div>
      </div>

      {error && <Alert variant="error" title="Review not submitted">{error}</Alert>}

      <div className="grid gap-5 sm:grid-cols-3">
        <StarRating
          name={`${id}-overall`}
          label="Overall rating"
          value={values.overallRating}
          onChange={(value) => setField('overallRating', value)}
          error={errors.overallRating}
        />
        <StarRating
          name={`${id}-teaching`}
          label="Teaching experience"
          value={values.teachingRating}
          onChange={(value) => setField('teachingRating', value)}
          error={errors.teachingRating}
        />
        <StarRating
          name={`${id}-learning`}
          label="Learning experience"
          value={values.learningRating}
          onChange={(value) => setField('learningRating', value)}
          error={errors.learningRating}
        />
      </div>

      <Textarea
        label="Your comment"
        rows={5}
        maxLength={2000}
        placeholder="What was this exchange like?"
        value={values.comment}
        onChange={(event) => setField('comment', event.target.value)}
        error={errors.comment}
        helperText="A short comment is required by the review API. Up to 2,000 characters."
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Submit review
        </Button>
      </div>
    </form>
  )
}
