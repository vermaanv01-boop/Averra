import EmptyState from '../ui/EmptyState.jsx'
import { cn } from '../../utils/cn.js'

export default function AdminTable({
  caption,
  columns,
  rows = [],
  emptyTitle = 'Nothing to show',
  emptyDescription = 'No records are available for these filters.'
}) {
  if (!rows.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="overflow-x-auto rounded-card border border-ink-200/80 bg-white shadow-soft">
      <table className="w-full min-w-[680px] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-ink-100 bg-ivory-50/70">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn('px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-ink-500', column.headerClassName)}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((row, index) => (
            <tr key={row.id || index} className="transition-colors duration-200 hover:bg-ivory-50/50">
              {columns.map((column) => (
                <td key={column.key} className={cn('px-4 py-3 align-top text-ink-700', column.className)}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
