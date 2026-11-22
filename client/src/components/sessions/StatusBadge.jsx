import Badge from '../ui/Badge.jsx'
import { SESSION_STATUS_LABELS } from '../../utils/constants.js'

const tones = {
  pending: 'warning',
  confirmed: 'success',
  declined: 'danger',
  reschedule_requested: 'lavender',
  cancelled: 'neutral',
  completed: 'success'
}

export default function StatusBadge({ status }) {
  return <Badge tone={tones[status] || 'neutral'}>{SESSION_STATUS_LABELS[status] || status}</Badge>
}
