import Button from '../ui/Button.jsx'
import Modal from '../ui/Modal.jsx'
import ScheduleConflictAlert from './ScheduleConflictAlert.jsx'

const variants = {
  danger: 'danger',
  primary: 'primary',
  subtle: 'subtle'
}

export default function SessionConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = 'danger',
  loading,
  serverError,
  onConfirm,
  onCancel
}) {
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onCancel}
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" disabled={loading} onClick={onCancel}>
            Back
          </Button>
          <Button variant={variants[tone] || 'danger'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-ink-600">
          This updates the session for both participants. Please confirm before continuing.
        </p>
        <ScheduleConflictAlert error={serverError} />
      </div>
    </Modal>
  )
}
