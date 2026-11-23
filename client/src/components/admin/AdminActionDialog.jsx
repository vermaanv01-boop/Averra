import { useEffect, useState } from 'react'
import Alert from '../ui/Alert.jsx'
import Button from '../ui/Button.jsx'
import Modal from '../ui/Modal.jsx'
import Textarea from '../ui/Textarea.jsx'
import { validateReason } from '../../utils/admin.js'

export default function AdminActionDialog({
  open,
  title,
  description,
  confirmLabel,
  loading = false,
  error,
  confirmVariant = 'danger',
  reasonConfig = {},
  onConfirm,
  onCancel
}) {
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (!open) return
    setReason('')
    setLocalError('')
  }, [open])

  function handleConfirm() {
    const validationError = validateReason(reason, reasonConfig)
    if (validationError) {
      setLocalError(validationError)
      return
    }
    onConfirm(reason.trim())
  }

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
            Cancel
          </Button>
          <Button variant={confirmVariant} loading={loading} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <Alert variant="error" title="Action failed">{error}</Alert>}
        <Textarea
          label={reasonConfig.label || 'Reason'}
          rows={3}
          maxLength={reasonConfig.max ?? 500}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value)
            setLocalError('')
          }}
          error={localError}
          helperText={reasonConfig.helperText || 'Recorded in the admin audit log.'}
          placeholder={reasonConfig.placeholder || 'Explain this action'}
        />
      </div>
    </Modal>
  )
}
