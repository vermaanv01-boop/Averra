import { ChevronLeft, ChevronRight } from 'lucide-react'
import Button from '../ui/Button.jsx'

export default function Pagination({ pagination, onPageChange, disabled = false }) {
  if (!pagination || pagination.totalPages <= 1) return null

  const { page, totalPages, total, hasNext, hasPrevious } = pagination

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-5"
    >
      <Button
        variant="secondary"
        size="sm"
        disabled={!hasPrevious || disabled}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Previous
      </Button>
      <p className="text-sm text-ink-500">
        Page <span className="font-medium text-ink-900">{page}</span> of {totalPages} · {total} results
      </p>
      <Button
        variant="secondary"
        size="sm"
        disabled={!hasNext || disabled}
        onClick={() => onPageChange(page + 1)}
      >
        Next
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </nav>
  )
}
