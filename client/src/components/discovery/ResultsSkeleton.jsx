export default function ResultsSkeleton({ count = 4 }) {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-label="Loading results">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="h-56 animate-pulse rounded-card border border-ink-100 bg-ivory-100"
        />
      ))}
    </div>
  )
}
