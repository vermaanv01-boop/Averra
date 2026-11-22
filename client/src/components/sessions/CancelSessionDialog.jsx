import { useEffect, useId, useRef, useState } from 'react'
import Button from '../ui/Button.jsx'
import Modal from '../ui/Modal.jsx'
import Textarea from '../ui/Textarea.jsx'
import ScheduleConflictAlert from './ScheduleConflictAlert.jsx'

export default function CancelSessionDialog({ open, session, submitting, serverError, onClose, onConfirm }) {
  const formId = useId()
  const submittingRef = useRef(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) return
    submittingRef.current = false
    setReason('')
  }, [open])

  async function handleSubmit(event) {
    event.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    await onConfirm(reason)
    submittingRef.current = false
  }

  return (
    <Modal
      open={open}
      title="Cancel this session?"
      description={session?.title || ''}
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" disabled={submitting} onClick={onClose}>
            Keep session
          </Button>
          <Button type="submit" form={formId} variant="danger" loading={submitting}>
            Cancel session
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm leading-6 text-ink-600">
          Both participants will see this session as cancelled. This cannot be undone.
        </p>
        <ScheduleConflictAlert error={serverError} />
        <Textarea
          label="Reason"
          value={reason}
          maxLength={300}
          rows={3}
          placeholder="Optional · up to 300 characters"
          disabled={submitting}
          onChange={(event) => setReason(event.target.value)}
        />
      </form>
    </Modal>
  )
}
