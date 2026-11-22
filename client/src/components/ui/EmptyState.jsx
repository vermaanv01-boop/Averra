export default function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-ink-200 bg-ivory-50 px-6 py-14 text-center">
      <h3 className="text-lg text-ink-900">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-6 text-ink-600">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
