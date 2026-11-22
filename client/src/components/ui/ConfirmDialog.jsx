import Button from './Button.jsx'
import Modal from './Modal.jsx'

export default function ConfirmDialog({ open, title, description, confirmLabel, loading, onConfirm, onCancel }) {
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
          <Button variant="danger" loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-6 text-ink-600">
        This removes the skill from your Averra profile. It cannot be undone.
      </p>
    </Modal>
  )
}
