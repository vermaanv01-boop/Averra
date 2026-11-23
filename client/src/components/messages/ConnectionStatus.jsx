import {
  ArrowLeft,
  CircleCheck,
  Clock3,
  LoaderCircle,
  Wifi,
  WifiOff
} from 'lucide-react'
import { cn } from '../../utils/cn.js'

const CONFIG = {
  connected: { label: 'Live', dot: 'bg-emerald-500', text: 'text-emerald-700', Icon: Wifi },
  connecting: { label: 'Connecting', dot: 'bg-amber-400', text: 'text-amber-700', Icon: LoaderCircle },
  reconnecting: { label: 'Reconnecting', dot: 'bg-amber-400', text: 'text-amber-700', Icon: LoaderCircle },
  disconnected: { label: 'Offline', dot: 'bg-ink-400', text: 'text-ink-600', Icon: WifiOff },
  error: { label: 'Disconnected', dot: 'bg-red-400', text: 'text-red-700', Icon: WifiOff },
  offline: { label: 'Offline', dot: 'bg-ink-400', text: 'text-ink-600', Icon: WifiOff }
}

export default function ConnectionStatus({ connection, authError }) {
  const config = CONFIG[connection] || CONFIG.offline
  const { Icon } = config

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-xs', config.text)}
      title={authError || `${config.label} connection`}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot, connection === 'connected' && 'shadow-[0_0_0_3px_rgba(16,185,129,0.12)]')} />
      <Icon className={cn('h-3 w-3', (connection === 'connecting' || connection === 'reconnecting') && 'animate-spin')} aria-hidden="true" />
      <span className="sr-only">Connection status: </span>
      {config.label}
    </span>
  )
}

export function ReadState({ message, currentUserId }) {
  if (!message || !message.id) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-ink-400">
        <Clock3 className="h-3 w-3" aria-hidden="true" /> Sending
      </span>
    )
  }
  if (message.status === 'failed') {
    return <span className="text-[10px] text-red-600">Not sent</span>
  }
  const read = (message.readBy || []).some((id) => id && id !== currentUserId)
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px]', read ? 'text-lavender-700' : 'text-ink-400')}>
      <CircleCheck className="h-3 w-3" aria-hidden="true" />
      {read ? 'Read' : 'Delivered'}
    </span>
  )
}

export function MobileBackButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back to conversations"
      className="grid h-8 w-8 place-items-center rounded-lg border border-ink-200 text-ink-600 transition-colors hover:bg-ivory-100 md:hidden"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
    </button>
  )
}
