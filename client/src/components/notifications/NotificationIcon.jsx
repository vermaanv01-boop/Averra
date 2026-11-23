import {
  Ban,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  Clock3,
  MessageSquare,
  Star,
  UserPlus,
  XCircle
} from 'lucide-react'
import { cn } from '../../utils/cn.js'

const ICONS = {
  exchange_request: UserPlus,
  exchange_accepted: CheckCircle2,
  exchange_rejected: XCircle,
  exchange_cancelled: Ban,
  session_invitation: CalendarClock,
  session_confirmed: CalendarCheck,
  session_declined: CalendarX,
  session_rescheduled: CalendarClock,
  session_cancelled: CalendarX,
  session_completed: CalendarCheck,
  new_message: MessageSquare,
  review_received: Star
}

export default function NotificationIcon({ type, className }) {
  const Icon = ICONS[type] || (type?.startsWith('session') ? Calendar : Clock3)
  return <Icon className={cn('h-4 w-4', className)} aria-hidden="true" />
}
