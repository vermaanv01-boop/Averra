import { LoaderCircle } from 'lucide-react'
import { cn } from '../../utils/cn.js'

export default function Spinner({ className, label = 'Loading' }) {
  return (
    <span role="status" className="inline-flex items-center">
      <LoaderCircle className={cn('h-4 w-4 animate-spin text-lavender-600', className)} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}
